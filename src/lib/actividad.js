// ============================================================================
// LA ACTIVIDAD DE LA CAJA, DÍA A DÍA
// ----------------------------------------------------------------------------
// Para cuadrar con la caja registradora: cada sello debería ser una compra. El
// dueño mira un día, ve cuántos sellos y premios salieron, a qué hora y desde
// dónde, y lo compara con sus tickets. Lo que no cuadra es un error o un sello
// regalado.
//
// No hace falta nada nuevo en la base: cada acción de la caja ya queda en
// `eventos` con su hora y quién la hizo (`actor`). Funciones PURAS: las usan el
// panel y los tests.
//
// Las horas son las de la TIENDA (`horario.zona`), no las del navegador ni las
// del servidor: así el servidor y el navegador pintan lo mismo, y quien mira
// desde otro país ve la hora del ticket.
// ============================================================================

import { ZONA_POR_DEFECTO, relojLocal, fechaLocal, sumarDias, aHora, tramosDe, inicioDelDia, diaDeFecha, abreEl } from "./horario";
import { haceTexto } from "./crm";

export const zonaDe = (negocio) => negocio?.horario?.zona || ZONA_POR_DEFECTO;

/** Días de calendario entre dos fechas "aaaa-mm-dd". */
const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 864e5);

/**
 * Cuándo se le vio por última vez, para la lista de clientes: "hoy, 13:42",
 * "ayer, 18:05" y, más atrás, "hace 3 días". Por días de CALENDARIO de la
 * tienda: algo de anoche a las 23:00 es "ayer", aunque no hayan pasado 24 h.
 */
export function ultimaVezTexto(iso, zona, ahora = Date.now()) {
  const t = Date.parse(iso || "");
  if (!t) return "nunca";
  const hoy = fechaLocal(ahora, zona);
  const { fecha, minutos } = relojLocal(t, zona);
  if (fecha === hoy) return `hoy, ${aHora(minutos)}`;
  if (fecha === sumarDias(hoy, -1)) return `ayer, ${aHora(minutos)}`;
  return haceTexto(Math.max(0, diasEntre(fecha, hoy)));
}

// Los eventos que son un sello (una cartilla o la otra): lo que mira la ficha de
// la caja para decir cuándo fue el último.
export const TIPOS_SELLO = ["sellar", "sellar2"];

/**
 * Cuándo fue el último sello, para la ficha de la caja: "hace un momento",
 * "hace 12 min" y, más atrás, como ultimaVezTexto ("hoy, 13:42", "ayer, 18:05",
 * "hace 3 días"). Solo el cuándo: la cuenta ya la enseña la tarjeta, y la del
 * evento mentiría tras una corrección. null si nunca se le selló: nada que decir.
 * @param {{ts:string}|null} evento el último de TIPOS_SELLO
 */
export function ultimoSelloTexto(evento, zona, ahora = Date.now()) {
  const t = Date.parse(evento?.ts || "");
  if (!t) return null;
  const minutos = Math.floor((ahora - t) / 60000);
  const cuando = minutos < 1 ? "hace un momento" : minutos < 60 ? `hace ${minutos} min` : ultimaVezTexto(evento.ts, zona, ahora);
  return `Último punto ${cuando}`;
}

/** Una fecha de calendario ("2026-10-08") en corto: "jue, 8 oct". No depende de la zona: ya es la de la tienda. */
export const diaCortoTexto = (fecha) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Fecha y hora completas en la tienda: "mié 8 oct 2026, 13:42". Para el `title`. */
export function fechaHoraTexto(iso, zona) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  return new Date(t).toLocaleString("es-ES", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: zona,
  });
}

// Qué es cada evento para las cuentas. Lo que no está aquí (avisos, instalar el
// pase, campañas) no es actividad de la caja y no sale.
const CLASES = {
  sellar: "sello",
  restar: "correccion",
  canjear: "premio",
  usarGuardado: "premio",
  guardar: "guardado",
  confirmar: "visita",
  alta: "alta",
};

/** "sellar2" -> { base: "sellar", cartilla: 1 }. */
function tipoBase(tipo) {
  const segunda = /2$/.test(tipo || "");
  return { base: segunda ? tipo.slice(0, -1) : tipo, cartilla: segunda ? 1 : 0 };
}

