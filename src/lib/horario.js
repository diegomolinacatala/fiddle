// ============================================================================
// HORARIO DE LA TIENDA
// ----------------------------------------------------------------------------
// Para que los avisos automáticos salgan con la tienda abierta: un "¿te pasas
// esta tarde?" a las 17:00 de un viernes que cierra a las 16:30 es peor que no
// decir nada. Y para contar bien los "días seguidos": si cierra los domingos,
// sábado y lunes son seguidos.
//
// Funciones PURAS: las usan el reloj del servidor (que vive en UTC) y la
// pantalla del manager, y los dos tienen que ver la misma hora de la tienda.
// Por eso la hora local sale siempre de `zona`, nunca del reloj de la máquina.
//
//   horario = {
//     zona:     "Europe/Madrid",
//     semana:   [ {abre:"07:30", cierra:"18:30"} | null ] × 7   (0 = lunes)
//     cerrados: ["2026-10-09", …]   festivos y vacaciones
//   }
//
// Sin horario (null) estas funciones la tratan como abierta siempre, pero el
// motor (lib/motorAvisos.js) no manda nada solo a una tienda sin horario: la
// pantalla pide ponerlo.
// ============================================================================

export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
export const ZONA_POR_DEFECTO = "Europe/Madrid";

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CERRADOS = 120; // un año de festivos y vacaciones sobra

