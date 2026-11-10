import { EM, GLIFOS, KERN, GLIFOS_GRUESOS, KERN_GRUESO } from "./letras";

// ============================================================================
// TEXTO DE VERDAD, DIBUJADO
// ----------------------------------------------------------------------------
// Para escribir una línea normal ("Abierto hasta las 14:00") en una imagen del
// pase. Las letras son los contornos de Inter (lib/apple/letras.js, generado):
// se ven como el texto del iPhone y no dependen de las fuentes del servidor,
// que en serverless no hay. Lo mismo en el .pkpass que en la vista previa.
//
// glifos.js sigue siendo el de la marca (letras cuadradas, en mayúsculas); este
// es para frases.
// ============================================================================

const letras = (texto) => Array.from(String(texto ?? ""));
const glifo = (c, grueso) => (grueso && GLIFOS_GRUESOS[c]) || GLIFOS[c] || GLIFOS[" "];
const kern = (par, grueso) => (grueso ? KERN_GRUESO : KERN)[par] || 0;

/** Ancho de `texto` a `tam` (en las mismas unidades que `tam`). `grueso`: en Bold, solo cifras y barra. */
export function anchoTexto(texto, tam, grueso = false) {
  let ancho = 0;
  let antes = null;
  for (const c of letras(texto)) {
    if (antes) ancho += kern(antes + c, grueso);
    ancho += glifo(c, grueso)[0];
    antes = c;
  }
  return (ancho * tam) / EM;
}

/**
 * Un <g> con el texto, empezando en `x` y con la línea base en `y`. Un carácter
 * que no está en letras.js sale como un espacio (se añade en gen-letras.mjs).
 */
export function svgTexto(texto, { x, y, tam, color, opacidad = 1, grueso = false }) {
  const trazos = [];
  let pos = 0;
  let antes = null;
  for (const c of letras(texto)) {
    if (antes) pos += kern(antes + c, grueso);
    const [avance, d] = glifo(c, grueso);
    if (d) trazos.push(`<path transform="translate(${pos} 0)" d="${d}"/>`);
    pos += avance;
    antes = c;
  }
  const escala = +(tam / EM).toFixed(5);
  const opac = opacidad < 1 ? ` fill-opacity="${opacidad}"` : "";
  return `<g transform="translate(${+x.toFixed(2)} ${+y.toFixed(2)}) scale(${escala})" fill="${color}"${opac}>${trazos.join("")}</g>`;
}
