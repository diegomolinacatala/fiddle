// ============================================================================
// LO QUE ENSEÑA LA TARJETA DEL DUEÑO UN DÍA
// ----------------------------------------------------------------------------
// Une el informe de la semana y el aviso del día. Las observaciones llegan ya
// calculadas: aquí no se lee nada. PURO.
// ============================================================================

import { informeSemanal } from "./informe";
import { avisoDelDia } from "./avisos";
import { fechaLocal, tramosDe } from "../horario";
import { zonaDe } from "../actividad";

const REPASO_POR_DEFECTO = 9 * 60;

export function estadoDeHoy({ negocio, eventos, observaciones, ahora = Date.now(), avisados = {}, base = "", historialDesde = null }) {
  return {
    fecha: fechaLocal(ahora, zonaDe(negocio)),
    informe: informeSemanal({ eventos, negocio, ahora, historialDesde }),
    aviso: avisoDelDia({ observaciones, negocio, ahora, avisados, base }),
  };
}

/** Lo que cambia la tarjeta: la semana que enseña y qué aviso lleva. */
export const claveDeEstado = (estado) => `${estado.informe.desde}|${estado.aviso?.id ?? ""}`;

/** La prueba vigente gana; si no, el aviso del día mientras no haya caducado. */
export function avisoVisible(tarjeta, estado, ahora = Date.now()) {
  const prueba = tarjeta?.prueba;
  if (prueba && Date.parse(prueba.hasta) > ahora) return { texto: prueba.texto, enlace: prueba.enlace ?? "" };
  const aviso = estado?.aviso;
  if (aviso && Date.parse(aviso.hasta) > ahora) return { texto: aviso.texto, enlace: aviso.enlace };
  return null;
}

/** A qué minuto del día se repasa la tarjeta: la primera apertura; las 9:00 si no abre o no hay horario. */
export function horaDeRepaso(horario, fecha) {
  if (!horario) return REPASO_POR_DEFECTO;
  const primero = tramosDe(horario, fecha)[0];
  return primero ? primero.abre : REPASO_POR_DEFECTO;
}
