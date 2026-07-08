import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/emitir";
import { NEGOCIOS } from "@/lib/negocios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Emite un pase para un negocio y devuelve JSON (lo usa el manager).
// POST /api/crear?b=<slug>
export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!slug || !NEGOCIOS[slug]) {
    return NextResponse.json({ error: "Falta o no existe ?b=<negocio>" }, { status: 400 });
  }
  try {
    const r = await emitirPase(slug);
    return NextResponse.json({ serial: r.serial, negocio: r.negocio, shareUrl: r.shareUrl, demo: r.demo });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
