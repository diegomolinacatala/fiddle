import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/emitir";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Emite un pase y devuelve JSON (lo usa el botón del manager).
// POST /api/crear -> { serial, shareUrl, demo }
export async function POST() {
  try {
    return NextResponse.json(await emitirPase());
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
