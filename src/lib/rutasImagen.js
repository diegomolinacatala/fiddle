import { appUrl } from "./url";

// ============================================================================
// URLS DE LAS IMÁGENES PÚBLICAS DE UNA TIENDA
// ----------------------------------------------------------------------------
// El pase de Apple lleva sus imágenes DENTRO del .pkpass. Todo lo demás las pide
// por URL: Google Wallet (logo y banda de sellos), el icono de la tarjeta
// instalada en Android y los avisos del navegador. Las sirve /api/imagen/<tipo>.
//
// Llevan `v`, una huella del diseño de la tienda: Google y los navegadores
// cachean las imágenes sin piedad, así que si la tienda cambia de marca o de
// color la URL cambia y se piden de nuevo. Y la banda lleva los sellos en la
// URL: cada sello nuevo es otra imagen, no la misma machacada.
// ============================================================================

export const TIPOS_IMAGEN = ["icono", "insignia", "logo", "banda"];

/** Huella corta del aspecto de la tienda (FNV-1a en base 36). */
export function versionDe(negocio) {
  const s = JSON.stringify([negocio?.nombre, negocio?.tipo, negocio?.meta, negocio?.tema]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function ruta(tipo, negocio, extra = {}) {
  const q = new URLSearchParams({ b: negocio.slug, ...extra, v: versionDe(negocio) });
  return `/api/imagen/${tipo}?${q}`;
}

/** Icono cuadrado. `maskable`: a sangre y con aire, para los iconos adaptables de Android. */
export const rutaIcono = (negocio, lado, { maskable = false } = {}) =>
  ruta("icono", negocio, { t: String(lado), ...(maskable ? { m: "1" } : {}) });

/** Silueta blanca para la barra de estado de Android. */
export const rutaInsignia = (negocio) => ruta("insignia", negocio);

/** Logo para Google Wallet (lo recorta en círculo). */
export const rutaLogo = (negocio) => ruta("logo", negocio);

/** Banda de sellos (la misma que la del pase de Apple) en el formato ancho de Google. */
export function rutaBanda(negocio, cliente) {
  if (negocio.tipo === "descuento") return ruta("banda", negocio, { u: (cliente?.premios || 0) > 0 ? "1" : "0" });
  return ruta("banda", negocio, { s: String(Math.min(cliente?.sellos ?? 0, negocio.meta)) });
}

/** Absoluta: Google Wallet descarga las imágenes desde sus servidores. */
export const absoluta = (rutaRelativa) => `${appUrl()}${rutaRelativa}`;
