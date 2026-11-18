// ============================================================================
// LO QUE EL DUEÑO QUIERE RECIBIR EN SU TARJETA
// ----------------------------------------------------------------------------
// Lo elige él en Tienda → «Tu tarjeta de dueño». Se guarda en
// `tarjetaDueno.recibir` y lo leen el reloj (qué aviso calcular), el pase (qué
// campo suena) y la fila de Tienda. PURO y sin imports: lo carga también el
// navegador.
//
//   resumen    el lunes suena con el informe de la semana. Apagado, la tarjeta se
//              pone al día igual, en silencio.
//   ideas      «lo que dicen los números» le prepara un aviso para sus clientes.
//              Apagado, no hay aviso del día (la prueba sí sale: la pide él).
//   porSemana  cuántas ideas como mucho a la semana (1 o 2).
//
// De partida, lo de siempre: todo encendido y dos a la semana.
// ============================================================================

export const TOPE_SEMANA = 2;
export const RECIBIR_DE_PARTIDA = Object.freeze({ resumen: true, ideas: true, porSemana: TOPE_SEMANA });

const CLAVES = ["resumen", "ideas", "porSemana"];
const porSemanaValido = (n) => Number.isInteger(n) && n >= 1 && n <= TOPE_SEMANA;

/** Lo guardado con lo que falte puesto. Un valor raro vale lo de partida, nunca lanza. */
export function recibirDe(tarjeta) {
  const r = tarjeta?.recibir;
  if (!r || typeof r !== "object") return { ...RECIBIR_DE_PARTIDA };
  return {
    resumen: typeof r.resumen === "boolean" ? r.resumen : RECIBIR_DE_PARTIDA.resumen,
    ideas: typeof r.ideas === "boolean" ? r.ideas : RECIBIR_DE_PARTIDA.ideas,
    porSemana: porSemanaValido(r.porSemana) ? r.porSemana : RECIBIR_DE_PARTIDA.porSemana,
  };
}

/**
 * Lo que llega del navegador: solo esas tres claves y con su tipo. Puede venir una sola.
 * @returns {{ok:true, cambios:object} | {ok:false, error:string}}
 */
export function validarRecibir(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return { ok: false, error: "Falta qué quieres recibir" };
  const claves = Object.keys(cuerpo);
  if (!claves.length || claves.some((k) => !CLAVES.includes(k))) return { ok: false, error: "Opción desconocida" };
  if ("resumen" in cuerpo && typeof cuerpo.resumen !== "boolean") return { ok: false, error: "«Resumen» tiene que ser sí o no" };
  if ("ideas" in cuerpo && typeof cuerpo.ideas !== "boolean") return { ok: false, error: "«Ideas» tiene que ser sí o no" };
  if ("porSemana" in cuerpo && !porSemanaValido(cuerpo.porSemana)) return { ok: false, error: `Como mucho, entre 1 y ${TOPE_SEMANA} a la semana` };
  return { ok: true, cambios: Object.fromEntries(claves.map((k) => [k, cuerpo[k]])) };
}

/** Cómo está, en una línea, para la fila de Tienda. */
export function resumenRecibir(recibir) {
  const { resumen, ideas, porSemana } = recibirDe({ recibir });
  const veces = porSemana === 1 ? "una a la semana como mucho" : `${porSemana} a la semana como mucho`;
  if (resumen && ideas) return `Te avisa con el resumen del lunes y con ideas para tus clientes (${veces}).`;
  if (resumen) return "Te avisa solo con el resumen del lunes.";
  if (ideas) return `Te avisa solo con ideas para tus clientes (${veces}).`;
  return "No te avisa: la tarjeta se pone al día en silencio.";
}
