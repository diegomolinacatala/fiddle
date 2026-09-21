import { createHash } from "node:crypto";

// ============================================================================
// AVISOS DEL NAVEGADOR — la suscripción que manda el teléfono
// ----------------------------------------------------------------------------
// Cuando el cliente activa los avisos, Chrome nos da un `endpoint` (una URL de
// su servicio de push) y dos claves. Para mandarle algo, el servidor hace un
// POST a ese endpoint. Por eso NO se acepta cualquier URL: un endpoint inventado
// convertiría nuestro servidor en un cañón para pegar a direcciones internas o
// de terceros. Solo valen los servicios de push de los navegadores de verdad.
//
// Se guarda en las mismas tablas que los iPhone (dispositivos + registros), con
// pass_type "web": un navegador suscrito es, a efectos de avisar, un teléfono
// más que tiene la tarjeta.
// ============================================================================

export const TIPO_WEB = "web";

// Servicios de push reales: Chrome/Edge/Samsung (FCM), Firefox, Edge en
// Windows (WNS) y Safari.
const HOSTS_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
];

const MAX_ENDPOINT = 1024;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function bytes(valor) {
  if (typeof valor !== "string" || !BASE64URL.test(valor)) return null;
  return Buffer.from(valor.replace(/=+$/, ""), "base64url");
}

/** ¿Es un endpoint de un servicio de push de verdad? */
export function endpointValido(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT) return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return HOSTS_PUSH.some((re) => re.test(url.hostname));
}

/**
 * Valida y limpia la suscripción que llega del navegador.
 * @param {unknown} s  PushSubscription.toJSON()
 * @returns {{endpoint:string, keys:{p256dh:string, auth:string}}|null}
 */
export function validarSuscripcion(s) {
  if (!s || typeof s !== "object") return null;
  const { endpoint, keys } = s;
  if (!endpointValido(endpoint)) return null;
  const p256dh = bytes(keys?.p256dh);
  const auth = bytes(keys?.auth);
  // Clave pública P-256 sin comprimir (65 bytes, empieza por 0x04) y 16 de auth.
  if (!p256dh || p256dh.length !== 65 || p256dh[0] !== 0x04) return null;
  if (!auth || auth.length !== 16) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/**
 * Id estable del "dispositivo" para una suscripción: el mismo navegador que se
 * vuelve a suscribir cae en la misma fila, no en una nueva.
 */
export const idDeSuscripcion = (endpoint) =>
  `web-${createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 40)}`;
