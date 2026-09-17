import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/wallet";
import { generarPkpass, MIME_PKPASS } from "@/lib/apple/firmar";
import { esNegocio } from "@/lib/negocios";
import { jsonError, errorInterno } from "@/lib/http";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esIOS = (ua) => /iPhone|iPad|iPod/i.test(ua || "");

const respuestaPkpass = (buffer, slug) =>
  new Response(buffer, {
    headers: {
      "content-type": MIME_PKPASS,
      "content-disposition": `attachment; filename="${slug}.pkpass"`,
      "cache-control": "no-store",
    },
  });

// El "tap NFC" de un negocio. El tag guarda /api/tap?b=<slug>.
// iPhone + pase real -> devolvemos el .pkpass directo => sale "Añadir a Wallet"
// al instante, sin página intermedia. Resto -> página del pase (/p/<serial>),
// que ofrece Apple / Google Wallet y muestra el QR.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esNegocio(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);

  try {
    if (await usoExcedido("tap", ipDe(request))) {
      return jsonError("Demasiados pases desde esta conexión. Prueba en unos minutos.", 429);
    }
    const r = await emitirPase(slug);
    if (esIOS(request.headers.get("user-agent"))) {
      if (r.proveedor === "apple") return respuestaPkpass(await generarPkpass(r.cliente, r.negocio), slug);
      if (r.pkpassWalletWallet) return respuestaPkpass(r.pkpassWalletWallet, slug);
    }
    return NextResponse.redirect(r.proveedor === "walletwallet" ? r.shareUrl : r.urlPase, 302);
  } catch (e) {
    return errorInterno("tap", e);
  }
}
