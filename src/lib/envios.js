// ============================================================================
// ENVIAR UN AVISO: AHORA O A UNA HORA
// ----------------------------------------------------------------------------
// La pestaña «Enviar» de Avisos manda un mensaje a todos o a un grupo, ya o a
// una hora elegida. Las horas que se ofrecen son pocas a propósito:
//
//   HOY     desde ahora hasta el ÚLTIMO cierre del día. Con horario partido el
//           descanso de mediodía cuenta (a las 15:00 de una tienda que abre a
//           las 17:00 se puede mandar "esta tarde, 2x1").
//   MAÑANA  de la primera apertura al PRIMER cierre: la mañana de mañana.
//
// Nada más lejos: lo que se decide con días de antelación eran los avisos
// programados, que ahora están apagados salvo que el admin los encienda.
//
// A QUIÉN. Una clave, nunca una lista: el grupo se vuelve a calcular en el
// servidor AL ENVIAR (no al programar), así que "los que tienen un premio
// pendiente" a las 17:00 son los de las 17:00. Las claves son los grupos del
// CRM (lib/crm.js) y estos destinos que no son grupos:
//
//   todos    la PROMO de la tienda: en todas las tarjetas hasta que se quite
//   momento  un MENSAJE a todos que se quita solo al cerrar ese día. Es lo que
//            piden «lo que dicen los números» ("las tardes de martes están
//            tranquilas"): un aviso para un rato, no una promo para siempre.
//
// Un envío a una hora queda en la config de la tienda (`enviosProgramados`) y
// lo manda el reloj de los avisos (/api/cron/avisos, cada 15 min): por eso las
// horas van de 15 en 15. Si el reloj no anda, la pantalla no deja programar.
//
// Funciones PURAS: las usan la pantalla, el servidor (que comprueba la hora
// que llega con esta misma cuenta) y los tests.
// ============================================================================

import { GRUPOS, LISTA_GRUPOS, esGrupo } from "./crm";
import { relojLocal, tramosDe, sumarDias, aHora, horaCorta, inicioDelDia, cierreTras } from "./horario";

export const PASO_MIN = 15;          // lo que tarda el reloj en volver a pasar
export const MAX_PENDIENTES = 10;    // envíos a una hora esperando, por tienda
export const MAX_TEXTO = { todos: 200, mensaje: 120 };
const MARGEN_MIN = 5;                // la primera hora de hoy, al menos 5 min por delante
const TOLERANCIA_MS = 20 * 60_000;   // la hora elegida hace un rato sigue valiendo al llegar

export const TODOS = "todos";
export const MOMENTO = "momento";

/** Los destinos que no son grupos del CRM. Mismo aspecto que LISTA_GRUPOS. */
export const DESTINOS_ESPECIALES = {
  [TODOS]: {
    label: "Todos los clientes",
    icon: "clientes",
    descripcion: "La promo de la tienda: la ven todas las tarjetas, también las nuevas, hasta que la quites.",
    promo: true,
  },
  [MOMENTO]: {
    label: "Todos, solo ese día",
    icon: "reloj",
    descripcion: "Un mensaje a todos que se quita solo cuando cierra la tienda ese día.",
    idea: "Esta tarde está tranquilo: ven con calma, tu tarjeta sigue sumando.",
    caduca: true,
  },
};

/** ¿Se puede mandar a esa clave? (un grupo del CRM o un destino especial). */
export const esDestino = (clave) => esGrupo(clave) || (typeof clave === "string" && Object.hasOwn(DESTINOS_ESPECIALES, clave));

/** ¿Va a la promo de la tienda (no al pase de cada uno)? */
export const esPromo = (clave) => clave === TODOS;

/** El nombre y la descripción de un destino, para la pantalla y el historial. */
export function infoDestino(clave) {
  if (Object.hasOwn(DESTINOS_ESPECIALES, clave)) return { key: clave, ...DESTINOS_ESPECIALES[clave] };
  const g = LISTA_GRUPOS.find((x) => x.key === clave);
  return g || null;
}

/** ¿Entra este perfil (lib/crm.js perfilDe) en el destino? */
export function incluyeDestino(clave, perfil) {
  if (clave === TODOS || clave === MOMENTO) return true;
  return esGrupo(clave) ? GRUPOS[clave].incluye(perfil) : false;
}

// --------------------------------------------------------------- las horas
/**
 * El instante en que en la tienda son `minutos` de `fecha`. Corrige el cambio
 * de hora: el día que se adelanta el reloj, las 10:00 no están a 600 minutos de
 * las 00:00.
 */
export function instanteLocal(fecha, minutos, zona) {
  let ms = inicioDelDia(fecha, zona) + minutos * 60_000;
  const r = relojLocal(ms, zona);
  if (r.fecha === fecha && r.minutos !== minutos) ms += (minutos - r.minutos) * 60_000;
  return ms;
}

const redondearArriba = (min) => Math.ceil(min / PASO_MIN) * PASO_MIN;

function huecos(fecha, desde, hasta, zona) {
  const out = [];
  for (let m = redondearArriba(desde); m < hasta; m += PASO_MIN) {
    out.push({ cuando: new Date(instanteLocal(fecha, m, zona)).toISOString(), fecha, minutos: m, hora: aHora(m) });
  }
  return out;
}

