import { leerImagen } from "./store";
import { kitDe, ESTILOS_DE_KITS } from "./kits";
import { MARCAS_PROPIAS } from "./apple/dibujo";
import { iconosEnUso, fotoDe, idDeMarca } from "./propios";
import { logoImagenDe } from "./logo";

// ============================================================================
// LO TUYO ES SOLO TUYO (servidor)
// ----------------------------------------------------------------------------
// El editor solo enseña a cada tienda lo suyo, pero quien guarda podría mandar
// cualquier cosa. Aquí, antes de guardar una tarjeta (manager o admin):
//   - un dibujo o un diseño de un KIT de marca, solo en la tienda del kit
//   - un icono propio, una foto de banda o un logo, solo si son de SU lista
//     (y de su carpeta: `b` es ella)
// Y de paso se meten en el tema los iconos en uso (`tema.iconos`), para que la
// tarjeta se dibuje igual en el servidor y en el navegador (lib/propios.js).
// ============================================================================

const DATA_PNG = "data:image/png;base64,";

/** Las marcas que trae el patch (lo que cambia): las de antes ya estaban guardadas. */
const marcasDelPatch = (patch) => [patch.tema?.marca, ...(Array.isArray(patch.cartillas) ? patch.cartillas.map((c) => c?.marca) : [])].filter(Boolean);

/**
 * Comprueba lo propio de un patch y le añade los iconos en uso.
 * @returns {Promise<{patch:object} | {error:string}>}
 */
export async function prepararPropios(slug, patch, actual) {
  const kit = kitDe(slug);
  const lista = actual.propios || { logos: [], iconos: [], fondos: [] };

  for (const m of marcasDelPatch(patch)) {
    if (MARCAS_PROPIAS.includes(m) && !kit?.marcas?.[m]) return { error: "Ese dibujo es de la marca de otra tienda" };
    const id = idDeMarca(m);
    if (id && !lista.iconos.some((x) => x.id === id)) return { error: "Ese icono no está entre los tuyos: súbelo otra vez" };
  }
  const estilo = patch.tema?.estilo;
  if (estilo && Object.hasOwn(ESTILOS_DE_KITS, estilo) && !kit?.estilos?.[estilo]) return { error: "Ese diseño es de la marca de otra tienda" };

  const logo = patch.tema?.logoImagen ? logoImagenDe(patch.tema) : null;
  // El logo que ya tenía puesto vale aunque no esté en la lista (se subió antes de que hubiera lista).
  if (logo && (logo.b !== slug || !(lista.logos.some((x) => x.id === logo.id) || logoImagenDe(actual.tema)?.id === logo.id))) {
    return { error: "Esa imagen no está entre las tuyas: súbela otra vez" };
  }
  const foto = patch.tema?.fondoFoto ? fotoDe(patch.tema) : null;
  if (foto && (foto.b !== slug || !lista.fondos.some((x) => x.id === foto.id))) return { error: "Esa foto no está entre las tuyas: súbela otra vez" };

  // Los iconos que la tarjeta dibuja, dentro del tema. Solo si cambian: casi
  // ningún guardado toca el logo ni los sellos.
  const tema = { ...actual.tema, ...(patch.tema || {}) };
  const cartillas = patch.cartillas !== undefined ? patch.cartillas : actual.cartillas;
  const usados = iconosEnUso(tema, cartillas);
  const antes = actual.tema?.iconos || {};
  const iguales = usados.length === Object.keys(antes).length && usados.every((id) => typeof antes[id] === "string");
  if (iguales && !patch.tema) return { patch };
  const iconos = {};
  for (const id of usados) {
    if (typeof antes[id] === "string") { iconos[id] = antes[id]; continue; }
    const png = await leerImagen(slug, id, "png");
    if (!png) return { error: "No se encuentra la imagen de ese icono: súbelo otra vez" };
    iconos[id] = `${DATA_PNG}${png.toString("base64")}`;
  }
  return { patch: { ...patch, tema: { ...(patch.tema || {}), iconos } } };
}

/**
 * El negocio con su foto de banda ya leída (`tema.fotoBanda`), para dibujar en
 * el servidor. Sin foto (o si no se encuentra), tal cual: la banda sale clara.
 */
export async function conFotoBanda(negocio) {
  const f = fotoDe(negocio?.tema);
  if (!f || negocio.tema.banda !== "foto") return negocio;
  const jpg = await leerImagen(f.b, f.id, "jpg").catch(() => null);
  if (!jpg) return negocio;
  return { ...negocio, tema: { ...negocio.tema, fotoBanda: `data:image/jpeg;base64,${jpg.toString("base64")}` } };
}

/** ¿Lo usa la tarjeta ahora mismo? (no se deja quitar de la lista lo que está puesto). */
export function propioEnUso(negocio, tipo, id) {
  if (tipo === "iconos") return iconosEnUso(negocio.tema, negocio.cartillas).includes(id) || iconosEnUso(negocio.tema, negocio.cartillasAparcadas).includes(id);
  if (tipo === "logos") return logoImagenDe(negocio.tema)?.id === id;
  return fotoDe(negocio.tema)?.id === id;
}
