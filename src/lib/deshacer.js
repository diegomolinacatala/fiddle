import { firmarTexto, verificarTexto } from "./auth";
import { SALDO, restaurarCliente, quitarEventosDesde, addEvento } from "./store";
import { ACCIONES } from "./acciones";

// ============================================================================
// «DESHACER CAMBIOS» EN LA CAJA
// ----------------------------------------------------------------------------
// Quien atiende se equivoca (sumó en la cartilla que no era, abrió al cliente
// que no era, dio un premio de más): un botón deja la tarjeta COMO ESTABA AL
// ESCANEARLA. No es otro movimiento que lo compense, como el «−»: lo hecho NO
// PASÓ. Se quitan del historial los movimientos de la caja desde que se abrió la
// ficha, y la tarjeta recupera su saldo, sus visitas, su última visita y el
// mensaje que sumar la visita le quitó. Así ninguna cuenta (visitas y ritmo del
// CRM, Actividad, Rendimiento de la plantilla, «¿volvió?» de una campaña) ve una
// visita que no hubo. Con el «−», el sello y su corrección se quedan, y la
// visita cuenta.
//
// Cómo estaba lo dice el SERVIDOR, no el navegador: la ficha recibe al abrirse
// una instantánea firmada con el secreto de las sesiones (`firmarInstantanea`) y
// solo vale esa. Si no, una caja podría «volver» a una tarjeta llena que nunca
// existió. Caduca a los MINUTOS_DESHACER_CAMBIOS: es para el error del momento.
//
// Queda una línea en su historial («Deshechos 2 movimientos de la caja»), de un
// tipo que no es de la caja (`deshacer`): no cuenta en nada, pero quien mire su
// historial ve que algo se deshizo.
// ============================================================================

export const MINUTOS_DESHACER_CAMBIOS = 30;

/** Lo que escribe /api/accion en `eventos.tipo`: una entrada por acción de la caja. */
export const TIPOS_DE_CAJA = Object.keys(ACCIONES);

const CAMPOS = [...SALDO, "visitas", "ultima_visita", "mensaje"];

/** La tarjeta tal como está ahora, firmada: lo que la ficha devuelve para deshacer. */
export async function firmarInstantanea(cliente, ahora = Date.now()) {
  const foto = { serial: cliente.serial, desde: new Date(ahora).toISOString() };
  for (const k of CAMPOS) foto[k] = cliente[k] ?? (SALDO.includes(k) || k === "visitas" ? 0 : null);
  return firmarTexto(Buffer.from(JSON.stringify(foto)).toString("base64url"), ahora + MINUTOS_DESHACER_CAMBIOS * 60_000);
}

/** La instantánea de esa tarjeta si la firma vale y no ha caducado; si no, null. Nunca lanza. */
export async function leerInstantanea(token, serial, ahora = Date.now()) {
  const texto = await verificarTexto(token, ahora);
  if (!texto) return null;
  try {
    const foto = JSON.parse(Buffer.from(texto, "base64url").toString("utf8"));
    return foto?.serial === serial && typeof foto.desde === "string" ? foto : null;
  } catch {
    return null;
  }
}

const igual = (a, b) => CAMPOS.every((k) => (a[k] ?? null) === (b[k] ?? null));

/**
 * Deja la tarjeta como en la instantánea y quita lo que hizo la caja desde
 * entonces. Primero la tarjeta (optimista: si otra caja la tocó entre medias, no
 * se hace nada y se avisa) y después el historial.
 * @param {object} cliente la fila de ahora (getCliente)
 * @param {object} antes   de leerInstantanea
 * @param {{actor: string, empleado?: string|null}} quien
 * @returns {Promise<{ok:false, conflicto:true} | {ok:true, cliente:object, cambiado:boolean, quitados:number}>}
 */
export async function deshacerCambios(cliente, antes, { actor, empleado = null }) {
  const restaurado = { ...cliente };
  for (const k of CAMPOS) restaurado[k] = antes[k];
  const cambiado = !igual(cliente, antes);
  if (cambiado && !(await restaurarCliente(cliente.serial, antes, { esperado: cliente }))) {
    return { ok: false, conflicto: true };
  }
  const quitados = await quitarEventosDesde(cliente.serial, antes.desde, TIPOS_DE_CAJA);
  if (quitados) {
    await addEvento(cliente.serial, "deshacer", `Deshecho${quitados === 1 ? " 1 movimiento" : `s ${quitados} movimientos`} de la caja`, {
      negocio: cliente.negocio, actor, empleado,
    });
  }
  return { ok: true, cliente: restaurado, cambiado, quitados };
}
