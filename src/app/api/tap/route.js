import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/emitir";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El "tap NFC": el tag de la tienda apunta a esta URL. Al abrirla, el móvil
// crea un pase nuevo y aterriza en la pantalla de "Añadir a Wallet".
// GET /api/tap -> 302 a la shareUrl del pase recién creado.
export async function GET() {
  try {
    const { shareUrl } = await emitirPase();
    return NextResponse.redirect(shareUrl, 302);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
