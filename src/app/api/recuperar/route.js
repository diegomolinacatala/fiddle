import { NextResponse } from "next/server";
import { getAccesoPorLogin, getNegocio, guardarAcceso } from "@/lib/store";
import { nuevoCodigo, mandarCodigo, comprobarCodigo } from "@/lib/codigos";
import { claveValida } from "@/lib/accesos";
import { hashClave, problemaClaveElegida } from "@/lib/claves";
import { leerEmail } from "@/lib/interesados";
import { firmarSesion, cookieSesion, secretoSesion, COOKIE } from "@/lib/auth";
import { usoExcedido, limiteEnMemoria, ipDe } from "@/lib/limitador";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// «HE OLVIDADO MI CONTRASEÑA» (público: /recuperar)
// ----------------------------------------------------------------------------
// Solo para el dueño que entra con su correo (lib/accesos.js, `login`): la caja
// no tiene correo y su contraseña la cambia el dueño en Ajustes.
//   POST { email }                  manda un código -> { reto }
//   POST { reto, codigo, clave }    pone la contraseña nueva y deja dentro
// A quien escribe un correo que no es de nadie se le contesta igual que al resto
// (un reto, sin correo detrás): esta pantalla no dice qué correos tienen cuenta.
// Cambiar la contraseña saca a las demás sesiones del dueño (lib/sesionVigente.js).
// ============================================================================

const PROPOSITO = "recuperar";
const LIMITE_CODIGO = { max: 30, ventanaMs: 10 * 60 * 1000 };

async function filaDelDueno(email) {
  const fila = email ? await getAccesoPorLogin(email) : null;
  if (!fila || fila.rol !== "manager") return null;
  const negocio = await getNegocio(fila.negocio);
  return negocio ? { fila, negocio } : null;
}

export async function POST(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return jsonError("No permitido", 403);
  try {
    const { email, reto, codigo, clave } = await request.json().catch(() => ({}));
    const ip = ipDe(request) || "?";

    if (reto === undefined) {
      const correo = leerEmail(email)?.toLowerCase();
      if (!correo) return NextResponse.json({ error: "Revisa el correo", campo: "email" }, { status: 400 });
      if (await usoExcedido("codigo", ip)) return jsonError("Demasiados códigos pedidos desde esta conexión. Espera unos minutos.", 429);
      const nuevo = await nuevoCodigo(correo, PROPOSITO);
      const dueno = await filaDelDueno(correo);
      if (dueno && !(await mandarCodigo(correo, nuevo.codigo, { para: dueno.negocio.nombre }))) {
        return NextResponse.json({ error: "No se pudo mandar el correo. Prueba otra vez en un momento.", campo: "email" }, { status: 502 });
      }
      return NextResponse.json({ reto: nuevo.reto, email: correo });
    }

    if (limiteEnMemoria(`recuperar:${ip}`, LIMITE_CODIGO)) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
    const r = await comprobarCodigo(reto, codigo, PROPOSITO);
    if (!r.ok) return NextResponse.json({ error: r.motivo, campo: "codigo", codigoCorreo: r.codigo }, { status: 400 });
    const dueno = await filaDelDueno(r.email);
    if (!dueno) return NextResponse.json({ error: "Ese correo no entra en ninguna cafetería. Si la caja es tuya, entra con su usuario.", campo: "email" }, { status: 400 });
    const { fila, negocio } = dueno;

    const problema = problemaClaveElegida(clave, r.email);
    if (problema) return NextResponse.json({ error: problema, campo: "clave" }, { status: 400 });
    if (await claveValida(negocio.slug, "caja", clave)) {
      return NextResponse.json({ error: "No puede ser la misma que la de la caja: la sabe quien la use", campo: "clave" }, { status: 400 });
    }
    if (await usoExcedido("invitacion", ip)) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    await guardarAcceso({ usuario: fila.usuario, negocio: negocio.slug, rol: "manager", hash: await hashClave(clave, "elegida") });
    const quien = { negocio: negocio.slug, rol: "manager" };
    await auditar(quien, negocio.slug, "clave", "recuperada por correo");
    const res = NextResponse.json({ ok: true, destino: `/${negocio.slug}/manager` });
    res.cookies.set(COOKIE, await firmarSesion(negocio.slug, "manager"), cookieSesion("manager"));
    return res;
  } catch (e) {
    return errorInterno("recuperar", e);
  }
}
