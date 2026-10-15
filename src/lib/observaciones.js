// ============================================================================
// LO QUE DICEN LOS NÚMEROS (Clientes → Resumen)
// ----------------------------------------------------------------------------
// Frases sacadas de las cuentas, sin IA: reglas fijas sobre la rejilla de a qué
// hora viene la gente, el horario de la tienda y los grupos del CRM. Cada una
// puede traer su botón, y todos llevan a Avisos → Enviar, ya relleno:
//   - un GRUPO del CRM ("los que tienen un premio sin recoger"): ese grupo.
//   - un HUECO ("las tardes de martes están tranquilas"): no es un grupo de
//     clientes, es un momento. Va a TODOS, como mensaje de "solo ese día"
//     (lib/envios.js, `momento`): un aviso para esa tarde, no una promo que se
//     quede para siempre. Con el día y la hora propuestos: si es hoy o mañana,
//     sale ya elegida en «Enviar a las…»; si no, la pantalla dice cuándo.
//
// A propósito, NO muy precisas: "las tardes de martes y miércoles", no "el
// martes a las 16:40". Con unas decenas de visitas a la semana, más detalle
// sería ruido, y una tienda no cambia su día por un hueco de veinte minutos.
//
// Pura: la rejilla se calcula en el navegador (hora local, ver lib/crm.js).
//
// ANTES DE NADA, ¿HAY CON QUÉ? (`suficiencia`): una semana suelta no dice nada
// (el martes que se vio puede ser el del mercadillo). Hasta que cada día que
// abre la tienda se ha visto con visitas y hay un mínimo de visitas, ni la
// rejilla ni los patrones salen: la pantalla dice qué falta.
// ============================================================================

import { DIAS, tramosDe, sumarDias, abreEl, diaDeFecha, fechaLocal, ZONA_POR_DEFECTO } from "./horario";
import { soloVisitas, UMBRALES } from "./crm";

// Los tramos del día con los que se habla: también los usa lib/plantilla.js.
export const BLOQUES = [
  { id: "manana", plural: "mañanas", articulo: "las", desde: 0, hasta: 12, texto: "Esta mañana estamos tranquilos: ven a por lo tuyo sin colas." },
  { id: "mediodia", plural: "mediodías", articulo: "los", desde: 12, hasta: 16, texto: "A mediodía hay sitio de sobra: pásate y suma en tu tarjeta." },
  { id: "tarde", plural: "tardes", articulo: "las", desde: 16, hasta: 24, texto: "Esta tarde está tranquilo: ven con calma, tu tarjeta sigue sumando." },
];
const MIN_VISITAS = 30; // por debajo, cualquier "patrón" es casualidad
const FECHAS_POR_DIA = 2; // cada día que abre, visto con visitas al menos dos veces
// ...o tantas semanas abierto sin ninguna: un día muerto también es un dato, y
// sin esto un domingo que nunca viene nadie dejaría la barrera puesta para siempre.
const SEMANAS_DE_SOBRA = 4;
const DIAS_TENDENCIA = 60; // "estos 30 días contra los 30 anteriores" pide dos meses de historia

const plural = (d) => (DIAS[d].endsWith("s") ? DIAS[d] : `${DIAS[d]}s`);

/** "martes y miércoles", "de lunes a jueves", "lunes, miércoles y viernes". */
export function listaDias(dias) {
  const orden = [...dias].sort((a, b) => a - b);
  if (orden.length === 1) return `los ${plural(orden[0])}`;
  const seguidos = orden.every((d, i) => i === 0 || d === orden[i - 1] + 1);
  if (seguidos && orden.length > 2) return `de ${DIAS[orden[0]]} a ${DIAS[orden.at(-1)]}`;
  const nombres = orden.map((d) => DIAS[d]);
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/**
 * Qué parte de cada hora está abierta la tienda: [dia][hora] de 0 a 1. Sin
 * horario, se da por abierta cualquier hora con alguna visita en la semana.
 */
function horasAbiertas(horario, rejilla) {
  return Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => {
    if (!horario) return rejilla.some((fila) => fila[h] > 0) && rejilla[d].some((x) => x > 0) ? 1 : 0;
    // Una semana de referencia (el 1 de enero de 2024 fue lunes): solo importa el día de la semana.
    const tramos = tramosDe({ ...horario, cerrados: [] }, sumarDias("2024-01-01", d));
    let abierto = 0;
    for (const t of tramos) abierto += Math.max(0, Math.min((h + 1) * 60, t.cierra) - Math.max(h * 60, t.abre));
    return Math.min(1, abierto / 60);
  }));
}

