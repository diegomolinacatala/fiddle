import sharp from "sharp";
import { TAM, svgIcono, svgLogo, stripDelPase } from "./dibujo";
import { versionDe } from "../rutasImagen";
import { bufferDeLogo, componerLogo } from "../logoImagen";
import { logoImagenDe } from "../logo";

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

// La clave lleva la HUELLA del diseño (marca, colores, logo…): antes era solo
// la tienda, y tras cambiar el logo esta instancia seguía firmando el viejo.
function fijas(negocio) {
  const t = negocio.tema;
  return cachear(cacheFijas, `${negocio.slug}:${versionDe(negocio)}`, async () => {
    const logo = logoImagenDe(t);
    const buffer = logo ? await bufferDeLogo(t) : null;
    if (!buffer) {
      const partes = await Promise.all([
        escalas("icon", svgIcono(t), TAM.icon, TAM.icon),
        escalas("logo", svgLogo(t), TAM.logo, TAM.logo),
      ]);
      return Object.assign({}, ...partes);
    }
    // Con imagen propia: el logo, tal cual y con algo de esquina si es cuadrada
    // y opaca (como un icono); el icono (avisos), sobre el fondo de la tarjeta.
    const de = (lado, opciones) => componerLogo(buffer, lado, { opaco: logo.opaco, ...opciones });
    const [l1, l2, l3, i1, i2, i3] = await Promise.all([
      ...[1, 2, 3].map((k) => de(TAM.logo * k, { escala: 1, sangre: true, radio: logo.opaco ? TAM.logo * k * 0.18 : 0 })),
      ...[1, 2, 3].map((k) => de(TAM.icon * k, { fondo: t.cardBg, escala: 0.84, sangre: true })),
    ]);
    return {
      "logo.png": l1, "logo@2x.png": l2, "logo@3x.png": l3,
      "icon.png": i1, "icon@2x.png": i2, "icon@3x.png": i3,
    };
  });
}

function strip(negocio, cliente, estado) {
  const esCupon = negocio.tipo === "descuento";
  const usado = (cliente.premios || 0) > 0;
  const sellos = Math.min(cliente.sellos, negocio.meta);
  // Con dos cartillas la banda depende de las dos cuentas (y de sus metas).
  const segunda = negocio.cartillas ? `:${negocio.cartillas[1].meta}:${cliente.sellos2 || 0}` : "";
  // La línea de abierto/cerrado también es parte del dibujo: otra frase, otra imagen.
  const linea = estado && !esCupon ? `:${estado.abierta ? 1 : 0}${estado.texto}` : "";
  // La huella del diseño, también: otro modo u otro color es otra banda.
  const diseno = versionDe(negocio);
  const clave = esCupon ? `${negocio.slug}:${diseno}:cupon:${usado}` : `${negocio.slug}:${diseno}:${negocio.meta}:${sellos}${segunda}${linea}`;
  if (!cacheStrips.has(clave) && cacheStrips.size >= MAX_STRIPS) {
    cacheStrips.delete(cacheStrips.keys().next().value); // la menos usada recientemente
  }
  return cachear(cacheStrips, clave, () => {
    const [w, h] = esCupon ? TAM.strip.coupon : TAM.strip.storeCard;
    return escalas("strip", stripDelPase(negocio, cliente, { estado }).svg, w, h);
  });
}

/**
 * Todas las imágenes del pase, como { "icon.png": Buffer, ... }.
 * @returns {Promise<Record<string, Buffer>>}
 */
export async function imagenesDelPase(negocio, cliente, { estado = null } = {}) {
  const [a, b] = await Promise.all([fijas(negocio), strip(negocio, cliente, estado)]);
  return { ...a, ...b };
}
