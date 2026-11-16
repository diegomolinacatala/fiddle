import { igualSeguro } from "../auth";

// ============================================================================
// LA TARJETA DEL DUEÑO: web service de Apple Wallet
// ----------------------------------------------------------------------------
// Mismo protocolo y mismos códigos que lib/apple/servicio.js (mira allí qué
// responde cada ruta), pero contra `negocio.tarjetaDueno` en vez de un cliente.
// Dependencias inyectadas para testearlo sin red ni base.
//
//   deps.tiendaDeSerial(serial)  -> negocio | null (con la tarjeta activa)
//   deps.tarjetaDe(negocio)      -> tarjeta normalizada
//   deps.conDispositivo / deps.sinDispositivo  (lib/dueno/tarjeta.js)
//   deps.guardarTarjeta(slug, patch | (tarjetaFresca) => patch)
//   deps.listNegocios()
//   deps.passTypeGeneral         el Pass Type ID con que se firma
//   deps.estadoVigente(negocio, ahora) -> { informe, aviso }
//   deps.generarPkpass(estado, negocio)
//   deps.log(mensaje)
// ============================================================================

const tokenDeCabecera = (authorization) => /^ApplePass\s+(\S+)$/.exec(authorization || "")?.[1] ?? null;
const noAutorizado = () => ({ status: 401, json: { error: "No autorizado" } });
const dispositivoValido = (d) => typeof d === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(d);
const dispositivoInvalido = () => ({ status: 400, json: { error: "Dispositivo inválido" } });

/** La tienda y su tarjeta si el token es el de la tarjeta y el passType es el general; si no, null. */
async function tiendaAutenticada(deps, passType, serial, authorization) {
  const token = tokenDeCabecera(authorization);
  if (!token || passType !== deps.passTypeGeneral) return null;
  const negocio = await deps.tiendaDeSerial(serial);
  const tarjeta = negocio && deps.tarjetaDe(negocio);
  return tarjeta && igualSeguro(token, tarjeta.token) ? { negocio, tarjeta } : null;
}

/** @returns {Promise<{status:number, json?:object, body?:Buffer, headers?:object}>} */
export async function registrar(deps, { dispositivo, passType, serial, authorization, cuerpo }) {
  if (!dispositivoValido(dispositivo)) return dispositivoInvalido();
  const tienda = await tiendaAutenticada(deps, passType, serial, authorization);
  if (!tienda) return noAutorizado();
  const pushToken = cuerpo?.pushToken;
  if (typeof pushToken !== "string" || !/^[0-9a-f]{16,200}$/i.test(pushToken)) {
    return { status: 400, json: { error: "pushToken inválido" } };
  }
  // La lista se calcula sobre la tarjeta recién leída: otro iPhone pudo registrarse entre medias.
  let nuevo = false;
  await deps.guardarTarjeta(tienda.negocio.slug, (fresca) => {
    const r = deps.conDispositivo(fresca.dispositivos, { id: dispositivo, token: pushToken, tipo: passType });
    nuevo = r.nuevo;
    return { dispositivos: r.dispositivos };
  });
  return { status: nuevo ? 201 : 200, json: {} };
}

export async function desregistrar(deps, { dispositivo, passType, serial, authorization }) {
  if (!dispositivoValido(dispositivo)) return dispositivoInvalido();
  const tienda = await tiendaAutenticada(deps, passType, serial, authorization);
  if (!tienda) return noAutorizado();
  await deps.guardarTarjeta(tienda.negocio.slug, (fresca) => ({
    dispositivos: deps.sinDispositivo(fresca.dispositivos, { id: dispositivo, tipo: passType }),
  }));
  return { status: 200, json: {} };
}

/**
 * Seriales de las tarjetas de dueño de este iPhone cambiadas después de `desde`.
 * Como en el de los clientes, no autentica: uno que no es nuestro sale 204.
 */
export async function pasesActualizados(deps, { dispositivo, passType, desde }) {
  if (!dispositivoValido(dispositivo)) return dispositivoInvalido();
  const desdeMs = /^\d+$/.test(desde || "") ? Number(desde) : 0;
  const cambiados = [];
  for (const negocio of await deps.listNegocios()) {
    const tarjeta = deps.tarjetaDe(negocio);
    const ms = Date.parse(tarjeta?.actualizado) || 0;
    const esDeEste = tarjeta?.dispositivos.some((d) => d.id === dispositivo && d.tipo === passType);
    // Sin `passesUpdatedSince` (la primera vez tras registrarse) el iPhone pide TODOS los
    // suyos: una tarjeta que aún no ha cambiado nunca también cuenta.
    if (esDeEste && (!desdeMs || ms > desdeMs)) cambiados.push({ serial: tarjeta.serial, ms });
  }
  if (!cambiados.length) return { status: 204 };
  return {
    status: 200,
    json: { serialNumbers: cambiados.map((p) => p.serial), lastUpdated: String(Math.max(...cambiados.map((p) => p.ms))) },
  };
}

/** El pase firmado de ahora. Siempre 200, sin 304, por lo mismo que el de los clientes. */
export async function paseActual(deps, { passType, serial, authorization, ahora = Date.now() }) {
  const tienda = await tiendaAutenticada(deps, passType, serial, authorization);
  if (!tienda) return noAutorizado();
  const estado = await deps.estadoVigente(tienda.negocio, ahora);
  const body = await deps.generarPkpass(estado, tienda.negocio);
  const actualizado = new Date(Date.parse(tienda.tarjeta.actualizado) || ahora);
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

/** Los logs del iPhone, saneados, al log del servidor con su propio prefijo. */
export function registrarLogs(deps, { cuerpo }) {
  const logs = Array.isArray(cuerpo?.logs) ? cuerpo.logs.slice(0, 50) : [];
  for (const linea of logs) {
    const limpia = String(linea).replace(/[\x00-\x1f\x7f]+/g, " ").slice(0, 500);
    deps.log(`[tarjeta-dueno] ${limpia}`);
  }
  return { status: 200, json: {} };
}
