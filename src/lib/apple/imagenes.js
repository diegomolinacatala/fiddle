import sharp from "sharp";
import { TAM, svgIcono, svgLogo, stripDelPase } from "./dibujo";

// ============================================================================
// APPLE WALLET — imágenes del pase (icon, logo, strip)
// ----------------------------------------------------------------------------
// El DIBUJO vive en `dibujo.js` (SVG puro, sin dependencias). Aquí solo se
// rasteriza con sharp y se cachea: nada que empaquetar ni leer de disco (en
// Vercel `public/` no está dentro de las funciones).
//
// La STRIP (banda bajo la cabecera) es dinámica: dibuja la cartilla con los
// sellos conseguidos. Cada sello nuevo = imagen nueva en el pase actualizado.
// ============================================================================

// La rejilla se re-exporta porque es parte del contrato del pase (y va testeada).
export { rejillaSellos } from "./dibujo";

async function png(svgTexto, w, h) {
  return sharp(Buffer.from(svgTexto)).resize(w, h).png().toBuffer();
}

// Genera @1x, @2x y @3x a partir de un SVG dibujado a @3x.
async function escalas(nombre, svgTexto, w, h) {
  const [x1, x2, x3] = await Promise.all([png(svgTexto, w, h), png(svgTexto, w * 2, h * 2), png(svgTexto, w * 3, h * 3)]);
  return { [`${nombre}.png`]: x1, [`${nombre}@2x.png`]: x2, [`${nombre}@3x.png`]: x3 };
}

const cacheFijas = new Map(); // slug -> Promise<{icon*, logo*}>
const cacheStrips = new Map(); // clave -> Promise<{strip*}>
const MAX_STRIPS = 300;

// Cachea la promesa; si falla, la saca de la caché para reintentar la próxima vez.
// Al usarla se reinserta al final, así el Map queda ordenado por último uso (LRU).
function cachear(cache, clave, crear) {
  const existente = cache.get(clave);
  if (existente) {
    cache.delete(clave);
    cache.set(clave, existente);
    return existente;
  }
  const p = crear();
  p.catch(() => cache.delete(clave));
  cache.set(clave, p);
  return p;
}

function fijas(negocio) {
  const t = negocio.tema;
  return cachear(cacheFijas, negocio.slug, () =>
    Promise.all([
      escalas("icon", svgIcono(t), TAM.icon, TAM.icon),
      escalas("logo", svgLogo(t), TAM.logo, TAM.logo),
    ]).then((partes) => Object.assign({}, ...partes)),
  );
}

function strip(negocio, cliente) {
  const esCupon = negocio.tipo === "descuento";
  const usado = (cliente.premios || 0) > 0;
  const sellos = Math.min(cliente.sellos, negocio.meta);
  // Con dos cartillas la banda depende de las dos cuentas (y de sus metas).
  const segunda = negocio.cartillas ? `:${negocio.cartillas[1].meta}:${cliente.sellos2 || 0}` : "";
  const clave = esCupon ? `${negocio.slug}:cupon:${usado}` : `${negocio.slug}:${negocio.meta}:${sellos}${segunda}`;
  if (!cacheStrips.has(clave) && cacheStrips.size >= MAX_STRIPS) {
    cacheStrips.delete(cacheStrips.keys().next().value); // la menos usada recientemente
  }
  return cachear(cacheStrips, clave, () => {
    const [w, h] = esCupon ? TAM.strip.coupon : TAM.strip.storeCard;
    return escalas("strip", stripDelPase(negocio, cliente).svg, w, h);
  });
}

/**
 * Todas las imágenes del pase, como { "icon.png": Buffer, ... }.
 * @returns {Promise<Record<string, Buffer>>}
 */
export async function imagenesDelPase(negocio, cliente) {
  const [a, b] = await Promise.all([fijas(negocio), strip(negocio, cliente)]);
  return { ...a, ...b };
}
