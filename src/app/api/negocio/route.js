import { NextResponse } from "next/server";
import { getNegocio, saveNegocio } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";
import { NEGOCIOS } from "@/lib/negocios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/negocio?b=<slug>  -> config actual (con tema)
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  const n = await getNegocio(slug);
  if (!n) return NextResponse.json({ error: "negocio desconocido" }, { status: 404 });
  return NextResponse.json(n);
}

// PUT /api/negocio?b=<slug>  -> guarda la config editable
export async function PUT(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!NEGOCIOS[slug]) return NextResponse.json({ error: "negocio desconocido" }, { status: 404 });
  try {
    const body = await request.json().catch(() => ({}));
    const patch = {};
    if (Number.isFinite(body.meta)) patch.meta = Math.max(1, Math.min(50, Math.round(body.meta)));
    if (typeof body.premio === "string") patch.premio = body.premio.slice(0, 128);
    if (Array.isArray(body.acciones)) patch.acciones = body.acciones.filter((k) => ACCIONES[k]);
    if (typeof body.promo === "string" || body.promo === null) patch.promo = body.promo || null;
    const nuevo = await saveNegocio(slug, patch);
    return NextResponse.json(nuevo);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