/**
 * Qué es un evento para las cuentas de la caja (aquí y en lib/plantilla.js):
 * `{ base, cartilla, clase }`, o null si no es actividad de la caja.
 */
export function clasificar(tipo) {
  const { base, cartilla } = tipoBase(tipo);
  const clase = CLASES[base];
  return clase ? { base, cartilla, clase } : null;
}

// Lo hace alguien de la tienda: solo eso puede estar "fuera de horario". Un alta
// por el QR a las 23:00 es un cliente en su casa, no la caja.
const DEL_PERSONAL = new Set(["caja", "manager", "admin"]);

/**
 * Lo que pasó en la caja un día (en la tienda), con las cuentas hechas.
 *
 * @param {{serial:string, tipo:string, mensaje:string, actor?:string, ts:string}[]} eventos
 * @param {string} fecha  "aaaa-mm-dd"
 * @param {{zona:string, horario?:object|null, cartillas:number}} opciones
 */
export const actividadDelDia = (eventos, fecha, opciones) => actividadDelRango(eventos, fecha, fecha, opciones);

/**
 * Lo mismo para varios días seguidos (una semana, un mes): las cuentas sumadas,
 * la hora a hora sumada y, además, una fila por día (`porDia`, también los días
 * sin nada y los cerrados) para encontrar el que no cuadra.
 *
 * `hastaMinutos` corta el último día a esa hora: es lo que deja comparar una
 * semana a medias con los mismos días y horas de la anterior (periodoAnterior).
 *
 * @param {object[]} eventos
 * @param {string} desde "aaaa-mm-dd"
 * @param {string} hasta "aaaa-mm-dd", incluido
 * @param {{zona:string, horario?:object|null, cartillas:number, hastaMinutos?:number|null}} opciones
 */
export function actividadDelRango(eventos, desde, hasta, { zona, horario = null, cartillas = 1, hastaMinutos = null }) {
  const tramosDelDia = new Map();
  const tramosDeFecha = (fecha) => {
    if (!tramosDelDia.has(fecha)) tramosDelDia.set(fecha, tramosDe(horario, fecha));
    return tramosDelDia.get(fecha);
  };
  const filas = [];
  for (const e of eventos || []) {
    const t = Date.parse(e.ts);
    if (!t) continue;
    const { base, cartilla } = tipoBase(e.tipo);
    const clase = CLASES[base];
    if (!clase) continue;
    const reloj = relojLocal(t, zona);
    if (reloj.fecha < desde || reloj.fecha > hasta) continue;
    if (hastaMinutos !== null && reloj.fecha === hasta && reloj.minutos > hastaMinutos) continue;
    const delPersonal = DEL_PERSONAL.has(e.actor);
    filas.push({
      ts: e.ts,
      fecha: reloj.fecha,
      hora: aHora(reloj.minutos),
      minutos: reloj.minutos,
      serial: e.serial,
      tipo: e.tipo,
      clase,
      cartilla: ["sello", "correccion", "premio", "guardado"].includes(clase) ? cartilla : null,
      mensaje: e.mensaje,
      actor: e.actor || null,
      // Quién de la plantilla (lib/plantilla.js): la columna «Quién» lo enseña por su nombre.
      empleado: e.empleado || null,
      // Sin horario no hay "fuera": no se acusa a nadie con un dato que no existe.
      fueraDeHorario: Boolean(horario && delPersonal && !tramosDeFecha(reloj.fecha).some((r) => reloj.minutos >= r.abre && reloj.minutos < r.cierra)),
    });
  }
  filas.sort((a, b) => a.ts.localeCompare(b.ts));

  const n = Math.max(1, cartillas);
  const cuentas = cuentasDe(filas, n);
  const dias = new Map();
  for (const f of filas) {
    if (!dias.has(f.fecha)) dias.set(f.fecha, []);
    dias.get(f.fecha).push(f);
  }
  const porDia = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    const { totales } = cuentasDe(dias.get(fecha) || [], n);
    porDia.push({ fecha, ...totales, cerrado: Boolean(horario) && !abreEl(horario, fecha) });
  }
  return { filas, ...cuentas, porDia };
}

