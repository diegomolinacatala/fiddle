import { NextResponse } from "next/server";
import {
  verificarAcceso, resolverUsuario, usuariosDemo, usuarioDe, firmarSesion, secretoSesion, COOKIE, TTL_SEGUNDOS,
} from "@/lib/auth";
import { esNegocio, LISTA_NEGOCIOS } from "@/lib/negocios";
import { loginBloqueado, anotarFalloLogin, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/login -> ¿hay accesos de prueba? Los pinta el login para no tener que
// mirar las variables de entorno. Vacío si no está activo el modo pruebas.
export async function GET() {
  if (!usuariosDemo()) return NextResponse.json({ demo: false, accesos: [] });
  const accesos = LISTA_NEGOCIOS.flatMap((n) =>
    ["manager", "caja"].map((rol) => ({
      negocio: n.nombre,
      emoji: n.tema.emoji,
      rol,
      usuario: usuarioDe(n.slug, rol),
      clave: usuarioDe(n.slug, rol),
    })),
  );
  return NextResponse.json({ demo: true, accesos });
}

// POST /api/login  body: { usuario, clave } -> valida, firma la sesión y la deja
// en una cookie httpOnly. Devuelve negocio y rol para redirigir.
export async function POST(request) {
  try {
    const { usuario, clave } = await request.json().catch(() => ({}));
    const quien = resolverUsuario(usuario);
    if (!quien || !esNegocio(quien.negocio)) return jsonError("Usuario o contraseña incorrectos", 401);
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    // El límite de intentos vive en la base de datos. Si falla, se deja entrar
    // igualmente (con la contraseña correcta): quedarse sin caja sería peor.
    const ip = ipDe(request);
    try {
      if (await loginBloqueado(quien.negocio, ip)) {
        return jsonError("Demasiados intentos. Espera 15 minutos.", 429);
      }
    } catch (e) {
      console.error("[login] no se pudo consultar el límite de intentos:", e);
    }

    const acceso = verificarAcceso(usuario, clave);
    if (!acceso) {
      await anotarFalloLogin(quien.negocio, ip).catch((e) => console.error("[login] no se pudo anotar el fallo:", e));
      return jsonError("Usuario o contraseña incorrectos", 401);
    }

    const res = NextResponse.json({ ok: true, negocio: acceso.negocio, rol: acceso.rol });
    res.cookies.set(COOKIE, await firmarSesion(acceso.negocio, acceso.rol), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_SEGUNDOS[acceso.rol],
    });
    return res;
  } catch (e) {
    return errorInterno("login", e);
  }
}
