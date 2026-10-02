import { NextResponse } from "next/server";
import { tutorialesVistos, marcarTutorial } from "@/lib/store";
import { usuarioDe } from "@/lib/auth";
import { jsonError, errorInterno, sesionVigenteDe } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El recorrido de bienvenida (app/Recorrido.js): ¿ya lo vio este usuario?
//   GET  ?recorrido=manager   -> { visto }
//   POST { recorrido }        -> lo apunta como visto
// Va por usuario (`nube`, `nube-caja`), no por navegador. Los admins comparten
// uno: la sesión no dice si es victor o diego.
const RECORRIDOS = ["manager", "caja"];

const quien = (sesion) => ({
  usuario: sesion.rol === "admin" ? "admin" : usuarioDe(sesion.negocio, sesion.rol),
  negocio: sesion.negocio,
});

export async function GET(request) {
  const sesion = await sesionVigenteDe(request);
  if (!sesion) return jsonError("No autorizado", 401);
  const recorrido = new URL(request.url).searchParams.get("recorrido");
  if (!RECORRIDOS.includes(recorrido)) return jsonError("Recorrido desconocido", 400);
  try {
    return NextResponse.json({ visto: (await tutorialesVistos(quien(sesion).usuario)).includes(recorrido) });
  } catch (e) {
    // Sin base no se sabe; mejor no enseñarlo que enseñarlo en cada visita.
    console.error("[tutorial] no se pudo leer:", e);
    return NextResponse.json({ visto: true });
  }
}

export async function POST(request) {
  const sesion = await sesionVigenteDe(request);
  if (!sesion) return jsonError("No autorizado", 401);
  try {
    const { recorrido } = await request.json().catch(() => ({}));
    if (!RECORRIDOS.includes(recorrido)) return jsonError("Recorrido desconocido", 400);
    await marcarTutorial({ ...quien(sesion), recorrido });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("tutorial", e);
  }
}
