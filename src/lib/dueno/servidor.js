// ============================================================================
// LA TARJETA DEL DUEÑO: lo que lee, calcula y empuja el servidor
// ----------------------------------------------------------------------------
// El reloj (lib/motorAvisos.js) pasa cada 15 minutos: `repasarTarjetaDueno` es
// idempotente. Guarda lo calculado en `tarjetaDueno.estado` para que el pase no
// tenga que recalcular el historial cada vez que el iPhone lo pide.
// ============================================================================

import { datosCrm } from "../crmDatos";
import { rejillaHoraria } from "../crm";
import { observaciones, suficiencia } from "../observaciones";
import { relojLocal } from "../horario";
import { zonaDe } from "../actividad";
import { appUrl } from "../url";
import { configApple } from "../apple/config";
import { enviarAvisos } from "../apple/apns";
import { estadoDeHoy, claveDeEstado, avisoVisible, horaDeRepaso } from "./estado";
import { semanaDelInforme } from "./informe";
import { tarjetaDe, guardarTarjeta } from "./tarjeta";

/** Calcula el estado de hoy desde el historial de la tienda. */
export async function cargarEstado(negocio, ahora = Date.now()) {
  const tarjeta = tarjetaDe(negocio);
  const datos = await datosCrm(negocio.slug);
  if (!datos) throw new Error(`La tienda ${negocio.slug} no existe`);
  const { eventos, metricas, grupos, historialCompletoDesde } = datos;
  const horario = negocio.horario ?? null;
  const hay = suficiencia({ eventos, horario, ahora });
  const rejilla = rejillaHoraria(eventos, { horario, ahora }).media;
  const ideas = observaciones({ rejilla, horario, metricas, grupos, suficiencia: hay });
  // `datosCrm` devuelve la tienda recortada: el plan y el slug salen de la entera.
  return estadoDeHoy({
    negocio, eventos, observaciones: ideas, ahora, base: appUrl(),
    avisados: tarjeta?.avisados ?? {},
    recibir: tarjeta?.recibir ?? null,
    historialDesde: Date.parse(historialCompletoDesde) || null,
  });
}

/**
 * Lo que enseña el pase ahora: el estado guardado si es de la última semana entera de
 * HOY; si no (el reloj aún no pasó el lunes, o lleva días parado), se calcula. Un
 * informe guardado de otra semana sería enseñar cifras viejas como nuevas.
 */
export async function estadoVigente(negocio, ahora = Date.now()) {
  const tarjeta = tarjetaDe(negocio);
  const { desde } = semanaDelInforme(negocio, ahora);
  const guardado = tarjeta?.estado?.informe?.desde === desde ? tarjeta.estado : null;
  const estado = guardado ?? (await cargarEstado(negocio, ahora));
  return { informe: estado.informe, aviso: avisoVisible(tarjeta, estado, ahora) };
}

/**
 * Push de APNs a los iPhone de la tarjeta; quita los tokens muertos. Nunca lanza.
 * @returns {Promise<{enviados:number, motivo?:"sin_iphone"|"sin_apple"|"error"}>} `motivo` solo si no avisó
 */
export async function avisarDueno(negocio) {
  try {
    const tarjeta = tarjetaDe(negocio);
    if (!tarjeta?.dispositivos.length) return { enviados: 0, motivo: "sin_iphone" };
    const config = configApple();
    if (!config) return { enviados: 0, motivo: "sin_apple" };
    const r = await enviarAvisos(tarjeta.dispositivos.map((d) => d.token), config);
    if (r.invalidos.length) {
      // Se relee justo antes de guardar: mientras se esperaba a APNs otro iPhone pudo registrarse.
      await guardarTarjeta(negocio.slug, (fresca) => ({
        dispositivos: fresca.dispositivos.filter((d) => !r.invalidos.includes(d.token)),
      }));
    }
    return { enviados: r.enviados };
  } catch (e) {
    console.error(`[tarjeta-dueno] ${negocio?.slug}: no se pudo avisar:`, e);
    return { enviados: 0, motivo: "error" };
  }
}

/** ¿Hoy ya se repasó, o aún no es la hora? Sin dispositivos no hay a quién enseñárselo. */
function tocaRepasar(negocio, tarjeta, ahora) {
  if (!tarjeta.dispositivos.length) return false;
  const reloj = relojLocal(ahora, zonaDe(negocio));
  if (tarjeta.estado?.fecha === reloj.fecha) return false;
  return reloj.minutos >= horaDeRepaso(negocio.horario, reloj.fecha);
}

/** Lo que se apunta tras repasar: siempre el estado; el aviso solo si es nuevo; la hora solo si cambió. */
function parcheDeRepaso(tarjeta, estado, ahora) {
  const cambio = !tarjeta.estado || claveDeEstado(estado) !== claveDeEstado(tarjeta.estado);
  const nuevoAviso = estado.aviso && estado.aviso.id !== tarjeta.estado?.aviso?.id;
  return {
    cambio,
    parche: {
      estado,
      ...(nuevoAviso ? { avisados: { ...tarjeta.avisados, [estado.aviso.id]: estado.fecha } } : {}),
      ...(cambio ? { actualizado: new Date(ahora).toISOString() } : {}),
    },
  };
}

const pruebaVencida = (tarjeta, ahora) => Boolean(tarjeta.prueba) && !(Date.parse(tarjeta.prueba.hasta) > ahora);

/** Recalcula, guarda y devuelve si cambió algo y la tienda como quedó. */
async function repasar(negocio, tarjeta, ahora) {
  const estado = await cargarEstado(negocio, ahora);
  const { cambio, parche } = parcheDeRepaso(tarjeta, estado, ahora);
  const guardada = await guardarTarjeta(negocio.slug, parche);
  return { cambio, tienda: guardada ?? negocio };
}

/**
 * Lo llama el reloj. Nunca lanza.
 * Una prueba vencida se quita aunque hoy no toque repasar, y se empuja: si no, el iPhone
 * seguiría enseñando «Esto es una prueba…» hasta el próximo cambio de verdad.
 * @returns {Promise<{ok:boolean, cambio:boolean}>}
 */
export async function repasarTarjetaDueno(negocio, ahora = Date.now()) {
  try {
    let tienda = negocio;
    let tarjeta = tarjetaDe(negocio);
    if (!tarjeta) return { ok: true, cambio: false };
    const limpiada = pruebaVencida(tarjeta, ahora);
    if (limpiada) {
      const guardada = await guardarTarjeta(negocio.slug, { prueba: null, actualizado: new Date(ahora).toISOString() });
      tienda = guardada ?? negocio;
      tarjeta = tarjetaDe(tienda) ?? { ...tarjeta, prueba: null };
    }
    const repaso = tocaRepasar(tienda, tarjeta, ahora)
      ? await repasar(tienda, tarjeta, ahora)
      : { cambio: false, tienda };
    // Un repaso que cambió algo ya empuja; si no, la prueba quitada necesita su empujón.
    if (repaso.cambio || limpiada) await avisarDueno(repaso.tienda);
    return { ok: true, cambio: repaso.cambio || limpiada };
  } catch (e) {
    console.error(`[tarjeta-dueno] ${negocio?.slug}: no se pudo repasar:`, e);
    return { ok: false, cambio: false };
  }
}
