import { META_WEB, PUNTOS_WEB } from "../tarjeta/opciones";

// ============================================================================
// LO QUE PASA EN LA WEB (/home) AL TOCAR, SIN NADA DE REACT
// ----------------------------------------------------------------------------
// La web es un recorrido con UNA tarjeta, la del visitante, y una pregunta en cada
// pantalla: la diseña, la prueba sumando puntos, la guarda dejando su contacto y
// entonces ve los precios. Aquí van las reglas de ese recorrido, puras, para poder
// fijarlas con tests.
// ============================================================================

/**
 * Los pasos, en el orden en que se recorren. `id` es también el hash de la URL
 * (`#premios`; `hola` va sin hash). `parte` es lo que encuadra la cámara de la
 * tarjeta; `seccion` es el paso de diseño de tarjeta/opciones.js que lo pinta.
 * `precios` no es un paso del panel: es otra pantalla, con scroll.
 */
export const PASOS = [
  { id: "hola", nombre: "Tu cafetería", parte: "todo" },
  { id: "premios", nombre: "Premios", parte: "todo", seccion: "cuantas" },
  { id: "puntos", nombre: "Puntos", parte: "banda", seccion: "puntos" },
  { id: "color", nombre: "Color", parte: "todo", seccion: "color" },
  { id: "icono", nombre: "Icono", parte: "cabecera banda", seccion: "icono" },
  { id: "prueba", nombre: "Pruébala", parte: "todo" },
  { id: "guarda", nombre: "Guárdala", parte: "todo" },
  { id: "precios", nombre: "Precios", parte: "todo" },
];

const PASO_FINAL = "precios";
/** Los que se ven en el panel (y se cuentan en «3 de 7»): todos menos los precios. */
export const PASOS_DEL_PANEL = PASOS.filter((p) => p.id !== PASO_FINAL);

const indice = (id) => PASOS.findIndex((p) => p.id === id);
export const indiceDe = indice;
export const pasoPorId = (id) => PASOS[indice(id)] ?? PASOS[0];

/** El hash de un paso: `hola` es la portada y va sin hash. */
export const hashDe = (id) => (id === "hola" ? "" : `#${id}`);

/**
 * El paso que dice un hash. Uno desconocido es `hola`. A los precios solo se llega
 * habiendo pasado por `guarda` en esta visita (`puedePrecios`): por URL directa,
 * se cae en `guarda`.
 */
export function pasoDeHash(hash, { puedePrecios = false } = {}) {
  const id = String(hash || "").replace(/^#/, "");
  if (indice(id) < 0) return "hola";
  if (id === PASO_FINAL && !puedePrecios) return "guarda";
  return id;
}

/** El paso que sigue, o null tras el último. */
export const siguienteDe = (id) => PASOS[indice(id) + 1]?.id ?? null;

/** El paso anterior, o null en el primero. */
export const anteriorDe = (id) => (indice(id) > 0 ? PASOS[indice(id) - 1].id : null);

/** Lo recorrido, de 0 a 1. Cada paso del panel deja ver algo de barra; los precios, toda. */
export function avanceDe(id) {
  const i = indice(id);
  if (i < 0) return 0;
  return Math.min(1, (i + 1) / PASOS_DEL_PANEL.length);
}

export const PUNTOS_DE_PARTIDA = PUNTOS_WEB;

/**
 * La tarjeta tras tocar «Sumar punto» en la prueba. Con la cartilla llena, el
 * toque siguiente da el premio y la vacía, como en la caja de verdad.
 * @returns {{ puntos: number, premio: boolean }} `premio`: este toque lo ha dado
 */
export function trasSumar(puntos, meta = META_WEB) {
  if (puntos >= meta) return { puntos: 0, premio: true };
  return { puntos: puntos + 1, premio: false };
}

/**
 * Las promociones de la prueba: valen para cualquier local y caben en el campo
 * PROMO del pase (con un texto largo, iOS lo corta con «…»).
 */
export const PROMOS = ["Hoy, 2x1 hasta las 12", "Esta tarde, puntos dobles", "Mañana abrimos a las 8"];

/** La promoción que sale tras haber enviado `envios`: va rotando y da la vuelta. */
export const promoTras = (envios) => PROMOS[Math.max(0, Math.floor(envios)) % PROMOS.length];

/** ¿Está llena? Entonces el botón ya no suma: da el premio. */
export const cartillaLlena = (puntos, meta = META_WEB) => puntos >= meta;
