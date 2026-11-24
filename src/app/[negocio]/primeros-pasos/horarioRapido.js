// ============================================================================
// EL HORARIO RÁPIDO DE LOS PRIMEROS PASOS
// ----------------------------------------------------------------------------
// Tres toques en vez del editor de Tienda: un TIPO de día (mañanas, todo el día,
// mañana y tarde), los DÍAS que abre y las horas de ese tipo. Todos los días
// abiertos comparten horas; lo de cada día distinto y los festivos se queda en
// Tienda → Horario. Lo que sale es el mismo horario de siempre (siete días con
// su lista de tramos o null), así que lo guarda /api/negocio sin saber de esto.
// Todo puro: lo comprueba tests/primerosPasosHorario.test.js.
// ============================================================================

import { ZONA_POR_DEFECTO, aMinutos, aHora, normalizarHorario } from "@/lib/horario";

export const PASO_MIN = 30;
export const MIN_DIA = 0; // 00:00
export const MAX_DIA = 23 * 60 + 30; // 23:30: «HH:MM» no llega más lejos y un cierre a 24:00 no existe
const EJE_INICIO = 6 * 60; // la tira de la semana va de 6:00 a 24:00
const EJE_FIN = 24 * 60;

/** Los tres tipos. `tramos` es lo de partida de cada uno; luego se retoca. */
export const TIPOS = [
  { id: "mananas", nombre: "Mañanas", tramos: [{ abre: "08:00", cierra: "14:00" }] },
  { id: "todo", nombre: "Todo el día", tramos: [{ abre: "08:00", cierra: "20:00" }] },
  { id: "partido", nombre: "Mañana y tarde", tramos: [{ abre: "08:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:30" }] },
];
export const TIPO_DE_PARTIDA = "todo";
export const DIAS_DE_PARTIDA = [0, 1, 2, 3, 4, 5]; // de lunes a sábado

const copiaTramos = (tramos) => tramos.map((t) => ({ ...t }));
export const tipoPorId = (id) => TIPOS.find((t) => t.id === id) || TIPOS.find((t) => t.id === TIPO_DE_PARTIDA);

/** Lo de partida de un tipo (copia: nadie toca la constante). */
export function rapidoDeTipo(tipo, dias = DIAS_DE_PARTIDA) {
  return { tipo, dias: [...dias], tramos: copiaTramos(tipoPorId(tipo).tramos) };
}

// ------------------------------------------------------------------ horas

/** Mueve una hora «HH:MM» `minutos` (negativos, hacia atrás) sin salirse de [min, max]. */
export function mover(hora, minutos, min = MIN_DIA, max = MAX_DIA) {
  const actual = aMinutos(hora);
  if (actual === null) return hora;
  return aHora(Math.min(max, Math.max(min, actual + minutos)));
}

/**
 * Hasta dónde puede ir una hora de un tramo: nunca cierra antes de abrir ni se
 * pisa con el tramo de al lado (queda media hora de descanso como mínimo).
 * @returns {{min:number, max:number}} en minutos
 */
export function limites(tramos, i, campo) {
  const t = tramos[i];
  const antes = tramos[i - 1];
  const despues = tramos[i + 1];
  if (campo === "abre") {
    return { min: antes ? aMinutos(antes.cierra) + PASO_MIN : MIN_DIA, max: aMinutos(t.cierra) - PASO_MIN };
  }
  return { min: aMinutos(t.abre) + PASO_MIN, max: despues ? aMinutos(despues.abre) - PASO_MIN : MAX_DIA };
}

/** ¿Se puede mover esa hora en esa dirección (+1 o -1)? Para apagar el botón. */
export function puedeMover(tramos, i, campo, sentido) {
  const { min, max } = limites(tramos, i, campo);
  const nueva = aMinutos(tramos[i][campo]) + sentido * PASO_MIN;
  return nueva >= min && nueva <= max;
}