/** Las cuentas de unas filas ya filtradas: totales y hora a hora. */
function cuentasDe(filas, cartillas) {
  const porCartilla = Array.from({ length: cartillas }, () => ({ sellos: 0, quitados: 0, premios: 0, guardados: 0 }));
  const cuenta = { sello: "sellos", correccion: "quitados", premio: "premios", guardado: "guardados" };
  const atendidos = new Set();
  let visitas = 0;
  let altas = 0;
  let fuera = 0;
  const horas = new Map();
  for (const f of filas) {
    if (f.clase === "alta") { altas += 1; continue; }
    atendidos.add(f.serial);
    if (f.fueraDeHorario) fuera += 1;
    if (f.clase === "visita") { visitas += 1; continue; }
    const k = porCartilla[f.cartilla] || porCartilla[0];
    k[cuenta[f.clase]] += 1;
    const h = Math.floor(f.minutos / 60);
    if (!horas.has(h)) horas.set(h, { hora: h, sellos: Array(porCartilla.length).fill(0), quitados: 0, premios: 0 });
    const fila = horas.get(h);
    if (f.clase === "sello") fila.sellos[f.cartilla] = (fila.sellos[f.cartilla] || 0) + 1;
    if (f.clase === "correccion") fila.quitados += 1;
    if (f.clase === "premio") fila.premios += 1;
  }
  return {
    totales: { porCartilla, atendidos: atendidos.size, visitas, altas, fueraDeHorario: fuera },
    porHora: [...horas.values()].sort((a, b) => a.hora - b.hora),
  };
}

// ----------------------------------------------------------------------------
// EL PERIODO QUE SE MIRA
// Quien abre el panel una vez a la semana quiere la semana de golpe, no siete
// días sueltos. Un periodo es `{ modo, desde, hasta }` en fechas de la tienda:
// "dia", "semana" (de lunes a domingo), "mes" o "fechas" (desde y hasta a mano).
// ----------------------------------------------------------------------------

export const MODOS = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]];

