import { createHmac } from "node:crypto";
import { registrarIntento, contarIntentos } from "./store";

// ============================================================================
// LÍMITES DE USO (persistidos: en serverless la memoria no sobrevive)
// ----------------------------------------------------------------------------
// LOGIN  Un PIN de 4 cifras son 10.000 combinaciones: sin límite se adivina en
//        minutos. 10 fallos por IP+negocio y 100 por negocio en 15 min.
// TAP    /api/tap es público y cada llamada crea un cliente y firma un pase
//        (CPU). 30 emisiones por IP en 10 min: de sobra para una tienda con
//        wifi compartida, corta un bucle de peticiones.
// LOG    /api/wallet/v1/log es público por protocolo: 60 por IP en 10 min.
// PUSH   /api/push/<serial> es público (lo usa la tarjeta del cliente) y cada
//        alta guarda una fila y manda un aviso: 20 por IP en 10 min.
// GOOGLE /api/google/guardar/<serial> firma un JWT y llama a la API de Google
//        (gasta cuota de la tienda): 30 por IP en 10 min.
//
// La tarjeta en vivo (/api/tarjeta) se consulta cada pocos segundos por diseño:
// apuntar cada consulta en la base costaría más que la consulta. Para eso está
// `limiteEnMemoria`, por instancia del servidor: no es exacto en serverless, pero
// corta un bucle sin tocar la base.
// ============================================================================

export const LIMITES = {
  loginIp: { max: 10, ventanaMs: 15 * 60 * 1000 },
  loginNegocio: { max: 100, ventanaMs: 15 * 60 * 1000 },
  tap: { max: 30, ventanaMs: 10 * 60 * 1000 },
  log: { max: 60, ventanaMs: 10 * 60 * 1000 },
  push: { max: 20, ventanaMs: 10 * 60 * 1000 },
  google: { max: 30, ventanaMs: 10 * 60 * 1000 },
};
export const MAX_POR_IP = LIMITES.loginIp.max;

async function supera(clave, { max, ventanaMs }, ahora) {
  return (await contarIntentos(clave, ahora - ventanaMs)) >= max;
}

// Para contar basta con saber que es "la misma IP", no cuál: en la base va una
// huella. Con clave (AUTH_SECRET), porque IPv4 solo hay 4.000 millones y un hash
// suelto se revierte probándolas todas.
function huellaIp(ip) {
  if (!ip) return "?";
  const secreto = process.env.AUTH_SECRET || "huella-ip-demo";
  return createHmac("sha256", secreto).update(ip).digest("hex").slice(0, 16);
}

const clavesLogin = (slug, ip) => ({ ip: `login:${slug}:${huellaIp(ip)}`, negocio: `login:${slug}:*` });

/** @returns {Promise<boolean>} true si hay que rechazar el intento sin mirar el PIN. */
export async function loginBloqueado(slug, ip, ahora = Date.now()) {
  const k = clavesLogin(slug, ip);
  const [porIp, porNegocio] = await Promise.all([
    supera(k.ip, LIMITES.loginIp, ahora),
    supera(k.negocio, LIMITES.loginNegocio, ahora),
  ]);
  return porIp || porNegocio;
}

export async function anotarFalloLogin(slug, ip) {
  const k = clavesLogin(slug, ip);
  await Promise.all([registrarIntento(k.ip), registrarIntento(k.negocio)]);
}

/**
 * Cuenta un uso de un recurso público y dice si se pasó del límite.
 * @param {"tap"|"log"|"push"|"google"} recurso
 * @returns {Promise<boolean>} true si hay que rechazar (429)
 */
export async function usoExcedido(recurso, ip, ahora = Date.now()) {
  const clave = `${recurso}:${huellaIp(ip)}`;
  if (await supera(clave, LIMITES[recurso], ahora)) return true;
  await registrarIntento(clave);
  return false;
}

const MAX_CLAVES_MEMORIA = 5000;
const usosEnMemoria = new Map(); // clave -> { desde, n }

/**
 * Límite barato, en memoria de esta instancia: true si hay que rechazar.
 * Ventana fija: al pasar `ventanaMs` desde la primera petición, vuelve a cero.
 */
export function limiteEnMemoria(clave, { max, ventanaMs }, ahora = Date.now()) {
  const actual = usosEnMemoria.get(clave);
  if (!actual || ahora - actual.desde > ventanaMs) {
    if (usosEnMemoria.size >= MAX_CLAVES_MEMORIA) usosEnMemoria.delete(usosEnMemoria.keys().next().value);
    usosEnMemoria.set(clave, { desde: ahora, n: 1 });
    return false;
  }
  actual.n += 1;
  return actual.n > max;
}

/**
 * IP del cliente tras el proxy de Vercel (primer valor de x-forwarded-for).
 * Se fía de esa cabecera porque en Vercel la pone su borde; detrás de otro proxy
 * (o sin ninguno) habría que revisarlo, o los límites se saltan cambiándola.
 */
export function ipDe(request) {
  const xff = request.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : request.headers.get("x-real-ip") || "").trim() || null;
}
