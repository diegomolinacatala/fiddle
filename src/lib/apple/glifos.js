// ============================================================================
// TIPOGRAFÍA CUADRADA (vectorial)
// ----------------------------------------------------------------------------
// En serverless no hay fuentes fiables: si el .pkpass llevara un <text>, el
// servidor lo pintaría con lo que encontrase (o con nada). Así que las letras
// se DIBUJAN, igual que el resto de la marca.
//
// Cada glifo son líneas rectas sobre una rejilla de 6 x 10, sin curvas y con
// las esquinas en ángulo: de ahí sale el aire "cuadrado". Sirve para poner las
// iniciales o el número de una tienda como logo ("68", "NC", "FR"…).
// ============================================================================

export const ANCHO = 6;   // ancho de un glifo en unidades de rejilla
export const ALTO = 10;   // alto
export const SEPARACION = 2.4; // hueco entre glifos
export const GROSOR = 1.7; // grosor del trazo, en las mismas unidades

// Cada glifo es una lista de polilíneas "x,y x,y x,y".
const GLIFOS = {
  0: ["0,0 6,0 6,10 0,10 0,0"],
  1: ["1,2 3,0 3,10"],
  2: ["0,0 6,0 6,5 0,5 0,10 6,10"],
  3: ["0,0 6,0 6,10 0,10", "2,5 6,5"],
  4: ["0,0 0,5 6,5", "5,0 5,10"],
  5: ["6,0 0,0 0,5 6,5 6,10 0,10"],
  6: ["6,0 0,0 0,10 6,10 6,5 0,5"],
  7: ["0,0 6,0 6,10"],
  8: ["0,0 6,0 6,10 0,10 0,0", "0,5 6,5"],
  9: ["6,5 0,5 0,0 6,0 6,10 0,10"],
  A: ["0,10 0,0 6,0 6,10", "0,5 6,5"],
  B: ["0,10 0,0 6,0 6,5 0,5", "6,5 6,10 0,10"],
  C: ["6,0 0,0 0,10 6,10"],
  D: ["0,0 4,0 6,2 6,10 0,10 0,0"],
  E: ["6,0 0,0 0,10 6,10", "0,5 4,5"],
  F: ["6,0 0,0 0,10", "0,5 4,5"],
  G: ["6,0 0,0 0,10 6,10 6,5 3,5"],
  H: ["0,0 0,10", "6,0 6,10", "0,5 6,5"],
  I: ["3,0 3,10", "1,0 5,0", "1,10 5,10"],
  J: ["6,0 6,10 0,10 0,7"],
  K: ["0,0 0,10", "6,0 0,5 6,10"],
  L: ["0,0 0,10 6,10"],
  M: ["0,10 0,0 3,4 6,0 6,10"],
  N: ["0,10 0,0 6,10 6,0"],
  O: ["0,0 6,0 6,10 0,10 0,0"],
  P: ["0,10 0,0 6,0 6,5 0,5"],
  Q: ["0,0 6,0 6,10 0,10 0,0", "3,7 6,10"],
  R: ["0,10 0,0 6,0 6,5 0,5", "2,5 6,10"],
  S: ["6,0 0,0 0,5 6,5 6,10 0,10"],
  T: ["0,0 6,0", "3,0 3,10"],
  U: ["0,0 0,10 6,10 6,0"],
  V: ["0,0 3,10 6,0"],
  W: ["0,0 1,10 3,4 5,10 6,0"],
  X: ["0,0 6,10", "6,0 0,10"],
  Y: ["0,0 3,5 6,0", "3,5 3,10"],
  Z: ["0,0 6,0 0,10 6,10"],
  "-": ["1,5 5,5"],
  "+": ["1,5 5,5", "3,3 3,7"],
  "&": ["6,10 1,2 3,0 5,2 0,7 2,10 6,6"],
};

/** ¿Se sabe dibujar este carácter? */
export const hayGlifo = (c) => Object.hasOwn(GLIFOS, c);

/**
 * Deja un texto en lo que se puede dibujar: mayúsculas, sin acentos y sin
 * caracteres raros. Máximo 4 glifos (más no cabe en un logo de 50pt).
 * @returns {string} puede quedar vacío si no se salva nada
 */
export function normalizarTextoMarca(texto, max = 4) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // café -> cafe
    .toUpperCase()
    .split("")
    .filter(hayGlifo)
    .slice(0, max)
    .join("");
}

/** Ancho, en unidades de rejilla, de un texto ya normalizado (sin el trazo). */
export const anchoDeTexto = (n) => (n > 0 ? n * ANCHO + (n - 1) * SEPARACION : 0);

/**
 * Texto en tipografía cuadrada, centrado en (cx, cy) y con la altura pedida.
 * Devuelve SVG suelto, listo para meter dentro de otro <svg>.
 *
 * @param {string} texto  se normaliza aquí dentro
 * @param {{cx:number, cy:number, alto:number, color:string}} opciones
 * @returns {string} "" si no queda nada que dibujar
 */
export function svgTextoCuadrado(texto, { cx, cy, alto, color }) {
  const letras = normalizarTextoMarca(texto);
  if (!letras) return "";

  // El trazo sobresale medio grosor por cada lado: cuenta para el tamaño real.
  const unidad = alto / (ALTO + GROSOR);
  const ancho = anchoDeTexto(letras.length);
  const x0 = cx - (ancho * unidad) / 2;
  const y0 = cy - (ALTO * unidad) / 2;

  const trazos = letras
    .split("")
    .map((c, i) => {
      const dx = i * (ANCHO + SEPARACION);
      return GLIFOS[c].map((puntos) => `<polyline points="${puntos}" transform="translate(${dx} 0)"/>`).join("");
    })
    .join("");

  return `<g transform="translate(${x0} ${y0}) scale(${unidad})" fill="none" stroke="${color}"
    stroke-width="${GROSOR}" stroke-linecap="square" stroke-linejoin="miter">${trazos}</g>`;
}