/** "07:30" -> 450. null si no es una hora. */
export function aMinutos(hora) {
  const m = HORA.exec(String(hora ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 450 -> "07:30". */
export const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "07:30" -> "7:30": como se dice en voz alta. */
export const horaCorta = (hora) => String(hora).replace(/^0(\d)/, "$1");

export const esHora = (v) => aMinutos(v) !== null;

export function esZona(zona) {
  if (typeof zona !== "string" || !zona) return false;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

// Ida y vuelta: Date.parse acepta un 30 de febrero y lo pasa a marzo sin decir nada.
const esFecha = (v) => typeof v === "string" && FECHA.test(v) && new Date(`${v}T12:00:00Z`).toISOString().startsWith(v);

/**
 * Deja un horario limpio, o null si no vale. Un día sin tramo (o con el cierre
 * antes de la apertura) cuenta como cerrado: mejor eso que inventarse la hora.
 */
export function normalizarHorario(h) {
  if (!h || typeof h !== "object" || !Array.isArray(h.semana) || h.semana.length !== 7) return null;
  const semana = h.semana.map((t) => {
    const abre = aMinutos(t?.abre);
    const cierra = aMinutos(t?.cierra);
    return abre !== null && cierra !== null && abre < cierra ? { abre: aHora(abre), cierra: aHora(cierra) } : null;
  });
  const cerrados = Array.isArray(h.cerrados)
    ? [...new Set(h.cerrados.filter(esFecha))].sort().slice(0, MAX_CERRADOS)
    : [];
  return { zona: esZona(h.zona) ? h.zona : ZONA_POR_DEFECTO, semana, cerrados };
}

// Un formateador por zona: crearlos cuesta, y el reloj pasa por aquí por cada cliente.
const formatos = new Map();
function partes(ms, zona) {
  const z = esZona(zona) ? zona : ZONA_POR_DEFECTO;
  if (!formatos.has(z)) {
    formatos.set(z, new Intl.DateTimeFormat("en-GB", {
      timeZone: z, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }));
  }
  const p = Object.fromEntries(formatos.get(z).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** Día de la semana de una fecha de calendario (0 = lunes). No depende de la zona. */
export const diaDeFecha = (fecha) => (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7;

/** "2026-09-24" + 1 -> "2026-09-25". */
export const sumarDias = (fecha, n) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/**
 * Qué hora es EN LA TIENDA.
 * @returns {{fecha:string, dia:number, minutos:number}} dia 0 = lunes
 */
export function relojLocal(ms, zona) {
  const { fecha, minutos } = partes(ms, zona);
  return { fecha, dia: diaDeFecha(fecha), minutos };
}

/** Fecha de calendario de un instante, en la tienda ("2026-09-24"). */
export const fechaLocal = (ms, zona) => partes(ms, zona).fecha;

/**
 * El instante en que empieza `fecha` EN LA TIENDA (sus 00:00, no las de UTC).
 * Con `${fecha}T00:00:00Z` una tienda de Nueva York empezaría el día a las 20:00
 * del anterior.
 */
export function inicioDelDia(fecha, zona) {
  const utc = Date.parse(`${fecha}T00:00:00Z`);
  const p = partes(utc, zona);
  const desfase = Date.parse(`${p.fecha}T00:00:00Z`) + p.minutos * 60_000 - utc;
  return utc - desfase;
}

/**
 * Cuándo cierra la tienda por primera vez después de `ms`: {fecha, minutos}.
 * Es cuando caduca un mensaje de "solo ese día". Mandado con la tienda cerrada
 * (un domingo, de noche), dura hasta el cierre del siguiente día que abre.
 */
export function cierreTras(horario, ms) {
  const { fecha, minutos } = partes(ms, horario?.zona);
  for (let i = 0; i < 15; i += 1) {
    const f = sumarDias(fecha, i);
    const tramo = tramoDe(horario, f);
    if (tramo && (i > 0 || minutos < tramo.cierra)) return { fecha: f, minutos: tramo.cierra };
  }
  return { fecha: sumarDias(fecha, 1), minutos: 0 }; // dos semanas cerrada: al día siguiente, y listo
}

/**
 * Tramo abierto de ese día en minutos, o null si cierra (día libre o festivo).
 * Sin horario: abierta todo el día.
 */
export function tramoDe(horario, fecha) {
  if (!horario) return { abre: 0, cierra: 24 * 60 };
  if (horario.cerrados?.includes(fecha)) return null;
  const t = horario.semana?.[diaDeFecha(fecha)];
  if (!t) return null;
  return { abre: aMinutos(t.abre), cierra: aMinutos(t.cierra) };
}

export const abreEl = (horario, fecha) => tramoDe(horario, fecha) !== null;

/**
 * Los `n` días de apertura anteriores a `fecha` (sin contarla), del más cercano
 * al más lejano. Lo que cuenta como "días seguidos": el domingo cerrado no rompe
 * la racha de sábado a lunes.
 */
export function diasAbiertosAntes(horario, fecha, n, tope = 60) {
  const out = [];
  for (let i = 1; out.length < n && i <= tope; i += 1) {
    const f = sumarDias(fecha, -i);
    if (abreEl(horario, f)) out.push(f);
  }
  return out;
}

/**
 * Racha de días de apertura seguidos con visita, contando hacia atrás desde el
 * día abierto anterior a `hoy`. Hoy no cuenta: la racha es lo que YA hizo.
 * @param {Set<string>} fechas días (locales) con alguna visita
 * @returns {{racha:number, inicio:string|null}} inicio = primer día de la racha
 */
export function rachaDe(fechas, horario, hoy, tope = 30) {
  let racha = 0;
  let inicio = null;
  for (const f of diasAbiertosAntes(horario, hoy, tope)) {
    if (!fechas.has(f)) break;
    racha += 1;
    inicio = f;
  }
  return { racha, inicio };
}

/**
 * El horario en una línea: "L–J 7:30–18:30 · V 7:30–16:30 · S 8:30–13:00".
 * Los días seguidos con las mismas horas se juntan.
 */
export function resumenHorario(horario) {
  if (!horario) return "Sin horario";
  const bloques = [];
  horario.semana.forEach((t, i) => {
    const clave = t ? `${horaCorta(t.abre)}–${horaCorta(t.cierra)}` : null;
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.clave === clave && ultimo.hasta === i - 1) ultimo.hasta = i;
    else bloques.push({ clave, desde: i, hasta: i });
  });
  const abiertos = bloques.filter((b) => b.clave);
  if (!abiertos.length) return "Cerrado todos los días";
  return abiertos
    .map((b) => {
      const dias = b.desde === b.hasta ? DIAS_CORTOS[b.desde] : `${DIAS_CORTOS[b.desde]}–${DIAS_CORTOS[b.hasta]}`;
      return `${dias} ${b.clave}`;
    })
    .join(" · ");
}

/** "hoy", "mañana", "el viernes", "el 9 de octubre": para decir cuándo sale algo. */
export function cuandoTexto(fecha, hoy) {
  if (fecha === hoy) return "hoy";
  if (fecha === sumarDias(hoy, 1)) return "mañana";
  const dentro = Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / DIA_MS);
  if (dentro > 1 && dentro < 7) return `el ${DIAS[diaDeFecha(fecha)]}`;
  return `el ${new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" })}`;
}

// ---------------------------------------------------------- ¿abierta ahora?
// La línea bajo el nombre de la tienda en la tarjeta del cliente. Es lo que
// hacen Google Maps y Apple Maps: el estado y la hora siguiente que importa, en
// una línea ("Abierto hasta las 18:30", "Cerrado hasta mañana"), y "pronto"
// cuando falta una hora o menos para cerrar o para abrir.
//
// Cortas a propósito: comparten la cabecera con el nombre y el contador de
// premios, y en un Android de 360 px caben unos 30 caracteres. Por eso la hora
// de abrir solo sale si es hoy; "Cerrado · abre el miércoles a las 7:30" se cortaba.

const PRONTO_MIN = 60;

/** 1110 -> "las 18:30"; 105 -> "la 1:45". */
const lasHoras = (min) => `${Math.floor(min / 60) === 1 ? "la" : "las"} ${horaCorta(aHora(min))}`;

/** Próxima apertura desde `minutos` de `fecha` (hoy incluido): {fecha, minutos} o null. */
function aperturaTras(horario, fecha, minutos) {
  for (let i = 0; i < 15; i += 1) {
    const f = sumarDias(fecha, i);
    const tramo = tramoDe(horario, f);
    if (tramo && (i > 0 || minutos < tramo.abre)) return { fecha: f, minutos: tramo.abre };
  }
  return null;
}

/**
 * ¿Está abierta la tienda en `ms`? Con la hora de la tienda, no la de quien mira.
 * Sin horario, null: no se sabe, y "Abierto" sería inventárselo.
 *
 * `corto` es el principio de `texto` ("Abierto", "Cierra pronto", "Cerrado"):
 * lo que queda cuando el resto no cabe, mejor que "Abierto hasta las 16:…".
 * @returns {{abierta:boolean, tono:"abierto"|"pronto"|"cerrado", corto:string, texto:string}|null}
 */
export function estadoAhora(horario, ms) {
  if (!horario) return null;
  const { fecha, minutos } = relojLocal(ms, horario.zona);
  const hoy = tramoDe(horario, fecha);
  const hora = (min) => horaCorta(aHora(min));

  if (hoy && minutos >= hoy.abre && minutos < hoy.cierra) {
    return hoy.cierra - minutos <= PRONTO_MIN
      ? { abierta: true, tono: "pronto", corto: "Cierra pronto", texto: `Cierra pronto · ${hora(hoy.cierra)}` }
      : { abierta: true, tono: "abierto", corto: "Abierto", texto: `Abierto hasta ${lasHoras(hoy.cierra)}` };
  }

  const cerrado = (texto) => ({ abierta: false, tono: "cerrado", corto: "Cerrado", texto });
  const abre = aperturaTras(horario, fecha, minutos);
  if (!abre) return cerrado("Cerrado");
  // Una que abre a las 0:15 está a 25 minutos a las 23:50: "pronto", aunque sea mañana.
  const dias = abre.fecha === fecha ? 0 : abre.fecha === sumarDias(fecha, 1) ? 1 : Infinity;
  if (abre.minutos - minutos + dias * 24 * 60 <= PRONTO_MIN) {
    return { abierta: false, tono: "pronto", corto: "Abre pronto", texto: `Abre pronto · ${hora(abre.minutos)}` };
  }
  return cerrado(`Cerrado hasta ${dias === 0 ? lasHoras(abre.minutos) : cuandoTexto(abre.fecha, fecha)}`);
}
