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

import { ZONA_POR_DEFECTO, relojLocal, fechaLocal, sumarDias, aHora, tramosDe, inicioDelDia } from "./horario";
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
export function actividadDelDia(eventos, fecha, { zona, horario = null, cartillas = 1 }) {
  const tramos = horario ? tramosDe(horario, fecha) : null;
  const filas = [];
  for (const e of eventos || []) {
    const t = Date.parse(e.ts);
    if (!t) continue;
    const { base, cartilla } = tipoBase(e.tipo);
    const clase = CLASES[base];
    if (!clase) continue;
    const reloj = relojLocal(t, zona);
    if (reloj.fecha !== fecha) continue;
    const delPersonal = DEL_PERSONAL.has(e.actor);
    filas.push({
      ts: e.ts,
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
      fueraDeHorario: Boolean(tramos && delPersonal && !tramos.some((r) => reloj.minutos >= r.abre && reloj.minutos < r.cierra)),
    });
  }
  filas.sort((a, b) => a.ts.localeCompare(b.ts));

  const porCartilla = Array.from({ length: Math.max(1, cartillas) }, () => ({ sellos: 0, quitados: 0, premios: 0, guardados: 0 }));
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
    filas,
    totales: { porCartilla, atendidos: atendidos.size, visitas, altas, fueraDeHorario: fuera },
    porHora: [...horas.values()].sort((a, b) => a.hora - b.hora),
  };
}

/**
 * ¿Están TODOS los eventos de ese día? El panel recibe una ventana con tope
 * (`listEventosDeNegocio`): si se llenó, el día más viejo llega a medias, y unas
 * cuentas a medias para cuadrar la caja son peores que ninguna.
 */
export const diaCompleto = (fecha, zona, completoDesde) =>
  !completoDesde || inicioDelDia(fecha, zona) >= Date.parse(completoDesde);
