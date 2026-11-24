import { NextResponse } from "next/server";
import { leerInvitacion, aceptarInvitacion, codigoDeInvitacion, verificarCodigoDeInvitacion, sugerenciasDe } from "@/lib/invitaciones";
import { firmarSesion, cookieSesion, secretoSesion, COOKIE } from "@/lib/auth";
import { usoExcedido, limiteEnMemoria, ipDe } from "@/lib/limitador";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno } from "@/lib/http";
import { getNegocio } from "@/lib/store";
import { normalizarPrimerosPasos } from "@/lib/primerosPasos";

// Si la base falla aquí, al panel: lo importante (entrar) ya está hecho.
const tienePrimerosPasos = (slug) => getNegocio(slug).then((n) => Boolean(normalizarPrimerosPasos(n?.primerosPasos))).catch(() => false);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La página /invitacion (pública: el dueño aún no tiene con qué entrar). El token
// va en el cuerpo, nunca en la URL (ver lib/invitaciones.js).
//   POST { token }                       ¿vale? -> tienda, alcance y lo que se ofrece escrito
//   POST { token, email }                manda el código a ese correo -> { reto, email }
//   POST { token, reto, codigo }         ¿es bueno el código? (para pasar de paso)
//   POST { token, reto, codigo, manager, cajaUsuario, caja }
//                                        fija correo y contraseña del dueño y usuario y
//                                        contraseña de la caja (alcance "alta") y deja dentro
//   POST { token, reto, codigo, manager }   solo lo del dueño (alcance "manager")
// Un 410 lleva `codigo` (incompleto, desconocido, usada, caducada, sin_tienda):
// la página aconseja con él, y aquí queda en el log de Vercel SIN el token,
// que es lo único que permite ver desde el servidor que un enlace falló.
//
// Comprobar un enlace no gasta nada (un token de 256 bits no se adivina), pero
// cada comprobación es una lectura de la base y una línea de log: un límite en
// memoria, sin tocar la base, corta un bucle. Mandar un código (un correo) y
// fijar las contraseñas (dos scrypt) van al límite persistido.
const LIMITE_COMPROBAR = { max: 60, ventanaMs: 10 * 60 * 1000 };

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => ({}));
    const { token, email, reto, codigo, manager } = cuerpo;
    const ip = ipDe(request) || "?";

    if (manager === undefined && reto === undefined && email === undefined) {
      if (limiteEnMemoria(`invitacion-leer:${ip}`, LIMITE_COMPROBAR)) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
      const r = await leerInvitacion(token);
      if (!r.ok) return rechazada(r);
      return NextResponse.json({ nombre: r.negocio.nombre, tema: r.negocio.tema, alcance: r.alcance, ...(await sugerenciasDe(r.negocio)) });
    }

    if (email !== undefined && reto === undefined) {
      if (await usoExcedido("codigo", ip)) return jsonError("Demasiados códigos pedidos desde esta conexión. Espera unos minutos.", 429);
      const r = await codigoDeInvitacion(token, email);
      if (!r.ok) return r.campo ? fallo(r) : rechazada(r);
      return NextResponse.json({ reto: r.reto, email: r.email });
    }

    if (manager === undefined) {
      if (limiteEnMemoria(`invitacion-codigo:${ip}`, LIMITE_COMPROBAR)) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
      const r = await verificarCodigoDeInvitacion(token, reto, codigo);
      if (!r.ok) return r.campo ? fallo(r) : rechazada(r);
      return NextResponse.json({ ok: true, email: r.email });
    }

    if (await usoExcedido("invitacion", ip)) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    const r = await aceptarInvitacion(token, cuerpo);
    if (!r.ok) return r.campo ? fallo(r) : rechazada(r);
    // Quien acepta es el dueño: desde ahora, el manager de esa tienda. Queda con qué alcance.
    await auditar({ negocio: r.negocio, rol: "manager" }, r.negocio, "invitacion", `aceptada ${r.alcance}`);

    // Entra ya como manager: acaba de elegir la contraseña, pedírsela otra vez sobra.
    // Una tienda recién dada de alta empieza por sus primeros pasos (lib/primerosPasos.js);
    // quien recupera su acceso vuelve a su panel.
    const destino = r.alcance === "alta" && (await tienePrimerosPasos(r.negocio)) ? "primeros-pasos" : "manager";
    const res = NextResponse.json({ ok: true, destino: `/${r.negocio}/${destino}` });
    res.cookies.set(COOKIE, await firmarSesion(r.negocio, "manager"), cookieSesion("manager"));
    return res;
  } catch (e) {
    return errorInterno("invitación", e);
  }
}

// Un campo que corregir (correo, código, contraseña, usuario de la caja). `codigoCorreo`
// dice si el código caducó o se agotó: la pantalla ofrece pedir otro.
function fallo({ motivo, campo, codigoCorreo, codigo }) {
  const status = codigo === "correo" ? 502 : 400;
  return NextResponse.json({ error: motivo, campo, ...(codigoCorreo ? { codigoCorreo } : {}) }, { status });
}

function rechazada({ codigo, motivo }) {
  console.warn("[invitación] rechazada:", codigo);
  return NextResponse.json({ error: motivo, codigo }, { status: 410 });
}
