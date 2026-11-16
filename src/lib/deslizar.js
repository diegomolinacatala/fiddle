// ============================================================================
// DESLIZAR PARA CONFIRMAR (app/Deslizar.js)
// ----------------------------------------------------------------------------
// Lo que no debe pasar sin querer se desliza, no se pulsa. «Deshacer cambios»
// de la caja quedaba justo encima de «Escanear al siguiente» y en La
// Delicantería se tocaba al ir a por el botón de abajo (12-11-2026). Un toque
// no hace nada (el tirador se asoma y vuelve, para enseñar que se desliza).
//
// Al soltar: pasado `UMBRAL`, termina solo; con un tirón rápido hacia la
// derecha, basta con pasar la `MITAD`. Si no, vuelve al principio. Así no hace
// falta clavar el final con el dedo, y un roce no basta.
//
// Funciones puras: el dedo y el reloj llegan de fuera. Las usa app/Deslizar.js
// y las prueban los tests.
// ============================================================================

export const UMBRAL = 0.8;
export const MITAD = 0.5;
/** px/ms hacia la derecha (unos 500 px/s): un tirón, no un arrastre lento. */
export const TIRON = 0.5;
/** Los últimos ms del dedo que cuentan para la velocidad al soltar. */
export const VENTANA_MS = 100;

/** Cuánto lleva (de 0 a 1) con el dedo `dx` px a la derecha de donde empezó, sobre `recorrido` px. */
export function progresoDe(dx, recorrido) {
  if (!(recorrido > 0) || !Number.isFinite(dx)) return 0;
  return Math.min(1, Math.max(0, dx / recorrido));
}

/** ¿Confirma al soltar? `velocidad` en px/ms, positiva hacia la derecha. */
export function confirmaAlSoltar(progreso, velocidad = 0) {
  if (progreso >= UMBRAL) return true;
  return progreso >= MITAD && velocidad >= TIRON;
}

/**
 * La velocidad del dedo en sus últimos `ventana` ms, de un rastro `[{x, t}]` en orden.
 * Si se quedó quieto antes de soltar (o solo hay un punto), es 0: parado no es un tirón.
 */
export function velocidadDe(rastro, ventana = VENTANA_MS) {
  if (!Array.isArray(rastro) || rastro.length < 2) return 0;
  const ultimo = rastro[rastro.length - 1];
  let primero = ultimo;
  for (let i = rastro.length - 2; i >= 0 && ultimo.t - rastro[i].t <= ventana; i -= 1) primero = rastro[i];
  const dt = ultimo.t - primero.t;
  return dt > 0 ? (ultimo.x - primero.x) / dt : 0;
}
