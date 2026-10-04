// ============================================================================
// LO TUYO: lo que una tienda sube para su tarjeta
// ----------------------------------------------------------------------------
// El editor de la tarjeta tiene dos cajones en cada sitio (logo, sellos, fondo
// de la banda, colores):
//
//   PREDETERMINADOS  lo de todos: los dibujos de dibujo.js, las plantillas de
//                    negocios.js, los fondos de siempre.
//   TUYOS            lo de ESTA tienda y de nadie más: su kit de marca
//                    (lib/kits.js) y lo que ha subido ella.
//
// Lo que se sube vive en la config de la tienda (`propios`) y la imagen en el
// almacén (lib/store.js, como el logo):
//
//   logos   [{id, opaco}]   fotos o PNG para el logo (lib/logo.js)
//   iconos  [{id, nombre}]  un dibujo propio: vale de logo y DENTRO de los sellos,
//                           como la taza o la galleta. Se guarda de UN color
//                           (la silueta, en blanco sobre transparente) para
//                           pintarlo en el color que toque, como los de dibujo.js.
//   fondos  [{id, nombre}]  una foto para el fondo de la banda de los sellos
//
// Un icono en uso se escribe DENTRO del tema (`tema.iconos[id]`, un data URI de
// pocos KB) al guardar: así lo dibujan igual el servidor y la vista previa, sin
// pedir nada a nadie. En el tema la marca es "propia:<id>".
//
// Que solo lo vea su tienda lo garantiza el servidor al guardar (comprobarPropios
// en lib/propiosServidor.js): una marca de un kit ajeno o un id que no está en
// SU lista no se guarda, venga de donde venga.
//
// Puro: lo usan el navegador, el servidor y la validación.
// ============================================================================

export const MAX_PROPIOS = { logos: 12, iconos: 16, fondos: 12 };
export const TIPOS_PROPIOS = ["logos", "iconos", "fondos"];

const ID = /^[0-9a-f]{16,64}$/;
const PREFIJO = "propia:";
const SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;

export const esIdPropio = (id) => ID.test(String(id));
/** "propia:ab12…" -> true. */
export const esMarcaPropia = (m) => typeof m === "string" && m.startsWith(PREFIJO) && ID.test(m.slice(PREFIJO.length));
export const idDeMarca = (m) => (esMarcaPropia(m) ? m.slice(PREFIJO.length) : null);
export const marcaDeIcono = (id) => `${PREFIJO}${id}`;

const nombreLimpio = (v, porDefecto) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : porDefecto);

/** La lista de lo subido, limpia: sin repetidos, sin ids raros y con su tope. */
export function normalizarPropios(p) {
  const o = p && typeof p === "object" ? p : {};
  const lista = (tipo, limpiar) => {
    const vistos = new Set();
    return (Array.isArray(o[tipo]) ? o[tipo] : [])
      .filter((x) => x && ID.test(String(x.id)) && !vistos.has(x.id) && vistos.add(x.id))
      .slice(0, MAX_PROPIOS[tipo])
      .map(limpiar);
  };
  return {
    logos: lista("logos", (x) => ({ id: x.id, opaco: x.opaco === true })),
    iconos: lista("iconos", (x, i) => ({ id: x.id, nombre: nombreLimpio(x.nombre, `Icono ${i + 1}`) })),
    fondos: lista("fondos", (x, i) => ({ id: x.id, nombre: nombreLimpio(x.nombre, `Foto ${i + 1}`) })),
  };
}

/** Añade uno al principio (lo último que se sube, lo primero que se ve). Si ya estaba, sube arriba. */
export function conPropio(propios, tipo, item) {
  const p = normalizarPropios(propios);
  return normalizarPropios({ ...p, [tipo]: [item, ...p[tipo].filter((x) => x.id !== item.id)] });
}

/** Los iconos propios que dibuja este tema y sus cartillas. */
export function iconosEnUso(tema = {}, cartillas = null) {
  const marcas = [tema.marca, ...(Array.isArray(cartillas) ? cartillas.map((c) => c?.marca) : [])];
  return [...new Set(marcas.map(idDeMarca).filter(Boolean))];
}

/** La foto de la banda de un tema, o null. `b` es la tienda: la URL se arma solo con el tema. */
export function fotoDe(tema) {
  const f = tema?.fondoFoto;
  if (!f || typeof f !== "object" || !ID.test(String(f.id)) || !SLUG.test(String(f.b))) return null;
  return { id: f.id, b: f.b };
}

/** Lo que llega del editor para la foto de la banda: válida, null para quitarla, o undefined si no se toca. */
export function validarFondoFoto(v) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  return fotoDe({ fondoFoto: v }) ?? undefined;
}

/** URL pública de la foto de una banda (la sirve /api/fondo; la URL cambia con la foto). */
export const rutaFoto = (f) => (f ? `/api/fondo?b=${f.b}&v=${f.id}` : null);

/** URL de un icono propio de la lista (el editor la pide para enseñar «Tuyos»). */
export const rutaIcono = (b, id) => `/api/fondo?b=${b}&v=${id}&i=1`;
