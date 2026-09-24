import { randomBytes, randomUUID } from "crypto";
import {
  getNegocio, crearCliente, listClientes, tocarClientesDeNegocio,
  pushTokens, destinosDeAviso, borrarDispositivosPorToken, borrarDispositivos, addEvento,
} from "./store";
import { hayApple, configsDeTienda } from "./apple/config";
import { enviarAvisos } from "./apple/apns";
import { hayWalletWallet, createPass, updatePass, buildPassBody } from "./walletwallet";
import { hayGoogle, rutaGuardarGoogle, actualizarEnGoogle, mensajeEnGoogle, tiendaEnGoogle } from "./googlewallet";
import { enviarPush } from "./push/enviar";
import { TIPO_WEB } from "./push/suscripcion";
import { avisoDeCambio, avisoDePromo, avisoDeMensaje, avisoPush } from "./avisos";
import { appUrl } from "./url";

// ============================================================================
// WALLET — fachada única para emitir pases y avisar de cambios
// ----------------------------------------------------------------------------
// Las rutas NO saben qué hay debajo. El PASE (lo que se descarga en el iPhone)
// se elige solo según las variables:
//   "apple"        firma propia + web service + APNs (cuenta Apple Developer)
//   "walletwallet" servicio externo (plan B, sin cuenta de Apple)
//   "demo"         nada configurado: el estado vive en el store, sin pase real
//
// Y los AVISOS van por todos los canales a la vez, cada uno a quien lo tenga:
//   iPhone        APNs -> el iPhone baja el pase nuevo (y avisa si cambia un campo)
//   Android web   aviso del navegador a quien lo activó en su tarjeta (/p/<serial>)
//   Google Wallet se reescribe el objeto; Google avisa y lo empuja al teléfono
//
// Ningún canal tumba la acción: el estado ya está guardado cuando se avisa.
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
  const rutaGoogle = rutaGuardarGoogle(serial);

  return {
    cliente,
    negocio,
    proveedor,
    urlPase,
    shareUrl: shareUrl || urlPase,
    pkpassWalletWallet,
    googleSaveUrl: rutaGoogle ? `${appUrl()}${rutaGoogle}` : null,
  };
}

// Avisa a los iPhone de una tienda y limpia los tokens que Apple ya no acepta.
// Cada aviso sale con el certificado de SU Pass Type ID (es el topic de APNs):
// los pases de antes de que la tienda tuviera uno propio siguen en el general.
async function avisarApple(filtro, slug) {
  const total = { enviados: 0, tokens: 0, errores: [] };
  for (const config of configsDeTienda(slug)) {
    const tokens = await pushTokens({ ...filtro, passType: config.passTypeId });
    if (!tokens.length) continue;
    const r = await enviarAvisos(tokens, config);
    await borrarDispositivosPorToken(r.invalidos);
    if (r.errores.length) {
      console.error(`[apns] avisos con error (${config.passTypeId}):`, JSON.stringify(r.errores.slice(0, 5)));
    }
    total.enviados += r.enviados;
    total.tokens += tokens.length;
    total.errores.push(...r.errores);
  }
  return total;
}

/**
 * Avisos del navegador. `aviso(serial)` da el texto de cada uno (o null para
 * saltarlo). Nunca lanza.
 * @returns {Promise<number>} cuántos navegadores lo recibieron
 */
async function avisarNavegadores(filtro, negocio, aviso) {
  try {
    const registrados = await destinosDeAviso({ ...filtro, passType: TIPO_WEB });
    const destinos = registrados
      .map((d) => ({ token: d.token, a: aviso(d.serial), serial: d.serial }))
      .filter((d) => d.a)
      .map((d) => ({ token: d.token, payload: avisoPush(d.a, negocio, d.serial) }));
    if (!destinos.length) return 0;
    const r = await enviarPush(destinos);
    if (r.errores.length) console.error("[push] avisos con error:", JSON.stringify(r.errores.slice(0, 5)));
    // El navegador ya no quiere avisos (desinstaló, borró datos): fuera, por id.
    const muertos = new Set(r.caducados);
    await borrarDispositivos([...new Set(registrados.filter((d) => muertos.has(d.token)).map((d) => d.dispositivo))])
      .catch((e) => console.error("[push] no se pudieron borrar suscripciones caducadas:", e));
    return r.enviados;
  } catch (e) {
    console.error("[push] avisos fallidos:", e);
    return 0;
  }
}

/**
 * Avisa a los teléfonos de que la tarjeta de UN cliente cambió. Llamar DESPUÉS
 * de guardar (saveCliente marca `actualizado`). Nunca lanza.
 *
 * `antes`: el estado previo. Con él se sabe QUÉ pasó (un sello, un canje) y se
 * decide si merece sonar en Android; sin él (un cambio de nombre), la tarjeta
 * se pone al día en silencio.
 *
 * @returns {Promise<{proveedor:string, avisados:number, web:number, google:number, error?:string}>}
 */