/** "2026-01-31" + 1 mes = "2026-02-28": el día se queda dentro del mes. */
function sumarMeses(fecha, n) {
  const [a, m, d] = fecha.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth(), Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** El periodo de ese modo que contiene `fecha`. */
export function periodoDe(modo, fecha) {
  if (modo === "semana") {
    const lunes = sumarDias(fecha, -diaDeFecha(fecha));
    return { modo, desde: lunes, hasta: sumarDias(lunes, 6) };
  }
  if (modo === "mes") {
    const desde = `${fecha.slice(0, 7)}-01`;
    return { modo, desde, hasta: sumarDias(sumarMeses(desde, 1), -1) };
  }
  return { modo: "dia", desde: fecha, hasta: fecha };
}

/** Unas fechas elegidas a mano, en orden. */
export const periodoDeFechas = (a, b) => ({ modo: "fechas", desde: a < b ? a : b, hasta: a < b ? b : a });

/** El periodo de al lado (`pasos` -1, el anterior). Unas fechas a mano se mueven por su largo. */
export function moverPeriodo(p, pasos) {
  if (p.modo === "mes") return periodoDe("mes", sumarMeses(p.desde, pasos));
  if (p.modo === "semana") return periodoDe("semana", sumarDias(p.desde, 7 * pasos));
  if (p.modo === "dia") return periodoDe("dia", sumarDias(p.desde, pasos));
  const largo = diasEntre(p.desde, p.hasta) + 1;
  return { modo: "fechas", desde: sumarDias(p.desde, largo * pasos), hasta: sumarDias(p.hasta, largo * pasos) };
}

/** ¿Llega hasta hoy? Esta semana, este mes: aún no ha acabado. */
export const enCurso = (p, hoy) => p.desde <= hoy && p.hasta >= hoy;

/**
 * Con qué se compara un periodo: el anterior. Si el de ahora no ha acabado
 * (esta semana, un jueves a mediodía), solo los MISMOS días del anterior y,
 * del último, hasta la misma hora: cuatro días contra una semana entera
 * saldrían siempre a la baja.
 * @returns {{modo:string, desde:string, hasta:string, hastaMinutos:number|null}}
 */
export function periodoAnterior(p, hoy, minutosAhora) {
  const antes = moverPeriodo(p, -1);
  if (!enCurso(p, hoy)) return { ...antes, hastaMinutos: null };
  const hasta = sumarDias(antes.desde, diasEntre(p.desde, hoy));
  // El mes de antes puede ser más corto: el 31 de octubre se compara con todo septiembre.
  return hasta > antes.hasta ? { ...antes, hastaMinutos: null } : { ...antes, hasta, hastaMinutos: minutosAhora };
}

/**
 * ¿Se puede comparar con el anterior sin mentir? Solo si la tienda ya existía
 * entonces (`primeraAlta`, como las flechas del Resumen) y el panel tiene ENTERO
 * ese periodo (`historialCompletoDesde`, ver diaCompleto).
 */
export const comparable = (anterior, { zona, primeraAlta, completoDesde }) =>
  Number.isFinite(primeraAlta) && fechaLocal(primeraAlta, zona) <= anterior.desde && diaCompleto(anterior.desde, zona, completoDesde);

const fechaLarga = (fecha, opciones) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { ...opciones, timeZone: "UTC" });
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** "6 – 12 oct", "29 sep – 5 oct". Para debajo del título de una semana o unas fechas. */
export function rangoCorto(desde, hasta) {
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  const ini = fechaLarga(desde, mismoMes ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${ini} – ${fechaLarga(hasta, { day: "numeric", month: "short" })}`;
}

/** "octubre de 2026": entre las flechas del modo Mes. */
export const mesTexto = (fecha) => fechaLarga(fecha, { month: "long", year: "numeric" });

/** El título del periodo: "Hoy", "Esta semana", "Septiembre", "Del 1 al 15 de octubre". */
export function nombrePeriodo(p, hoy) {
  if (p.modo === "dia") {
    if (p.desde === hoy) return "Hoy";
    if (p.desde === sumarDias(hoy, -1)) return "Ayer";
    return mayuscula(fechaLarga(p.desde, { weekday: "long", day: "numeric", month: "long" }));
  }
  if (p.modo === "semana") {
    if (enCurso(p, hoy)) return "Esta semana";
    if (enCurso(p, sumarDias(hoy, -7))) return "La semana pasada";
    return `Semana del ${fechaLarga(p.desde, { day: "numeric", month: "long" })}`;
  }
  if (p.modo === "mes") {
    if (enCurso(p, hoy)) return "Este mes";
    const otroAno = p.desde.slice(0, 4) !== hoy.slice(0, 4);
    return mayuscula(fechaLarga(p.desde, otroAno ? { month: "long", year: "numeric" } : { month: "long" }));
  }
  const mismoMes = p.desde.slice(0, 7) === p.hasta.slice(0, 7);
  const ini = fechaLarga(p.desde, mismoMes ? { day: "numeric" } : { day: "numeric", month: "long" });
  return `Del ${ini} al ${fechaLarga(p.hasta, { day: "numeric", month: "long" })}`;
}

/** Contra qué van las flechas, dicho una vez encima de las cifras. */
export function textoComparacion(p, hoy) {
  const mismos = enCurso(p, hoy);
  if (p.modo === "semana") return mismos ? "los mismos días de la semana pasada" : "la semana anterior";
  if (p.modo === "mes") return mismos ? "los mismos días del mes pasado" : "el mes anterior";
  if (p.modo === "dia") return "el día anterior";
  const largo = diasEntre(p.desde, p.hasta) + 1;
  return `los ${largo} días de antes`;
}

/**
 * ¿Están TODOS los eventos de ese día? El panel recibe una ventana con tope
 * (`listEventosDeNegocio`): si se llenó, el día más viejo llega a medias, y unas
 * cuentas a medias para cuadrar la caja son peores que ninguna.
 */
export const diaCompleto = (fecha, zona, completoDesde) =>
  !completoDesde || inicioDelDia(fecha, zona) >= Date.parse(completoDesde);