/** Los tramos con una hora movida un paso. Si no cabe, los mismos (copia). */
export function moverHora(tramos, i, campo, sentido) {
  if (!tramos[i] || !puedeMover(tramos, i, campo, sentido)) return copiaTramos(tramos);
  return tramos.map((t, j) => (j === i ? { ...t, [campo]: mover(t[campo], sentido * PASO_MIN) } : { ...t }));
}

/** Cada tramo abre antes de cerrar y deja media hora al siguiente. */
export function tramosValidos(tramos) {
  if (!Array.isArray(tramos) || !tramos.length || tramos.length > 2) return false;
  return tramos.every((t, i) => {
    const abre = aMinutos(t?.abre);
    const cierra = aMinutos(t?.cierra);
    if (abre === null || cierra === null || abre >= cierra) return false;
    return i === 0 || abre >= aMinutos(tramos[i - 1].cierra) + PASO_MIN;
  });
}

// ------------------------------------------------------------------- días

/** Abre o cierra un día. Siempre queda alguno abierto: una tienda cerrada toda la semana no es un horario. */
export function alternarDia(dias, i) {
  if (!dias.includes(i)) return [...dias, i].sort((a, b) => a - b);
  return dias.length > 1 ? dias.filter((d) => d !== i) : [...dias];
}

// -------------------------------------------------------- de y a horario

/**
 * El horario de verdad de lo elegido. `zona` y `cerrados` son los que ya tenía la
 * tienda (si tenía): cambiarlo aquí no borra sus festivos.
 * @returns {{zona:string, semana:(object[]|null)[], cerrados:string[]}}
 */
export function horarioDe({ dias, tramos }, { zona = ZONA_POR_DEFECTO, cerrados = [] } = {}) {
  const semana = Array.from({ length: 7 }, (_, i) => (dias.includes(i) ? copiaTramos(tramos) : null));
  return { zona, semana, cerrados: [...cerrados] };
}

/** Qué tipo describe mejor unos tramos: dos tramos, partido; uno que termina a mediodía, mañanas; si no, todo el día. */
function tipoDeTramos(tramos) {
  if (tramos.length > 1) return "partido";
  return aMinutos(tramos[0].cierra) <= 15 * 60 ? "mananas" : "todo";
}

/**
 * Lo elegido a partir de un horario ya guardado, o null si no cabe en el editor
 * rápido (días con horas distintas, o ninguno abierto): entonces se queda tal
 * cual y se cambia desde Tienda.
 * @returns {{tipo:string, dias:number[], tramos:{abre:string,cierra:string}[]}|null}
 */
export function rapidoDe(horario) {
  const limpio = normalizarHorario(horario);
  if (!limpio) return null;
  const dias = limpio.semana.map((d, i) => (d ? i : null)).filter((i) => i !== null);
  if (!dias.length) return null;
  const tramos = limpio.semana[dias[0]];
  const igual = dias.every((i) => JSON.stringify(limpio.semana[i]) === JSON.stringify(tramos));
  if (!igual) return null;
  return { tipo: tipoDeTramos(tramos), dias, tramos: copiaTramos(tramos) };
}

// ------------------------------------------------------- la tira semanal

/**
 * Las barras de un día sobre el eje de 6:00 a 24:00, en fracción (0 a 1) del eje:
 * `desde` donde empieza y `largo` lo que dura. Lo que cae fuera del eje se recorta.
 */
export function barrasDeDia(tramos) {
  const eje = EJE_FIN - EJE_INICIO;
  return (tramos || [])
    .map((t) => ({ a: Math.max(EJE_INICIO, aMinutos(t.abre)), b: Math.min(EJE_FIN, aMinutos(t.cierra)) }))
    .filter((t) => t.b > t.a)
    .map((t) => ({ desde: (t.a - EJE_INICIO) / eje, largo: (t.b - t.a) / eje }));
}