/** Hora (minutos) en que abre la tienda ese día dentro de un bloque: para programar el aviso. */
function aperturaEn(abiertas, dias, bloque) {
  for (let h = bloque.desde; h < bloque.hasta; h += 1) {
    if (dias.every((d) => abiertas[d][h] > 0)) return h;
  }
  return bloque.desde;
}

/** "las tardes de martes y miércoles", "los mediodías de lunes a viernes". */
const enBloque = (b, dias) => {
  const lista = listaDias(dias); // "los sábados" -> "las tardes de los sábados"
  return `${b.articulo} ${b.plural} ${lista.startsWith("de ") ? lista : `de ${lista}`}`;
};

const hhmm = (h) => `${String(h).padStart(2, "0")}:00`;

/**
 * ¿Hay datos para hablar de horas y días? Los días cerrados (el horario, festivos
 * incluidos) no cuentan como vistos: una semana con el lunes de fiesta tarda una
 * semana más en llenar el lunes. Sin horario se da por abierta toda la semana.
 * Las fechas, con la hora de la tienda (`horario.zona`).
 * @returns {{suficiente:boolean, visitas:number, minVisitas:number, faltan:number[], diasDeHistoria:number,
 *   dias:{d:number, abre:boolean, fechas:number, listo:boolean}[]}}
 */
export function suficiencia({ eventos, horario = null, ahora = Date.now() }) {
  const zona = horario?.zona || ZONA_POR_DEFECTO;
  const visitas = soloVisitas(eventos);
  const hoy = fechaLocal(ahora, zona);
  const primera = visitas.length ? fechaLocal(Date.parse(visitas[0].ts), zona) : hoy;

  const conVisitas = Array.from({ length: 7 }, () => new Set());
  for (const e of visitas) {
    const f = fechaLocal(Date.parse(e.ts), zona);
    conVisitas[diaDeFecha(f)].add(f);
  }
  // Días abiertos ya terminados (hoy aún no) desde la primera visita.
  const vistos = new Array(7).fill(0);
  for (let f = primera, n = 0; f < hoy && n < 400; f = sumarDias(f, 1), n += 1) {
    if (!horario || abreEl(horario, f)) vistos[diaDeFecha(f)] += 1;
  }

  const dias = Array.from({ length: 7 }, (_, d) => {
    const abre = !horario || tramosDe({ ...horario, cerrados: [] }, sumarDias("2024-01-01", d)).length > 0;
    const fechas = conVisitas[d].size;
    return { d, abre, fechas, listo: !abre || fechas >= FECHAS_POR_DIA || vistos[d] >= SEMANAS_DE_SOBRA };
  });
  const faltan = dias.filter((x) => !x.listo).map((x) => x.d);
  return {
    suficiente: visitas.length >= MIN_VISITAS && !faltan.length,
    visitas: visitas.length,
    minVisitas: MIN_VISITAS,
    faltan,
    dias,
    diasDeHistoria: Math.round((Date.parse(hoy) - Date.parse(primera)) / 864e5),
  };
}

/** Qué falta para que salgan la rejilla y los patrones, en una frase. */
export function textoFalta(s) {
  if (!s.visitas) return "Todavía no hay visitas.";
  const partes = [];
  if (s.faltan.length) partes.push(`ver cada día que abres al menos ${FECHAS_POR_DIA} veces con visitas (faltan ${listaDias(s.faltan)})`);
  if (s.visitas < s.minVisitas) partes.push(`unas ${s.minVisitas} visitas en total (van ${s.visitas})`);
  return `Hace falta ${partes.join(" y ")}.`;
}

/**
 * Las observaciones, de la más útil a la menos.
 * @param {{rejilla:number[][], horario:object|null, metricas:object, grupos:{key:string,total:number}[]}} datos
 * @returns {{id:string, texto:string, detalle?:string, accion?:{tipo:"enviar", grupo:"momento", label:string, dia:number, hora:string, texto:string}|{tipo:"grupo", grupo:string, label:string}}[]}
 */
