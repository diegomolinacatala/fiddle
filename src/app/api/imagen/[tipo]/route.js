import sharp from "sharp";
import { getNegocio } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { svgMarca, svgLogoGoogle, svgBandaOpaca, stripDelPase } from "@/lib/apple/dibujo";
import { TIPOS_IMAGEN, rutaIcono, rutaInsignia, rutaLogo, rutaBanda } from "@/lib/rutasImagen";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/imagen/<tipo>?b=<slug>&v=<huella>[&t=<lado>&m=1 | &s=<sellos> | &u=0|1]
// Imágenes públicas de una tienda, dibujadas con las mismas piezas que el pase
// de Apple (ver lib/rutasImagen.js). Públicas a propósito: Google Wallet y el
// sistema de avisos de Android las descargan sin sesión. No llevan nada del
// cliente: la banda se pide por número de sellos, no por serial.
//
// Rasterizar cuesta CPU y la ruta es pública, así que SOLO se dibujan las URLs
// canónicas (las que arma rutasImagen: lado de la lista, sellos dentro de la
// cartilla, huella del diseño actual). Cualquier otra variante redirige a su
// canónica. Resultado: por tienda hay unas pocas decenas de imágenes posibles,
// la CDN las guarda un año y aquí además se recuerdan en memoria.

const LADOS = [48, 72, 96, 128, 144, 180, 192, 256, 384, 512];
const BANDA_GOOGLE = [1032, 336]; // el hero image de Google: casi la misma proporción que la banda de Apple
const MAX_EN_MEMORIA = 200;
const dibujadas = new Map(); // ruta canónica -> Promise<Buffer>

const ladoValido = (t) => LADOS.reduce((mejor, l) => (Math.abs(l - t) < Math.abs(mejor - t) ? l : mejor), 192);

function clienteDeBanda(negocio, q) {
  return negocio.tipo === "descuento"
    ? { premios: q.get("u") === "1" ? 1 : 0, sellos: 0 }
    : { sellos: Math.max(0, Math.min(Math.floor(Number(q.get("s"))) || 0, negocio.meta)), premios: 0 };
}

/** La URL canónica de lo que se pide: la única que se dibuja. */
function canonica(tipo, negocio, q) {
  if (tipo === "icono") return rutaIcono(negocio, ladoValido(Number(q.get("t")) || 192), { maskable: q.get("m") === "1" });
  if (tipo === "insignia") return rutaInsignia(negocio);
  if (tipo === "logo") return rutaLogo(negocio);
  return rutaBanda(negocio, clienteDeBanda(negocio, q));
}

function dibujo(tipo, negocio, q) {
  const tema = negocio.tema;
  if (tipo === "icono") {
    const lado = ladoValido(Number(q.get("t")) || 192);
    // Adaptable: Android lo recorta en círculo o gota, así que va a sangre y
    // con la marca dentro del 80 % central. El normal, con esquinas de icono.
    const svg = q.get("m") === "1"
      ? svgMarca(tema, lado, { escala: 0.54 })
      : svgMarca(tema, lado, { escala: 0.74, radio: lado * 0.22 });
    return { svg, ancho: lado, alto: lado };
  }
  if (tipo === "insignia") {
    // Android solo mira la transparencia: la marca en blanco sobre nada.
    return { svg: svgMarca(tema, 96, { fondo: null, color: "#ffffff", escala: 0.92 }), ancho: 96, alto: 96 };
  }
  if (tipo === "logo") {
    // Google lo recorta en círculo y pide un 15 % de margen.
    return { svg: svgLogoGoogle(tema, 660), ancho: 660, alto: 660 };
  }
  const [ancho, alto] = BANDA_GOOGLE;
  // Opaca: Google la pone sobre su color de acento, no sobre el fondo de la tarjeta.
  return { svg: svgBandaOpaca(stripDelPase(negocio, clienteDeBanda(negocio, q)).svg, tema.cardBg), ancho, alto };
}

function rasterizar(clave, crear) {
  const hecha = dibujadas.get(clave);
  if (hecha) return hecha;
  if (dibujadas.size >= MAX_EN_MEMORIA) dibujadas.delete(dibujadas.keys().next().value);
  const p = crear();
  p.catch(() => dibujadas.delete(clave));
  dibujadas.set(clave, p);
  return p;
}

export async function GET(request, { params }) {
  const { tipo } = await params;
  if (!TIPOS_IMAGEN.includes(tipo)) return jsonError("Imagen desconocida", 404);
  const url = new URL(request.url);
  const q = url.searchParams;
  const slug = q.get("b");
  if (!esSlug(slug)) return jsonError("Falta ?b=<negocio>", 400);

  try {
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("Negocio desconocido", 404);

    const ruta = canonica(tipo, negocio, q);
    if (`${url.pathname}${url.search}` !== ruta) {
      // Otra variante (o una huella vieja): a la canónica, que es la cacheada.
      return new Response(null, {
        status: 308,
        headers: { location: new URL(ruta, request.url).toString(), "cache-control": "public, max-age=300, s-maxage=300" },
      });
    }

    const png = await rasterizar(ruta, () => {
      const { svg, ancho, alto } = dibujo(tipo, negocio, q);
      return sharp(Buffer.from(svg)).resize(ancho, alto, { fit: "fill" }).png().toBuffer();
    });
    // La huella del diseño va en la URL: esta imagen no cambia nunca. Un año, en
    // el navegador y en la CDN.
    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (e) {
    return errorInterno(`imagen ${tipo}`, e);
  }
}
