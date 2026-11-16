// ============================================================================
// EL INFORME SEMANAL DE LA TARJETA DEL DUEÑO
// ----------------------------------------------------------------------------
// Cada lunes, la última semana ENTERA (lunes a domingo): visitas, clientes
// nuevos y premios dados, y las visitas de cada día. Todo PURO: lo importa
// también un componente de cliente, así que nada de store, env ni Date.now().
// ============================================================================

import { soloVisitas } from "../crm";
import { actividadDelRango, periodoDe, zonaDe } from "../actividad";
import { fechaLocal, sumarDias, inicioDelDia, abreEl, DIAS } from "../horario";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Dos cartillas como mucho: sumar las dos da los premios dados, tenga la tienda una o dos.
const CARTILLAS_MAX = 2;

/** "2026-11-09" -> { dia: 9, mes: "nov" }. A mano: el servidor no tiene por qué tener el idioma. */
function pedazos(fecha) {
  const [, m, d] = fecha.split("-").map(Number);
  return { dia: d, mes: MESES[m - 1] };
}

/** "9 al 15 nov", o "28 oct al 3 nov" si la semana cambia de mes. */
function etiquetaDe(desde, hasta) {
  const a = pedazos(desde);
  const b = pedazos(hasta);
  return a.mes === b.mes ? `${a.dia} al ${b.dia} ${b.mes}` : `${a.dia} ${a.mes} al ${b.dia} ${b.mes}`;
}

const premiosDe = (actividad) => actividad.totales.porCartilla.reduce((suma, c) => suma + c.premios, 0);

/** Visitas por fecha local (una entrada por visita, ya filtradas con soloVisitas). */
function visitasPorFecha(visitas, zona) {
  const cuenta = new Map();
  for (const e of visitas) {
    const f = fechaLocal(Date.parse(e.ts), zona);
    cuenta.set(f, (cuenta.get(f) || 0) + 1);
  }
  return cuenta;
}

const sumaRango = (cuenta, desde, hasta) => {
  let total = 0;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) total += cuenta.get(f) || 0;
  return total;
};

/**
 * La última semana entera vista desde `ahora` (lunes a domingo, hora de la tienda).
 * Es LA regla: el informe y quien decida si uno guardado sigue valiendo la usan juntos.
 */
export function semanaDelInforme(negocio, ahora = Date.now()) {
  const hoy = fechaLocal(ahora, zonaDe(negocio));
  const { desde, hasta } = periodoDe("semana", sumarDias(hoy, -7));
  return { desde, hasta };
}

/**
 * La última semana entera vista desde `ahora`. Las cifras de la semana anterior
 * (`*Antes`) son null si no hay con qué compararlas: si el historial que llega no la
 * cubre entera, o si la tienda no tiene NINGÚN movimiento anterior a esta semana
 * (recién creada). Comparar con una semana a medias o vacía inventaría una bajada
 * o un «igual que la anterior».
 */
export function informeSemanal({ eventos, negocio, ahora = Date.now(), historialDesde = null }) {
  const zona = zonaDe(negocio);
  const horario = negocio?.horario || null;
  const { desde, hasta } = semanaDelInforme(negocio, ahora);
  const desdeAntes = sumarDias(desde, -7);
  const hastaAntes = sumarDias(desde, -1);
  const inicioSemana = inicioDelDia(desde, zona);
  const cubreHistorial = historialDesde === null || historialDesde <= inicioDelDia(desdeAntes, zona);
  const hayAnteriores = eventos.some((e) => Date.parse(e.ts) < inicioSemana);
  const cubreAntes = cubreHistorial && hayAnteriores;

  const opciones = { zona, horario, cartillas: CARTILLAS_MAX };
  const actual = actividadDelRango(eventos, desde, hasta, opciones);
  const anterior = cubreAntes ? actividadDelRango(eventos, desdeAntes, hastaAntes, opciones) : null;
  const porFecha = visitasPorFecha(soloVisitas(eventos), zona);

  const porDia = Array.from({ length: 7 }, (_, d) => {
    const fecha = sumarDias(desde, d);
    return { fecha, d, n: porFecha.get(fecha) || 0, cerrado: Boolean(horario) && !abreEl(horario, fecha) };
  });
  const mejor = porDia.reduce((m, x) => (x.n > (m?.n ?? 0) ? x : m), null);

  return {
    desde,
    hasta,
    etiqueta: etiquetaDe(desde, hasta),
    visitas: sumaRango(porFecha, desde, hasta),
    visitasAntes: cubreAntes ? sumaRango(porFecha, desdeAntes, hastaAntes) : null,
    nuevos: actual.totales.altas,
    nuevosAntes: anterior ? anterior.totales.altas : null,
    premios: premiosDe(actual),
    premiosAntes: anterior ? premiosDe(anterior) : null,
    porDia,
    mejorDia: mejor ? { d: mejor.d, n: mejor.n } : null,
  };
}

/** "12 más que la anterior", "8 menos que la anterior", "igual que la anterior"; "" sin semana anterior. */
export function textoComparado(ahora, antes) {
  if (antes === null || antes === undefined) return "";
  const dif = ahora - antes;
  if (dif === 0) return "igual que la anterior";
  return `${Math.abs(dif)} ${dif > 0 ? "más" : "menos"} que la anterior`;
}

const contar = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Una frase para el pase: "142 visitas (12 más que la anterior), 9 clientes nuevos y 6 premios dados." */
export function fraseDelInforme(informe) {
  const cmp = textoComparado(informe.visitas, informe.visitasAntes);
  const visitas = contar(informe.visitas, "visita", "visitas") + (cmp ? ` (${cmp})` : "");
  const nuevos = contar(informe.nuevos, "cliente nuevo", "clientes nuevos");
  const premios = contar(informe.premios, "premio dado", "premios dados");
  return `${visitas}, ${nuevos} y ${premios}.`;
}

const lineaCifra = (titulo, n, antes) => {
  const cmp = textoComparado(n, antes);
  return `${titulo}: ${n}${cmp ? ` (${cmp})` : ""}`;
};

/** Para el reverso: una línea por cifra y el mejor día. */
export function lineasDelInforme(informe) {
  const lineas = [
    lineaCifra("Visitas", informe.visitas, informe.visitasAntes),
    lineaCifra("Clientes nuevos", informe.nuevos, informe.nuevosAntes),
    lineaCifra("Premios dados", informe.premios, informe.premiosAntes),
  ];
  const m = informe.mejorDia;
  return m ? [...lineas, `Mejor día: el ${DIAS[m.d]}, con ${contar(m.n, "visita", "visitas")}.`] : lineas;
}
