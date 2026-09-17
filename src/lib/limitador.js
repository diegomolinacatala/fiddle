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
// ============================================================================

export const LIMITES = {
  loginIp: { max: 10, ventanaMs: 15 * 60 * 1000 },
  loginNegocio: { max: 100, ventanaMs: 15 * 60 * 1000 },
  tap: { max: 30, ventanaMs: 10 * 60 * 1000 },
  log: { max: 60, ventanaMs: 10 * 60 * 1000 },
};
export const MAX_POR_IP = LIMITES.loginIp.max;

async function supera(clave, { max, ventanaMs }, ahora) {
  return (await contarIntentos(clave, ahora - ventanaMs)) >= max;
}

const clavesLogin = (slug, ip) => ({ ip: `login:${slug}:${ip || "?"}`, negocio: `login:${slug}:*` });

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
 * @param {"tap"|"log"} recurso
 * @returns {Promise<boolean>} true si hay que rechazar (429)
 */
export async function usoExcedido(recurso, ip, ahora = Date.now()) {
  const clave = `${recurso}:${ip || "?"}`;
  if (await supera(clave, LIMITES[recurso], ahora)) return true;
  await registrarIntento(clave);
  return false;
}

/** IP del cliente tras el proxy de Vercel (primer valor de x-forwarded-for). */
export function ipDe(request) {
  const xff = request.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : request.headers.get("x-real-ip") || "").trim() || null;
}
