import { igualSeguro } from "../auth";

// ============================================================================
// APPLE WALLET — web service (protocolo de actualización de pases)
// ----------------------------------------------------------------------------
// Apple llama a `webServiceURL` (= APP_URL/api/wallet) con estas rutas:
//
//  POST   /v1/devices/:dispositivo/registrations/:passType/:serial   registrar  (201 nuevo · 200 ya estaba · 401)
//  DELETE /v1/devices/:dispositivo/registrations/:passType/:serial   darse de baja (200 · 401)
//  GET    /v1/devices/:dispositivo/registrations/:passType?passesUpdatedSince=tag
//                                                                    qué pases cambiaron (200 · 204)
//  GET    /v1/passes/:passType/:serial                               el pase actualizado (200 · 401)
//  POST   /v1/log                                                    errores del iPhone (200)
//
// Las que llevan serial se autentican con la cabecera
// `Authorization: ApplePass <authenticationToken del pase>`.
//
// Lógica pura con dependencias inyectadas (store, firma, config) para testearla
// sin red ni base de datos. Las rutas de Next solo traducen a/desde HTTP.
// ============================================================================

/** @typedef {{status:number, json?:object, body?:Buffer, headers?:Record<string,string>}} Respuesta */

const tokenDeCabecera = (authorization) => {
  const m = /^ApplePass\s+(\S+)$/.exec(authorization || "");
  return m ? m[1] : null;
};

/**
 * Carga el cliente si el passType es el nuestro y el token coincide.
 * @returns {Promise<object|null>}
 */
async function clienteAutenticado(deps, passType, serial, authorization) {
  if (passType !== deps.config.passTypeId) return null;
  const token = tokenDeCabecera(authorization);
  if (!token) return null;
  const cliente = await deps.getCliente(serial);
  if (!cliente?.auth_token) return null;
  return igualSeguro(token, cliente.auth_token) ? cliente : null;
}

const noAutorizado = () => ({ status: 401, json: { error: "No autorizado" } });
const dispositivoValido = (d) => typeof d === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(d);
const dispositivoInvalido = () => ({ status: 400, json: { error: "Dispositivo inválido" } });

/** @returns {Promise<Respuesta>} */
export async function registrar(deps, { dispositivo, passType, serial, authorization, cuerpo }) {
  if (!dispositivoValido(dispositivo)) return dispositivoInvalido();
  const cliente = await clienteAutenticado(deps, passType, serial, authorization);
  if (!cliente) return noAutorizado();
  const pushToken = cuerpo?.pushToken;
  if (typeof pushToken !== "string" || !/^[0-9a-f]{16,200}$/i.test(pushToken)) {
    return { status: 400, json: { error: "pushToken inválido" } };
  }
  const nuevo = await deps.registrarPase({
    dispositivo, pushToken, passType, serial, negocio: cliente.negocio,
  });
  return { status: nuevo ? 201 : 200, json: {} };
}

/** @returns {Promise<Respuesta>} */
export async function desregistrar(deps, { dispositivo, passType, serial, authorization }) {
  if (!dispositivoValido(dispositivo)) return dispositivoInvalido();
  const cliente = await clienteAutenticado(deps, passType, serial, authorization);
  if (!cliente) return noAutorizado();
  await deps.borrarRegistro({ dispositivo, passType, serial });
  return { status: 200, json: {} };
}

/**
 * Seriales de este dispositivo actualizados después de `desde` (tag = ms epoch).
 * @returns {Promise<Respuesta>}
 */
export async function pasesActualizados(deps, { dispositivo, passType, desde }) {
  if (!dispositivoValido(dispositivo)) return dispositivoInvalido();
  if (passType !== deps.config.passTypeId) return { status: 404, json: {} };
  const desdeMs = /^\d+$/.test(desde || "") ? Number(desde) : 0;
  const pases = await deps.pasesDeDispositivo({ dispositivo, passType });
  const cambiados = pases
    .map((p) => ({ serial: p.serial, ms: Date.parse(p.actualizado) || 0 }))
    .filter((p) => p.ms > desdeMs);
  if (!cambiados.length) return { status: 204 };
  return {
    status: 200,
    json: {
      serialNumbers: cambiados.map((p) => p.serial),
      lastUpdated: String(Math.max(...cambiados.map((p) => p.ms))),
    },
  };
}

/**
 * El pase firmado más reciente. Siempre 200 (sin 304): If-Modified-Since solo
 * tiene precisión de segundos y podría esconder un sello puesto en el mismo
 * segundo. Un pase pesa pocos KB; mejor correcto que ahorrar bytes.
 * @returns {Promise<Respuesta>}
 */
export async function paseActual(deps, { passType, serial, authorization }) {
  const cliente = await clienteAutenticado(deps, passType, serial, authorization);
  if (!cliente) return noAutorizado();
  const negocio = await deps.getNegocio(cliente.negocio);
  if (!negocio) return { status: 404, json: { error: "Negocio no encontrado" } };
  const body = await deps.generarPkpass(cliente, negocio);
  const actualizado = new Date(Date.parse(cliente.actualizado) || Date.now());
  return {
    status: 200,
    body,
    headers: {
      "content-type": "application/vnd.apple.pkpass",
      "last-modified": actualizado.toUTCString(),
      "cache-control": "no-store",
    },
  };
}

/**
 * Logs que manda el iPhone cuando algo falla (certificado, JSON, red...).
 * Se registran en el log del servidor (Vercel -> Logs) para depurar.
 * @returns {Respuesta}
 */
export function registrarLogs(deps, { cuerpo }) {
  const logs = Array.isArray(cuerpo?.logs) ? cuerpo.logs.slice(0, 50) : [];
  for (const linea of logs) {
    // Sin saltos ni caracteres de control: nadie puede fabricar líneas de log falsas.
    const limpia = String(linea).replace(/[\x00-\x1f\x7f]+/g, " ").slice(0, 500);
    deps.log(`[apple-wallet] ${limpia}`);
  }
  return { status: 200, json: {} };
}