export async function notificarCliente(cliente, negocio, { antes = null } = {}) {
  const proveedor = proveedorWallet();
  const aviso = avisoDeCambio(antes, cliente, negocio);

  const [web, google] = await Promise.all([
    aviso ? avisarNavegadores({ seriales: [cliente.serial] }, negocio, () => aviso) : 0,
    actualizarEnGoogle(cliente, negocio, { notificar: Boolean(aviso) }),
  ]);

  try {
    if (proveedor === "apple") {
      const r = await avisarApple({ seriales: [cliente.serial] }, cliente.negocio);
      return { proveedor, avisados: r.enviados, web, google };
    }
    if (proveedor === "walletwallet") {
      await updatePass(cliente.ww_serial, buildPassBody(cliente, negocio));
      return { proveedor, avisados: 1, web, google };
    }
    return { proveedor, avisados: 0, web, google };
  } catch (e) {
    console.error(`[wallet] aviso fallido para ${cliente.serial}:`, e);
    return { proveedor, avisados: 0, web, google, error: String(e?.message || e) };
  }
}

/**
 * Avisa a una LISTA de clientes (una campaña a un grupo). A diferencia de
 * `notificarNegocio`, aquí no se toca a nadie más: el resto de la tienda ni se
 * entera. Llamar DESPUÉS de escribir el mensaje (eso marca `actualizado`).
 *
 * `negocio` y `texto` hacen falta para Android: Apple pinta el mensaje desde el
 * pase, pero al navegador y a Google hay que decirles qué poner. Sin texto (se
 * retira la campaña) Android no suena: solo se limpia la tarjeta de Google.
 *
 * Nunca lanza: el mensaje ya está guardado y el pase lo recogerá en la próxima
 * sincronización aunque el empujón falle.
 *
 * @param {string[]} seriales
 * @param {{negocio?:object, texto?:string|null}} [opciones]
 * @returns {Promise<{proveedor:string, avisados:number, total:number, web:number, google:number, error?:string}>}
 */
export async function avisarSeriales(seriales, { negocio = null, texto = null } = {}) {
  const proveedor = proveedorWallet();
  if (!seriales.length) return { proveedor, avisados: 0, total: 0, web: 0, google: 0 };

  let web = 0;
  let google = 0;
  if (negocio) {
    const lista = new Set(seriales);
    // Los clientes enteros solo hacen falta para reescribir sus tarjetas de Google.
    const clientes = hayGoogle()
      ? (await listClientes(negocio.slug).catch(() => [])).filter((c) => lista.has(c.serial))
      : [];
    [web, google] = await Promise.all([
      texto ? avisarNavegadores({ seriales }, negocio, () => avisoDeMensaje(negocio, texto)) : 0,
      mensajeEnGoogle(clientes, negocio, texto),
    ]);
  }

  try {
    if (proveedor === "apple") {
      const r = await avisarApple({ seriales }, negocio?.slug);
      return { proveedor, avisados: r.enviados, total: r.tokens, web, google };
    }
    // Sin Apple no hay empujón por cliente: el pase se pondrá al día al abrirlo.
    return { proveedor, avisados: 0, total: seriales.length, web, google };
  } catch (e) {
    console.error("[wallet] avisos de campaña fallidos:", e);
    return { proveedor, avisados: 0, total: seriales.length, web, google, error: String(e?.message || e) };
  }
}

/**
 * Avisa a TODOS los pases de un negocio (promo, cambio de premio/meta/ubicación).
 *
 * `promoNueva`: el texto de una promo recién lanzada. Es lo único que hace sonar
 * Android (en iPhone suena solo, porque cambia un campo del pase). Guardar la
 * cartilla o retirar una promo pone las tarjetas al día sin molestar a nadie.
 * `cartilla`: cambiaron sellos o premio, así que las tarjetas de Google se
 * reescriben una a una (su "5/8" pasa a "5/10").
 *
 * @param {{promoNueva?:string|null, cartilla?:boolean}} [opciones]
 * @returns {Promise<{proveedor:string, total:number, enviadas:number, fallidas:object[], web:number, google:number}>}
 */
export async function notificarNegocio(negocio, { promoNueva = null, cartilla = false } = {}) {
  const proveedor = proveedorWallet();

  const android = async () => {
    const clientes = cartilla && hayGoogle() ? await listClientes(negocio.slug).catch(() => []) : null;
    return Promise.all([
      promoNueva ? avisarNavegadores({ negocio: negocio.slug }, negocio, () => avisoDePromo(negocio, promoNueva)) : 0,
      tiendaEnGoogle(negocio, { promoNueva, clientes }),
    ]);
  };

  if (proveedor === "apple") {
    await tocarClientesDeNegocio(negocio.slug);
    const [apple, [web, google]] = await Promise.all([
      avisarApple({ negocio: negocio.slug }, negocio.slug).catch((e) => {
        console.error(`[wallet] avisos del negocio ${negocio.slug} fallidos:`, e);
        return { enviados: 0, tokens: 0, errores: [{ error: String(e?.message || e) }] };
      }),
      android(),
    ]);
    return { proveedor, total: apple.tokens, enviadas: apple.enviados, fallidas: apple.errores, web, google };
  }

  const [clientes, [web, google]] = await Promise.all([listClientes(negocio.slug), android()]);
  if (proveedor === "demo") return { proveedor, total: clientes.length, enviadas: 0, fallidas: [], web, google };

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
  return { proveedor, total: clientes.length, enviadas: clientes.length - fallidas.length, fallidas, web, google };
}
