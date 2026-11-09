import { NextResponse } from "next/server";
import { marcarTutorial } from "@/lib/store";
import { RECORRIDOS, usuarioDelRecorrido, recorridoVisto } from "@/lib/tutorial";
import { jsonError, errorInterno, sesionVigenteDe } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El recorrido de bienvenida (app/Recorrido.js, lib/tutorial.js): ¿ya lo vio este usuario?
//   GET  ?recorrido=manager   -> { visto }   (la caja y el manager ya lo traen de su página)
//   POST { recorrido }        -> lo apunta como visto

export async function GET(request) {
  const sesion = await sesionVigenteDe(request);
  if (!sesion) return jsonError("No autorizado", 401);
  const recorrido = new URL(request.url).searchParams.get("recorrido");
  if (!RECORRIDOS.includes(recorrido)) return jsonError("Recorrido desconocido", 400);
  return NextResponse.json({ visto: await recorridoVisto(sesion, recorrido) });
}

export async function POST(request) {
  const sesion = await sesionVigenteDe(request);
  if (!sesion) return jsonError("No autorizado", 401);
  try {
    const { recorrido } = await request.json().catch(() => ({}));
    if (!RECORRIDOS.includes(recorrido)) return jsonError("Recorrido desconocido", 400);
    await marcarTutorial({ ...usuarioDelRecorrido(sesion), recorrido });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("tutorial", e);
  }
}
