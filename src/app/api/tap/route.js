import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/emitir";
import { NEGOCIOS } from "@/lib/negocios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esIOS = (ua) => /iPhone|iPad|iPod/i.test(ua || "");

// El "tap NFC" de un negocio. El tag guarda /api/tap?b=<slug>.
// iOS + pase real -> devolvemos el .pkpass directo => "Añadir a Wallet" al instante
// (sin página intermedia ni tap extra). Android/desktop/demo -> redirect device-aware.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!slug || !NEGOCIOS[slug]) {
    return NextResponse.json({ error: "Falta o no existe ?b=<negocio>" }, { status: 400 });
  }
  try {
    const r = await emitirPase(slug);
    if (r.applePass && esIOS(request.headers.get("user-agent"))) {
      const bytes = Buffer.from(r.applePass, "base64");
      return new Response(bytes, {
        headers: {
          "content-type": "application/vnd.apple.pkpass",
          "content-disposition": `attachment; filename="${slug}.pkpass"`,
          "cache-control": "no-store",
        },
      });
    }
    return NextResponse.redirect(r.shareUrl, 302);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
