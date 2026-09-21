import { randomBytes, randomUUID } from "crypto";
import {
  getNegocio, crearCliente, listClientes, tocarClientesDeNegocio,
  pushTokens, borrarDispositivosPorToken, addEvento,
} from "./store";
import { hayApple, configApple } from "./apple/config";
import { enviarAvisos } from "./apple/apns";
import { hayWalletWallet, createPass, updatePass, buildPassBody } from "./walletwallet";
import { googleSaveUrl } from "./googlewallet";
import { appUrl } from "./url";

// ============================================================================
// WALLET — fachada única para emitir pases y avisar de cambios
// ----------------------------------------------------------------------------
// Las rutas NO saben qué proveedor hay debajo. Se elige solo según las variables:
//   "apple"        firma propia + web service + APNs (cuenta Apple Developer)
//   "walletwallet" servicio externo (plan B, sin cuenta de Apple)
//   "demo"         nada configurado: el estado vive en el store, sin pase real
// ============================================================================

const LOTE_WALLETWALLET = 10;

/** @returns {"apple"|"walletwallet"|"demo"} */
export function proveedorWallet() {
  if (hayApple()) return "apple";
  if (hayWalletWallet()) return "walletwallet";
  return "demo";
}

/**
 * Crea un cliente nuevo con su pase (el "tap NFC").
 * El serial es NUESTRO (uuid): va en el QR desde el primer momento.
 * `origen` ("tap" | "manager") queda guardado: el CRM lo usa para saber por
 * dónde entra la gente.
 * @returns {Promise<{cliente:object, negocio:object, proveedor:string, urlPase:string, shareUrl:string, pkpassWalletWallet:Buffer|null, googleSaveUrl:string|null}>}
 */
export async function emitirPase(slug, { origen = null } = {}) {
  const negocio = await getNegocio(slug);
  if (!negocio) throw new Error(`Negocio desconocido: ${slug}`);

  const proveedor = proveedorWallet();
  const serial = randomUUID();
  const authToken = randomBytes(24).toString("hex"); // autentica al iPhone ante el web service

  let wwSerial = null;
  let shareUrl = null;
  let pkpassWalletWallet = null;
  if (proveedor === "walletwallet") {
    const creado = await createPass(buildPassBody({ serial, sellos: 0, premios: 0, nombre: null }, negocio));
    wwSerial = creado.wwSerial;
    shareUrl = creado.shareUrl;
    pkpassWalletWallet = creado.applePass ? Buffer.from(creado.applePass, "base64") : null;
  }

  const cliente = await crearCliente({ serial, negocio: slug, authToken, wwSerial, origen });
  // El alta abre el historial del cliente: sin ella, su ficha empieza en el aire.
  await addEvento(serial, "alta", origen === "manager" ? "Pase emitido en el mostrador" : "Pase emitido", {
    negocio: slug,
    actor: origen || "cliente",
  });
  const urlPase = `${appUrl()}/p/${serial}`;

  return {
    cliente,
    negocio,
    proveedor,
    urlPase,
    shareUrl: shareUrl || urlPase,
    pkpassWalletWallet,
    googleSaveUrl: googleSaveUrl(cliente, negocio),
  };
}

// Aviso a una lista de tokens + limpieza de los que Apple ya no acepta.
async function avisarApple(tokens) {
  const r = await enviarAvisos(tokens, configApple());
  await borrarDispositivosPorToken(r.invalidos);
  if (r.errores.length) {
    console.error("[apns] avisos con error:", JSON.stringify(r.errores.slice(0, 5)));
  }
  return r;
}

/**
 * Avisa al Wallet de que el pase de UN cliente cambió. Llamar DESPUÉS de guardar
 * (saveCliente marca `actualizado`). Nunca lanza: el estado ya está guardado y el
 * pase se pondrá al día en la próxima sincronización aunque el aviso falle.
 * @returns {Promise<{proveedor:string, avisados:number, error?:string}>}
 */
export async function notificarCliente(cliente, negocio) {
  const proveedor = proveedorWallet();
  try {
    if (proveedor === "apple") {
      const r = await avisarApple(await pushTokens({ seriales: [cliente.serial] }));
      return { proveedor, avisados: r.enviados };
    }
    if (proveedor === "walletwallet") {
      await updatePass(cliente.ww_serial, buildPassBody(cliente, negocio));
      return { proveedor, avisados: 1 };
    }
    return { proveedor, avisados: 0 };
  } catch (e) {
    console.error(`[wallet] aviso fallido para ${cliente.serial}:`, e);
    return { proveedor, avisados: 0, error: String(e?.message || e) };
  }
}

/**
 * Avisa a una LISTA de clientes (una campaña a un grupo). A diferencia de
 * `notificarNegocio`, aquí no se toca a nadie más: el resto de la tienda ni se
 * entera. Llamar DESPUÉS de escribir el mensaje (eso marca `actualizado`).
 *
 * Nunca lanza: el mensaje ya está guardado y el pase lo recogerá en la próxima
 * sincronización aunque el empujón falle.
 *
 * @param {string[]} seriales
 * @returns {Promise<{proveedor:string, avisados:number, total:number, error?:string}>}
 */
export async function avisarSeriales(seriales) {
  const proveedor = proveedorWallet();
  if (!seriales.length) return { proveedor, avisados: 0, total: 0 };
  try {
    if (proveedor === "apple") {
      const tokens = await pushTokens({ seriales });
      const r = await avisarApple(tokens);
      return { proveedor, avisados: r.enviados, total: tokens.length };
    }
    // Sin Apple no hay empujón por cliente: el pase se pondrá al día al abrirlo.
    return { proveedor, avisados: 0, total: seriales.length };
  } catch (e) {
    console.error("[wallet] avisos de campaña fallidos:", e);
    return { proveedor, avisados: 0, total: seriales.length, error: String(e?.message || e) };
  }
}

/**
 * Avisa a TODOS los pases de un negocio (promo, cambio de premio/meta/ubicación).
 * @returns {Promise<{proveedor:string, total:number, enviadas:number, fallidas:object[]}>}
 */
export async function notificarNegocio(negocio) {
  const proveedor = proveedorWallet();

  if (proveedor === "apple") {
    await tocarClientesDeNegocio(negocio.slug);
    const tokens = await pushTokens({ negocio: negocio.slug });
    try {
      const r = await avisarApple(tokens);
      return { proveedor, total: tokens.length, enviadas: r.enviados, fallidas: r.errores };
    } catch (e) {
      console.error(`[wallet] avisos del negocio ${negocio.slug} fallidos:`, e);
      return { proveedor, total: tokens.length, enviadas: 0, fallidas: [{ error: String(e?.message || e) }] };
    }
  }

  const clientes = await listClientes(negocio.slug);
  if (proveedor === "demo") return { proveedor, total: clientes.length, enviadas: 0, fallidas: [] };

  // En lotes concurrentes: uno a uno, una promo a cientos de clientes agotaría el
  // tiempo máximo de la función serverless.
  const resultados = [];
  for (let i = 0; i < clientes.length; i += LOTE_WALLETWALLET) {
    const lote = clientes.slice(i, i + LOTE_WALLETWALLET);
    resultados.push(...await Promise.allSettled(lote.map((c) => updatePass(c.ww_serial, buildPassBody(c, negocio)))));
  }
  const fallidas = resultados
    .map((r, i) => (r.status === "rejected" ? { serial: clientes[i].serial, error: String(r.reason?.message || r.reason) } : null))
    .filter(Boolean);
  return { proveedor, total: clientes.length, enviadas: clientes.length - fallidas.length, fallidas };
}
