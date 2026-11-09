// ============================================================================
// DE LO QUE VISTE A LO QUE HAY
// ----------------------------------------------------------------------------
// Las cifras y las gráficas del dueño no saltan al número nuevo: se mueven
// desde lo último que vio ESE dispositivo (app/useVisto.js lo recuerda) hasta lo
// de ahora, para que se note lo que ha cambiado. Aquí, la cuenta pura: el valor
// a medio camino de cualquier dato del panel (números sueltos, listas, objetos),
// con la misma forma que el de llegada.
//
// Solo se mueven los números que son cuentas. Las fechas, los días de una
// ventana o una cadencia (FIJOS) van ya con su valor: un `inicio` que saliera
// de 0 diría «desde el 1 de enero de 1970» a media animación.
// ============================================================================

export const FIJOS = new Set([
  "inicio", "ts", "dia", "dias", "d", "hora", "indice", "meta", "cadencia", "cadenciaHabitual",
  "faltanDias", "hacenFalta", "desde", "hasta",
]);

// Con qué se empareja un elemento de una lista con el de antes: la serie de días
// se corre uno cada día y el de la posición 3 ya no es el mismo día.
const LLAVES = ["key", "dia", "indice", "serial", "id"];
const llaveDe = (x) => (x && typeof x === "object" ? LLAVES.find((k) => x[k] !== undefined && x[k] !== null) : undefined);

const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/**
 * El valor a una fracción `t` (0..1) del camino de `a` a `b`. Tiene SIEMPRE la
 * forma de `b`: lo que en `a` no está o no es un número sale ya con su valor.
 * Dos enteros dan entero (son personas o visitas: nadie quiere ver 12,4 clientes).
 */
export function entre(a, b, t) {
  if (typeof b === "number") {
    if (typeof a !== "number" || !Number.isFinite(a) || !Number.isFinite(b) || t >= 1) return b;
    const v = a + (b - a) * Math.max(0, t);
    return Number.isInteger(a) && Number.isInteger(b) ? Math.round(v) : v;
  }
  if (Array.isArray(b)) {
    const antes = Array.isArray(a) ? a : [];
    const k = llaveDe(b[0]);
    const porLlave = k ? new Map(antes.map((x) => [x?.[k], x])) : null;
    return b.map((x, i) => entre(porLlave ? porLlave.get(x?.[k]) : antes[i], x, t));
  }
  if (esObjeto(b)) {
    const antes = esObjeto(a) ? a : {};
    const out = {};
    for (const k of Object.keys(b)) out[k] = FIJOS.has(k) ? b[k] : entre(antes[k], b[k], t);
    return out;
  }
  return b;
}

/** `b` con sus cuentas a cero: de donde sale la primera vez que un dispositivo lo ve. */
export function ceros(b) {
  if (typeof b === "number") return Number.isFinite(b) ? 0 : b;
  if (Array.isArray(b)) return b.map(ceros);
  if (esObjeto(b)) {
    const out = {};
    for (const k of Object.keys(b)) out[k] = FIJOS.has(k) ? b[k] : ceros(b[k]);
    return out;
  }
  return b;
}

/** Más deprisa al principio y frenando al llegar, como una rueda que se para. */
export const frenando = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Cuánto dura: un poco más si hay mucho que contar, nunca tanto que aburra. */
export function duracionDe(a, b) {
  const salto = Math.abs(mayorCambio(a, b));
  if (!salto) return 0;
  return Math.round(Math.min(1600, 700 + Math.log10(salto + 1) * 300));
}

/** El cambio más grande entre dos valores con la misma forma (0 si no cambia nada). */
export function mayorCambio(a, b) {
  if (typeof b === "number") return typeof a === "number" && Number.isFinite(a) && Number.isFinite(b) ? Math.abs(b - a) : 0;
  if (Array.isArray(b)) {
    const antes = Array.isArray(a) ? a : [];
    const k = llaveDe(b[0]);
    const porLlave = k ? new Map(antes.map((x) => [x?.[k], x])) : null;
    return b.reduce((max, x, i) => Math.max(max, mayorCambio(porLlave ? porLlave.get(x?.[k]) : antes[i], x)), 0);
  }
  if (esObjeto(b)) {
    const antes = esObjeto(a) ? a : {};
    return Object.keys(b).reduce((max, k) => (FIJOS.has(k) ? max : Math.max(max, mayorCambio(antes[k], b[k]))), 0);
  }
  return 0;
}
