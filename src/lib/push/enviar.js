import webpush from "web-push";
import { clavesPush, sujetoPush } from "./vapid";

// ============================================================================
// AVISOS DEL NAVEGADOR — envío
// ----------------------------------------------------------------------------
// Cifra el aviso para cada suscripción y lo entrega a su servicio de push (FCM
// en Android). Igual que con APNs: nunca tumba la acción que lo provocó, y las
// suscripciones que el servicio da por muertas (404/410) se devuelven para
// borrarlas.
// ============================================================================

const CONCURRENCIA = 20;
const TTL_SEGUNDOS = 12 * 60 * 60; // un sello de esta mañana ya no interesa mañana
const TIMEOUT_MS = 10_000;

/**
 * @param {{token:string, payload:object}[]} destinos  token = suscripción en JSON
 * @param {{enviar?:Function, claves?:object}} [opciones]  inyectables en tests
 * @returns {Promise<{enviados:number, caducados:string[], errores:{estado:number, razon:string}[]}>}
 */
export async function enviarPush(destinos, { enviar = webpush.sendNotification, claves = clavesPush() } = {}) {
  const resumen = { enviados: 0, caducados: [], errores: [] };
  if (!destinos.length) return resumen;
  if (!claves) return { ...resumen, errores: [{ estado: 0, razon: "Sin claves VAPID" }] };

  const opciones = {
    vapidDetails: { subject: sujetoPush(), publicKey: claves.publica, privateKey: claves.privada },
    TTL: TTL_SEGUNDOS,
    urgency: "high", // el cliente suele estar en la tienda: que llegue ya, no al despertar el móvil
    timeout: TIMEOUT_MS,
  };

  const uno = async ({ token, payload }) => {
    let suscripcion;
    try {
      suscripcion = JSON.parse(token);
    } catch {
      return { token, estado: 410, razon: "Suscripción ilegible" };
    }
    try {
      await enviar(suscripcion, JSON.stringify(payload), opciones);
      return { token, estado: 201 };
    } catch (e) {
      return { token, estado: e?.statusCode || 0, razon: String(e?.body || e?.message || e).slice(0, 200) };
    }
  };

  for (let i = 0; i < destinos.length; i += CONCURRENCIA) {
    const lote = await Promise.all(destinos.slice(i, i + CONCURRENCIA).map(uno));
    for (const r of lote) {
      if (r.estado >= 200 && r.estado < 300) resumen.enviados++;
      else if (r.estado === 404 || r.estado === 410) resumen.caducados.push(r.token);
      else resumen.errores.push({ estado: r.estado, razon: r.razon });
    }
  }
  return resumen;
}