export function observaciones({ rejilla, horario = null, metricas = {}, grupos = [], suficiencia: s = null }) {
  const out = [];
  const total = rejilla.flat().reduce((a, b) => a + b, 0);
  const abiertas = horasAbiertas(horario, rejilla);

  if (s ? s.suficiente : total >= MIN_VISITAS) {
    // Ritmo de cada (día, bloque): visitas por hora abierta.
    const celdas = [];
    for (let d = 0; d < 7; d += 1) {
      for (const b of BLOQUES) {
        let horas = 0;
        let visitas = 0;
        for (let h = b.desde; h < b.hasta; h += 1) {
          horas += abiertas[d][h];
          if (abiertas[d][h] > 0) visitas += rejilla[d][h];
        }
        if (horas >= 1) celdas.push({ d, b, ritmo: visitas / horas, visitas });
      }
    }
    const ritmos = celdas.map((c) => c.ritmo).sort((a, b) => a - b);
    const mediana = ritmos[Math.floor(ritmos.length / 2)] || 0;

    if (mediana > 0) {
      // LO MÁS TRANQUILO: el bloque con más días flojos (menos de la mitad de lo normal).
      const flojas = celdas.filter((c) => c.ritmo <= mediana * 0.45);
      const porBloque = BLOQUES.map((b) => ({ b, dias: flojas.filter((c) => c.b.id === b.id).map((c) => c.d) })).filter((x) => x.dias.length);
      porBloque.sort((x, y) => y.dias.length - x.dias.length);
      if (porBloque.length) {
        const { b, dias } = porBloque[0];
        // El aviso, UN día a la semana: el más flojo. Uno cada tarde tranquila
        // sería un aviso casi diario a todos los clientes.
        const dia = flojas.filter((c) => c.b.id === b.id).sort((x, y) => x.ritmo - y.ritmo || x.d - y.d)[0].d;
        const hora = aperturaEn(abiertas, [dia], b);
        out.push({
          id: `tranquilo-${b.id}`,
          texto: `Lo más tranquilo: ${enBloque(b, dias)}.`,
          detalle: "Viene menos de la mitad de gente que en una hora normal de la tienda.",
          accion: { tipo: "enviar", grupo: "momento", label: `Avisar ${listaDias([dia])}`, dia, hora: hhmm(hora), texto: b.texto },
        });
      }

      // LO MÁS FUERTE: el bloque con el ritmo más alto, y su hora punta.
      const fuertes = celdas.filter((c) => c.ritmo >= mediana * 1.6);
      const fuertesPorBloque = BLOQUES.map((b) => ({ b, dias: fuertes.filter((c) => c.b.id === b.id).map((c) => c.d) })).filter((x) => x.dias.length);
      fuertesPorBloque.sort((x, y) => y.dias.length - x.dias.length);
      if (fuertesPorBloque.length) {
        const { b, dias } = fuertesPorBloque[0];
        let punta = b.desde;
        let mejor = -1;
        for (let h = b.desde; h < b.hasta; h += 1) {
          const n = dias.reduce((a, d) => a + (abiertas[d][h] > 0 ? rejilla[d][h] : 0), 0);
          if (n > mejor) { mejor = n; punta = h; }
        }
        out.push({
          id: `fuerte-${b.id}`,
          texto: `Lo más fuerte: ${enBloque(b, dias)}, sobre todo de ${punta} a ${punta + 1}.`,
          detalle: "Buen momento para tener la caja a punto. No hace falta avisar a nadie: ya vienen.",
        });
      }
    }

    // EL DÍA MÁS FLOJO de los que abre, si se queda claramente por debajo.
    const porDia = Array.from({ length: 7 }, (_, d) => {
      const horas = abiertas[d].reduce((a, b) => a + b, 0);
      const visitas = rejilla[d].reduce((a, b) => a + b, 0);
      return horas >= 1 ? { d, ritmo: visitas / horas } : null;
    }).filter(Boolean);
    if (porDia.length >= 3) {
      const orden = [...porDia].sort((a, b) => a.ritmo - b.ritmo);
      const medio = orden[Math.floor(orden.length / 2)].ritmo;
      const flojo = orden[0];
      if (medio > 0 && flojo.ritmo <= medio * 0.6 && !out.some((o) => o.accion?.dia === flojo.d)) {
        const hora = abiertas[flojo.d].findIndex((x) => x > 0);
        out.push({
          id: `flojo-${flojo.d}`,
          texto: `Los ${plural(flojo.d)} vienen bastante menos que el resto de la semana.`,
          accion: { tipo: "enviar", grupo: "momento", label: `Avisar los ${plural(flojo.d)}`, dia: flojo.d, hora: hhmm(Math.max(0, hora) + 1), texto: "¿Plan para hoy? Pásate: cada visita suma en tu tarjeta." },
        });
      }
    }
  } else {
    out.push({
      id: "pocos",
      texto: "Aún es pronto para sacar conclusiones.",
      detalle: s ? `${textoFalta(s)} Entonces saldrán aquí las horas tranquilas y las fuertes.` : "Con unas cuantas visitas más, aquí saldrán las horas tranquilas y las fuertes de la tienda.",
    });
  }

  // LA TENDENCIA del mes, solo si el cambio es grande y hay con qué comparar:
  // con un mes y poco de historia, "los 30 anteriores" son unos días sueltos.
  const antes = metricas.visitas30Previas || 0;
  const ahora = metricas.visitas30 || 0;
  if (antes >= UMBRALES.tendenciaMin && (!s || s.diasDeHistoria >= DIAS_TENDENCIA)) {
    const cambio = Math.round(((ahora - antes) / antes) * 100);
    if (cambio <= -20) {
      out.push({
        id: "baja", texto: `Estos 30 días han venido un ${-cambio}% menos que los 30 anteriores.`,
        accion: { tipo: "grupo", grupo: "riesgo", label: "Escribir a los que se están alejando" },
      });
    } else if (cambio >= 20) {
      out.push({ id: "sube", texto: `Estos 30 días han venido un ${cambio}% más que los 30 anteriores.` });
    }
  }

  // LOS GRUPOS que piden un aviso, si tienen a alguien.
  const g = Object.fromEntries(grupos.map((x) => [x.key, x.total]));
  if ((g.premio_listo || 0) >= 2) out.push({ id: "premios", texto: `${g.premio_listo} clientes tienen un premio sin recoger.`, accion: { tipo: "grupo", grupo: "premio_listo", label: "Recordárselo" } });
  if ((g.a_punto || 0) >= 3) out.push({ id: "a-punto", texto: `${g.a_punto} clientes están a uno o dos sellos del premio.`, accion: { tipo: "grupo", grupo: "a_punto", label: "Darles el empujón" } });
  if ((g.fieles_frios || 0) >= 2) out.push({ id: "fieles", texto: `${g.fieles_frios} habituales llevan más tiempo del normal sin venir.`, accion: { tipo: "grupo", grupo: "fieles_frios", label: "Escribirles" } });
  if ((g.fantasmas || 0) >= 5) out.push({ id: "sin-uso", texto: `${g.fantasmas} tienen la tarjeta y nunca la han usado en caja.`, accion: { tipo: "grupo", grupo: "fantasmas", label: "Invitarles a estrenarla" } });

  return out;
}

/**
 * La URL de Avisos que abre lo de una observación ya preparado. `por` es la
 * frase de la observación: Enviar la enseña arriba, para que se sepa de dónde
 * viene lo que ya está escrito.
 */
export function enlaceDeAccion(slug, accion, por = null) {
  if (accion.tipo === "grupo" || accion.tipo === "enviar") {
    const q = new URLSearchParams({ grupo: accion.grupo });
    if (accion.texto) q.set("texto", accion.texto);
    if (Number.isInteger(accion.dia)) q.set("dia", String(accion.dia));
    if (accion.hora) q.set("hora", accion.hora);
    if (por) q.set("por", por);
    return `/${slug}/avisos?${q}`;
  }
  // Un aviso PROGRAMADO a medias (solo con los programados encendidos para la tienda).
  const json = JSON.stringify(accion.base);
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  return `/${slug}/avisos?programar=${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
