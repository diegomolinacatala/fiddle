import { NextResponse } from "next/server";
import { leerInvitacion, aceptarInvitacion } from "@/lib/invitaciones";
import { firmarSesion, cookieSesion, secretoSesion, COOKIE } from "@/lib/auth";
import { usoExcedido, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La página /invitacion (pública: el dueño aún no tiene contraseña). El token
// va en el cuerpo, nunca en la URL (ver lib/invitaciones.js).
//   POST { token }                   ¿vale? -> tienda, alcance y usuarios
//   POST { token, manager, caja }    fija las dos contraseñas (alcance "alta") y deja dentro
//   POST { token, manager }          solo la del dueño (alcance "manager"); la caja no cambia
export async function POST(request) {
  try {
    const { token, manager, caja } = await request.json().catch(() => ({}));
    if (manager === undefined && caja === undefined) {
      const r = await leerInvitacion(token);
      if (!r.ok) return jsonError(r.motivo, 410);
      return NextResponse.json({ nombre: r.negocio.nombre, tema: r.negocio.tema, alcance: r.alcance, usuarios: r.usuarios });
    }

    if (await usoExcedido("invitacion", ipDe(request))) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    const r = await aceptarInvitacion(token, { manager, caja });
    if (!r.ok) return NextResponse.json({ error: r.motivo, campo: r.campo ?? null }, { status: r.campo ? 400 : 410 });

    // Lo apunta como el manager que acaba de ser: es quien fijó las contraseñas.
    await auditar({ negocio: r.negocio, rol: "manager" }, r.negocio, "invitacion", `aceptada ${r.alcance}`);
    // Entra ya como manager: acaba de elegir la contraseña, pedírsela otra vez sobra.
    const res = NextResponse.json({ ok: true, destino: `/${r.negocio}/manager` });
    res.cookies.set(COOKIE, await firmarSesion(r.negocio, "manager"), cookieSesion("manager"));
    return res;
  } catch (e) {
    return errorInterno("invitación", e);
  }
}
