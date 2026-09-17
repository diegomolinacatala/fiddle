import { NextResponse } from "next/server";
import { rolParaPin, firmarSesion, secretoSesion, COOKIE, TTL_SEGUNDOS } from "@/lib/auth";
import { esNegocio } from "@/lib/negocios";
import { loginBloqueado, anotarFalloLogin, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/login  body: { negocio, pin } -> valida el PIN de ESE negocio, firma
// la sesión y la deja en una cookie httpOnly. Devuelve el rol para redirigir.
export async function POST(request) {
  try {
    const { negocio, pin } = await request.json().catch(() => ({}));
    if (!esNegocio(negocio)) return jsonError("Elige un negocio", 400);
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    // El límite de intentos vive en la base de datos. Si falla, se deja entrar
    // igualmente (con el PIN correcto): quedarse sin acceso a la caja sería peor.
    const ip = ipDe(request);
    try {
      if (await loginBloqueado(negocio, ip)) {
        return jsonError("Demasiados intentos. Espera 15 minutos.", 429);
      }
    } catch (e) {
      console.error("[login] no se pudo consultar el límite de intentos:", e);
    }

    const rol = rolParaPin(negocio, String(pin ?? ""));
    if (!rol) {
      await anotarFalloLogin(negocio, ip).catch((e) => console.error("[login] no se pudo anotar el fallo:", e));
      return jsonError("PIN incorrecto", 401);
    }

    const res = NextResponse.json({ ok: true, negocio, rol });
    res.cookies.set(COOKIE, await firmarSesion(negocio, rol), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_SEGUNDOS[rol],
    });
    return res;
  } catch (e) {
    return errorInterno("login", e);
  }
}
