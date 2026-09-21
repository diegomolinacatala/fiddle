import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/wallet";
import { getCliente, getNegocio } from "@/lib/store";
import { generarPkpass, MIME_PKPASS } from "@/lib/apple/firmar";
import { hayApple } from "@/lib/apple/config";
import { esSlug } from "@/lib/negocios";
import { plataformaDe } from "@/lib/plataforma";
import { cookieDeTarjeta, serialRecordado, opcionesCookieTarjeta } from "@/lib/recordar";
import { jsonError, errorInterno } from "@/lib/http";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respuestaPkpass = (buffer, slug) =>
  new NextResponse(buffer, {
    headers: {
      "content-type": MIME_PKPASS,
      "content-disposition": `attachment; filename="${slug}.pkpass"`,
      "cache-control": "no-store",
    },
  });

// El "tap NFC" de un negocio. El tag guarda /api/tap?b=<slug>.
//
// Si este teléfono YA tiene tarjeta de la tienda (cookie), se le devuelve la
// suya: tocar el tag dos veces no parte los sellos en dos cartillas, y en
// Android el tag es la forma natural de volver a abrir la tarjeta. `?nuevo=1`
// fuerza una nueva (para probar desde el mostrador).
//
// iPhone + pase real -> el .pkpass directo: sale "Añadir a Wallet" al instante
// (si ya lo tenía, iOS lo reconoce por el serial y lo actualiza en vez de
// duplicarlo). Resto -> la página de la tarjeta (/p/<serial>), que en Android
// ofrece Google Wallet, instalarla en la pantalla de inicio y los avisos.
export async function GET(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);

  try {
    const plataforma = plataformaDe(request.headers.get("user-agent"));
    const recordado = url.searchParams.get("nuevo") === "1"
      ? null
      : serialRecordado(request.cookies.get(cookieDeTarjeta(slug))?.value);
    const suyo = recordado ? await getCliente(recordado) : null;

    let cliente, negocio, respuesta;
    if (suyo?.negocio === slug && (negocio = await getNegocio(slug))) {
      cliente = suyo;
      respuesta = plataforma === "ios" && hayApple()
        ? respuestaPkpass(await generarPkpass(cliente, negocio), slug)
        : NextResponse.redirect(new URL(`/p/${cliente.serial}`, request.url), 302);
    } else {
      if (await usoExcedido("tap", ipDe(request))) {
        return jsonError("Demasiados pases desde esta conexión. Prueba en unos minutos.", 429);
      }
      const r = await emitirPase(slug, { origen: "tap" });
      cliente = r.cliente;
      if (plataforma === "ios" && r.proveedor === "apple") respuesta = respuestaPkpass(await generarPkpass(r.cliente, r.negocio), slug);
      else if (plataforma === "ios" && r.pkpassWalletWallet) respuesta = respuestaPkpass(r.pkpassWalletWallet, slug);
      // A la tarjeta en el MISMO dominio por el que entró (un deploy de prueba no
      // debe mandar al cliente a producción).
      else respuesta = NextResponse.redirect(r.proveedor === "walletwallet" ? r.shareUrl : new URL(`/p/${r.cliente.serial}`, request.url), 302);
    }

    respuesta.cookies.set(cookieDeTarjeta(slug), cliente.serial, opcionesCookieTarjeta(url.protocol === "https:"));
    return respuesta;
  } catch (e) {
    return errorInterno("tap", e);
  }
}
