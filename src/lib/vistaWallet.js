// ============================================================================
// CÓMO COLOCA WALLET EL TEXTO (para la vista previa)
// ----------------------------------------------------------------------------
// El pase lo pinta el iPhone, no nosotros: lo que hay aquí es lo que se ve que
// hace iOS con los campos, medido en pases de verdad, para que la vista previa
// no prometa algo que en el teléfono sale cortado.
//
//   · La fila bajo la banda reparte el sitio como "space-between": cada campo
//     ocupa lo que mide su texto, el primero pegado a la izquierda y el último a
//     la derecha. Si no caben, se reparten el ancho.
//   · Un valor que no cabe primero ENCOGE, luego pasa a DOS líneas (más
//     pequeño aún) y, si tampoco, la segunda línea acaba en "…".
//
// Funciones puras: reciben `medir(texto, tam)` (ancho en px a ese tamaño), que
// en el navegador es un canvas y en los tests una regla de tres.
// ============================================================================

/** Ancho aproximado, para el servidor y el primer pintado (no hay canvas). */
export const medirAprox = (texto, tam) => String(texto ?? "").length * tam * 0.55;

/**
 * Parte `texto` en líneas de como mucho `ancho`, palabra a palabra. Una palabra
 * que sola ya no cabe se corta por letras.
 */
export function partir(texto, ancho, tam, medir) {
  const lineas = [];
  let actual = "";
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (medir(prueba, tam) <= ancho) { actual = prueba; continue; }
    if (actual) lineas.push(actual);
    actual = palabra;
    while (medir(actual, tam) > ancho && actual.length > 1) {
      let corte = actual.length - 1;
      while (corte > 1 && medir(actual.slice(0, corte), tam) > ancho) corte--;
      lineas.push(actual.slice(0, corte));
      actual = actual.slice(corte);
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
}

/** Lo que quepa de `texto` en `ancho`, con "…" al final si se ha cortado. */
export function recortar(texto, ancho, tam, medir) {
  const t = String(texto);
  if (medir(t, tam) <= ancho) return t;
  let n = t.length;
  while (n > 0 && medir(`${t.slice(0, n).trimEnd()}…`, tam) > ancho) n--;
  return `${t.slice(0, n).trimEnd()}…`;
}

/**
 * Cómo sale un valor en `ancho`: su tamaño de letra y sus líneas (1 o 2).
 * @returns {{tam:number, lineas:string[], cortado:boolean}}
 */
export function encajar(texto, ancho, medir, { max, min = max * 0.55 }) {
  const t = String(texto ?? "");
  const paso = 0.5;
  // 1. Una línea, encogiendo un poco (hasta el 80 %).
  for (let tam = max; tam >= max * 0.8 - 1e-9; tam -= paso) {
    if (medir(t, tam) <= ancho) return { tam, lineas: [t], cortado: false };
  }
  // 2. Dos líneas, encogiendo hasta el mínimo.
  for (let tam = max * 0.8; tam >= min - 1e-9; tam -= paso) {
    const lineas = partir(t, ancho, tam, medir);
    if (lineas.length <= 2) return { tam, lineas, cortado: false };
  }
  // 3. Ni así: dos líneas al mínimo y la segunda con "…".
  const lineas = partir(t, ancho, min, medir);
  return { tam: min, lineas: [lineas[0], recortar(lineas.slice(1).join(" "), ancho, min, medir)], cortado: true };
}

/**
 * Anchos de los campos de una fila. Si caben a su tamaño natural, ese; si no,
 * a partes iguales, y lo que le sobre a uno corto se lo quedan los largos.
 * @param {number[]} naturales  lo que mide cada campo con su letra entera
 * @param {number} total        ancho de la fila
 * @param {number} hueco        separación mínima entre campos
 */
export function repartir(naturales, total, hueco) {
  const sitio = total - hueco * Math.max(0, naturales.length - 1);
  if (naturales.reduce((a, b) => a + b, 0) <= sitio) return [...naturales];
  const anchos = naturales.map(() => null);
  let libre = sitio;
  let pendientes = naturales.map((_, i) => i);
  // Los que caben en su parte se quedan con lo suyo; repetir hasta que no quede ninguno así.
  for (;;) {
    const parte = libre / pendientes.length;
    const cortos = pendientes.filter((i) => naturales[i] <= parte);
    if (!cortos.length) {
      for (const i of pendientes) anchos[i] = parte;
      return anchos;
    }
    for (const i of cortos) { anchos[i] = naturales[i]; libre -= naturales[i]; }
    pendientes = pendientes.filter((i) => !cortos.includes(i));
    if (!pendientes.length) return anchos;
  }
}
