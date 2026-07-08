import { NextResponse } from "next/server";
import { getPrograma, savePrograma } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programa -> config actual
export async function GET() {
  return NextResponse.json(await getPrograma());
}

// PUT /api/programa -> guarda la config (el manager elige la funcionalidad)
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const patch = {};
    if (typeof body.titulo === "string") patch.titulo = body.titulo.slice(0, 64);
    if (typeof body.color === "string") patch.color = body.color;
    if (Number.isFinite(body.meta)) patch.meta = Math.max(1, Math.min(50, Math.round(body.meta)));
    if (typeof body.premio === "string") patch.premio = body.premio.slice(0, 128);
    if (Array.isArray(body.acciones)) patch.acciones = body.acciones.filter((k) => ACCIONES[k]);
    if (typeof body.promo === "string" || body.promo === null) patch.promo = body.promo || null;

    const nuevo = await savePrograma(patch);
    return NextResponse.json(nuevo);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
