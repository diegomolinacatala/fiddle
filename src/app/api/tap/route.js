import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/wallet";
import { getCliente, getNegocio } from "@/lib/store";
import { MIME_PKPASS } from "@/lib/apple/firmar";
import { clienteVigente } from "@/lib/unaTarjeta";
import { hayApple } from "@/lib/apple/config";
import { destinoDelTap } from "@/lib/googlewallet";
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

// En iPhone, el .pkpass NO va en esta misma respuesta: se redirige a
// /api/pase/<serial>. Así la cookie que recuerda la tarjeta viaja en una
// redirección normal, que Safari guarda siempre, y no en la descarga que se
// queda el Wallet (si esa cookie se pierde, el siguiente escaneo da otra
// tarjeta). Cuesta un salto de red y nada más.
const descargaPkpass = (serial, request) => NextResponse.redirect(new URL(`/api/pase/${serial}`, request.url), 302);

// El "tap NFC" de un negocio. El tag guarda /api/tap?b=<slug>.
//
// Si este teléfono YA tiene tarjeta de la tienda (cookie), se le devuelve la
// suya: tocar el tag dos veces no parte los sellos en dos cartillas, y en
// Android el tag es la forma natural de volver a abrir la tarjeta. `?nuevo=1`
// fuerza una nueva (para probar desde el mostrador).
//
// iPhone + pase real -> el .pkpass directo: sale "Añadir a Wallet" al instante
// (si ya lo tenía, iOS lo reconoce por el serial y lo actualiza en vez de
// duplicarlo). Android + Google Wallet activo -> directo a guardarla en Google
// Wallet, lo mismo que el iPhone. Resto -> la tarjeta web (/p/<serial>), que
// ofrece instalarla en la pantalla de inicio y los avisos.
export async function GET(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);

  try {
    const plataforma = plataformaDe(request.headers.get("user-agent"));
    const recordado = url.searchParams.get("nuevo") === "1"
      ? null
      : serialRecordado(request.cookies.get(cookieDeTarjeta(slug))?.value);
    // Si la tarjeta recordada se fusionó en otra (ver lib/unaTarjeta.js), la buena es esa.
    const suyo = recordado ? await clienteVigente(getCliente, recordado) : null;

    let cliente, respuesta;
    if (suyo?.negocio === slug && (await getNegocio(slug))) {
      cliente = suyo;
      respuesta = plataforma === "ios" && hayApple()
        ? descargaPkpass(cliente.serial, request)
        : NextResponse.redirect(new URL(destinoDelTap(plataforma, cliente.serial), request.url), 302);
    } else {
      if (await usoExcedido("tap", ipDe(request))) {
        return jsonError("Demasiados pases desde esta conexión. Prueba en unos minutos.", 429);
      }
      const r = await emitirPase(slug, { origen: "tap" });
      cliente = r.cliente;
      if (plataforma === "ios" && r.proveedor === "apple") respuesta = descargaPkpass(r.cliente.serial, request);
      else if (plataforma === "ios" && r.pkpassWalletWallet) respuesta = respuestaPkpass(r.pkpassWalletWallet, slug);
      // A la tarjeta en el MISMO dominio por el que entró (un deploy de prueba no
      // debe mandar al cliente a producción).
      else respuesta = NextResponse.redirect(r.proveedor === "walletwallet" ? r.shareUrl : new URL(destinoDelTap(plataforma, r.cliente.serial), request.url), 302);
    }

    respuesta.cookies.set(cookieDeTarjeta(slug), cliente.serial, opcionesCookieTarjeta(url.protocol === "https:"));
    return respuesta;
  } catch (e) {
    return errorInterno("tap", e);
  }
}
