// ============================================================================
// LO QUE DICEN LOS NÚMEROS (Clientes → Resumen)
// ----------------------------------------------------------------------------
// Frases sacadas de las cuentas, sin IA: reglas fijas sobre la rejilla de a qué
// hora viene la gente, el horario de la tienda y los grupos del CRM. Cada una
// puede traer su botón: programar un aviso para ese hueco (Avisos →
// Programados, ya relleno) o escribir a ese grupo (Avisos → Enviar ahora).
//
// A propósito, NO muy precisas: "las tardes de martes y miércoles", no "el
// martes a las 16:40". Con unas decenas de visitas a la semana, más detalle
// sería ruido, y una tienda no cambia su día por un hueco de veinte minutos.
//
// Pura: la rejilla se calcula en el navegador (hora local, ver lib/crm.js).
// ============================================================================

import { DIAS, tramosDe, sumarDias } from "./horario";

const BLOQUES = [
  { id: "manana", plural: "mañanas", desde: 0, hasta: 12, texto: "Esta mañana estamos tranquilos: ven a por lo tuyo sin colas." },
  { id: "mediodia", plural: "mediodías", desde: 12, hasta: 16, texto: "A mediodía hay sitio de sobra: pásate y suma en tu tarjeta." },
  { id: "tarde", plural: "tardes", desde: 16, hasta: 24, texto: "Esta tarde está tranquilo: ven con calma, tu tarjeta sigue sumando." },
];
const MIN_VISITAS = 30; // por debajo, cualquier "patrón" es casualidad

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

/** "las tardes de martes y miércoles", "las mañanas de lunes a viernes". */
const enBloque = (b, dias) => {
  const lista = listaDias(dias); // "los sábados" -> "las tardes de los sábados"
  return `las ${b.plural} ${lista.startsWith("de ") ? lista : `de ${lista}`}`;
};

const hhmm = (h) => `${String(h).padStart(2, "0")}:00`;

/**
 * Las observaciones, de la más útil a la menos.
 * @param {{rejilla:number[][], horario:object|null, metricas:object, grupos:{key:string,total:number}[]}} datos
 * @returns {{id:string, texto:string, detalle?:string, accion?:{tipo:"programar", base:object, label:string}|{tipo:"grupo", grupo:string, label:string}}[]}
 */
export function observaciones({ rejilla, horario = null, metricas = {}, grupos = [] }) {
  const out = [];
  const total = rejilla.flat().reduce((a, b) => a + b, 0);
  const abiertas = horasAbiertas(horario, rejilla);

  if (total >= MIN_VISITAS) {
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
          accion: {
            tipo: "programar",
            label: `Programar un aviso ${listaDias([dia])}`,
            base: { nombre: `${b.plural.charAt(0).toUpperCase()}${b.plural.slice(1)} tranquilas`, disparo: "todos", dias: [dia], hora: hhmm(hora), texto: b.texto, caduca: true },
          },
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
      if (medio > 0 && flojo.ritmo <= medio * 0.6 && !out.some((o) => o.accion?.base?.dias?.length === 1 && o.accion.base.dias[0] === flojo.d)) {
        const hora = abiertas[flojo.d].findIndex((x) => x > 0);
        out.push({
          id: `flojo-${flojo.d}`,
          texto: `Los ${plural(flojo.d)} vienen bastante menos que el resto de la semana.`,
          accion: {
            tipo: "programar",
            label: `Programar un aviso para los ${plural(flojo.d)}`,
            base: { nombre: `Los ${plural(flojo.d)}`, disparo: "todos", dias: [flojo.d], hora: hhmm(Math.max(0, hora) + 1), texto: "¿Plan para hoy? Pásate: cada visita suma en tu tarjeta.", caduca: true },
          },
        });
      }
    }
  } else {
    out.push({ id: "pocos", texto: "Con unas cuantas visitas más, aquí saldrán las horas tranquilas y las fuertes de la tienda." });
  }

  // LA TENDENCIA del mes, solo si el cambio es grande y hay con qué comparar.
  const antes = metricas.visitas30Previas || 0;
  const ahora = metricas.visitas30 || 0;
  if (antes >= 20) {
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

/** La URL de Avisos que abre lo de una observación ya preparado. */
export function enlaceDeAccion(slug, accion) {
  if (accion.tipo === "grupo") return `/${slug}/avisos?grupo=${encodeURIComponent(accion.grupo)}`;
  const json = JSON.stringify(accion.base);
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  return `/${slug}/avisos?programar=${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