/**
 * Las horas a las que se puede programar un envío.
 * @returns {{hoy:{cuando:string, fecha:string, minutos:number, hora:string}[], manana:object[], motivo:string|null}}
 *   `motivo` cuando no hay ninguna: "sin_horario" o "cerrada"
 */
export function horasParaEnviar(horario, ahora = Date.now()) {
  if (!horario) return { hoy: [], manana: [], motivo: "sin_horario" };
  const zona = horario.zona;
  const reloj = relojLocal(ahora, zona);

  const deHoy = tramosDe(horario, reloj.fecha);
  const hoy = deHoy.length
    // Antes de abrir, desde que abre: un aviso a las 7:00 a una tienda cerrada no.
    ? huecos(reloj.fecha, Math.max(reloj.minutos + MARGEN_MIN, deHoy[0].abre), deHoy.at(-1).cierra, zona)
    : [];

  const fechaManana = sumarDias(reloj.fecha, 1);
  const deManana = tramosDe(horario, fechaManana);
  const manana = deManana.length ? huecos(fechaManana, deManana[0].abre, deManana[0].cierra, zona) : [];

  return { hoy, manana, motivo: hoy.length || manana.length ? null : "cerrada" };
}

/**
 * ¿Vale esa hora para programar? La comprueba el servidor con la misma cuenta
 * que la pantalla, con algo de margen: entre que se eligió y que llega puede
 * pasar un rato (la hora de "ahora mismo" ya no estaría en la lista).
 * @returns {number|null} el instante, o null si no vale
 */
export function horaValida(horario, cuando, ahora = Date.now()) {
  const ms = Date.parse(cuando);
  if (!Number.isFinite(ms) || ms < ahora - 60_000) return null;
  const { hoy, manana } = horasParaEnviar(horario, ahora - TOLERANCIA_MS);
  return [...hoy, ...manana].some((h) => Date.parse(h.cuando) === ms) ? ms : null;
}

/** "hoy a las 17:30", "mañana a las 9:00". */
export function cuandoEnvioTexto(cuando, horario, ahora = Date.now()) {
  const ms = Date.parse(cuando);
  const zona = horario?.zona;
  const r = relojLocal(ms, zona);
  const hoy = relojLocal(ahora, zona).fecha;
  const dia = r.fecha === hoy ? "hoy" : r.fecha === sumarDias(hoy, 1) ? "mañana" : r.fecha;
  return `${dia} a las ${horaCorta(aHora(r.minutos))}`;
}

/** Cuándo se quita un mensaje de "solo ese día" mandado en `ms`: al último cierre de ese día. */
export function caducidadMomento(horario, ms) {
  const { fecha, minutos } = cierreTras(horario, ms);
  return new Date(instanteLocal(fecha, minutos, horario?.zona)).toISOString();
}

// ---------------------------------------------------- lo que queda esperando
/**
 * Un envío esperando en `negocio.enviosProgramados`:
 *   { id, cuando, destino, texto }                       mandar (a una hora)
 *   { id, cuando, accion: "retirar", texto, seriales }   quitar un "solo ese día"
 */
export function normalizarPendientes(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter((p) => p && typeof p.id === "string" && Number.isFinite(Date.parse(p.cuando)) && (
    p.accion === "retirar" ? Array.isArray(p.seriales) && typeof p.texto === "string" : esDestino(p.destino) && typeof p.texto === "string"
  ));
}

/** Los envíos que ve el manager (los "retirar" son cosa del reloj), por hora. */
export const enviosVisibles = (lista) =>
  normalizarPendientes(lista).filter((p) => p.accion !== "retirar").sort((a, b) => Date.parse(a.cuando) - Date.parse(b.cuando));

/** Los que ya tocan, y los que siguen esperando. */
export function repartirPendientes(lista, ahora = Date.now()) {
  const todos = normalizarPendientes(lista);
  return {
    tocan: todos.filter((p) => Date.parse(p.cuando) <= ahora),
    esperan: todos.filter((p) => Date.parse(p.cuando) > ahora),
  };
}

/** El texto limpio de un envío: recortado a lo que cabe, o null si va vacío. */
export function textoDeEnvio(destino, texto) {
  const max = esPromo(destino) ? MAX_TEXTO.todos : MAX_TEXTO.mensaje;
  return typeof texto === "string" && texto.trim() ? texto.trim().slice(0, max) : null;
}

/**
 * Lo que propone «lo que dicen los números» ("los martes por la tarde", dia 1 y
 * "16:00") llevado a las horas que se pueden elegir: si ese día es hoy o mañana,
 * la hora (o la primera que quede a partir de ella); si no, null y se dice
 * cuándo tocaría.
 * @returns {{cuando:string|null, dia:number|null, hora:string|null}}
 */
export function horaSugerida(horario, { dia = null, hora = null } = {}, ahora = Date.now()) {
  const minutos = typeof hora === "string" && /^\d{2}:\d{2}$/.test(hora) ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null;
  const { hoy, manana } = horasParaEnviar(horario, ahora);
  const r = relojLocal(ahora, horario?.zona);
  const candidatas = [
    ...(dia === null || dia === r.dia ? hoy : []),
    ...(dia === null || dia === (r.dia + 1) % 7 ? manana : []),
  ];
  const elegida = minutos === null ? null : candidatas.find((h) => h.minutos >= minutos) || null;
  return { cuando: elegida?.cuando ?? null, dia: Number.isInteger(dia) ? dia : null, hora: minutos === null ? null : aHora(minutos) };
}
