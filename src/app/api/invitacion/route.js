import { NextResponse } from "next/server";
import { leerInvitacion, aceptarInvitacion } from "@/lib/invitaciones";
import { firmarSesion, secretoSesion, COOKIE, TTL_SEGUNDOS } from "@/lib/auth";
import { usoExcedido, ipDe } from "@/lib/limitador";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La página /invitacion (pública: el dueño aún no tiene contraseña). El token
// va en el cuerpo, nunca en la URL (ver lib/invitaciones.js).
//   POST { token }                   ¿vale? -> tienda y usuarios
//   POST { token, manager, caja }    fija las dos contraseñas y deja dentro
// Un 410 lleva `codigo` (incompleto, desconocido, usada, caducada, sin_tienda):
// la página aconseja con él, y aquí queda en el log de Vercel SIN el token,
// que es lo único que permite ver desde el servidor que un enlace falló.
export async function POST(request) {
  try {
    const { token, manager, caja } = await request.json().catch(() => ({}));
    if (manager === undefined && caja === undefined) {
      const r = await leerInvitacion(token);
      if (!r.ok) return rechazada(r);
      return NextResponse.json({ nombre: r.negocio.nombre, tema: r.negocio.tema, usuarios: r.usuarios });
    }

    if (await usoExcedido("invitacion", ipDe(request))) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    const r = await aceptarInvitacion(token, { manager, caja });
    if (!r.ok) {
      if (r.campo) return NextResponse.json({ error: r.motivo, campo: r.campo }, { status: 400 });
      return rechazada(r);
    }
    // Quien acepta es el dueño: desde ahora, el manager de esa tienda.
    await auditar({ negocio: r.negocio, rol: "manager" }, r.negocio, "invitacion", "aceptada");

    // Entra ya como manager: acaba de elegir la contraseña, pedírsela otra vez sobra.
    const res = NextResponse.json({ ok: true, destino: `/${r.negocio}/manager` });
    res.cookies.set(COOKIE, await firmarSesion(r.negocio, "manager"), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_SEGUNDOS.manager,
    });
    return res;
  } catch (e) {
    return errorInterno("invitación", e);
  }
}

function rechazada({ codigo, motivo }) {
  console.warn("[invitación] rechazada:", codigo);
  return NextResponse.json({ error: motivo, codigo }, { status: 410 });
}
