import { NextResponse } from "next/server";
import { cambiarClavePropia } from "@/lib/accesos";
import { firmarSesion, cookieSesion, COOKIE } from "@/lib/auth";
import { loginBloqueado, anotarFalloLogin, ipDe } from "@/lib/limitador";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/accesos/manager?b=<slug>  body: { actual, nueva }
// El dueño cambia SU contraseña desde Ajustes → «Tu acceso». Pide la actual: una
// sesión abierta en un ordenador ajeno no puede dejarle fuera de su propia cuenta.
// Un fallo cuenta como un fallo de login (mismo límite: 10 por IP y tienda en 15
// min), que esto es probar contraseñas con la puerta medio abierta. Al guardar,
// las demás sesiones del manager caen (lib/sesionVigente.js) y la suya se vuelve
// a firmar aquí mismo. Solo el manager: el admin tiene lo suyo en /admin.
export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { sesion, respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;
  if (sesion.rol !== "manager") return jsonError("Solo el dueño puede cambiar su contraseña desde aquí", 403);
  try {
    const { actual, nueva } = await request.json().catch(() => ({}));
    if (typeof actual !== "string" || typeof nueva !== "string") return jsonError("Faltan la contraseña actual y la nueva", 400);

    const ip = ipDe(request);
    try {
      if (await loginBloqueado(slug, ip)) return jsonError("Demasiados intentos. Espera 15 minutos.", 429);
    } catch (e) {
      console.error("[accesos manager] no se pudo consultar el límite de intentos:", e);
    }

    const r = await cambiarClavePropia(slug, "manager", { actual, nueva });
    if (!r.ok && r.campo === "actual") {
      await anotarFalloLogin(slug, ip).catch((e) => console.error("[accesos manager] no se pudo anotar el fallo:", e));
      return NextResponse.json({ error: r.motivo, campo: "actual" }, { status: 401 });
    }
    if (!r.ok) return NextResponse.json({ error: r.motivo, campo: r.campo }, { status: 400 });

    await auditar(sesion, slug, "clave", "manager");
    // La sesión nueva se firma DESPUÉS de guardar: su `iat` queda por delante de
    // `accesos.actualizado`, que es lo que echa a las demás.
    const res = NextResponse.json({ ok: true, usuario: r.usuario });
    res.cookies.set(COOKIE, await firmarSesion(slug, "manager", Date.now(), { usuario: sesion.usuario }), cookieSesion("manager"));
    return res;
  } catch (e) {
    return errorInterno("accesos manager", e);
  }
}
