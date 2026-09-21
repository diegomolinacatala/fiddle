import { createSign } from "node:crypto";
import { construirClase, construirObjeto, idClase, idObjeto, mensajeConAviso } from "./pase";
import { appUrl as urlDeLaApp } from "../url";

// ============================================================================
// GOOGLE WALLET — API REST (walletobjects/v1)
// ----------------------------------------------------------------------------
// El equivalente del web service + APNs de Apple, pero al revés: aquí no es el
// teléfono el que pregunta, somos nosotros los que le cambiamos el pase a Google
// y Google lo empuja a los Android que lo tienen.
//
//   token      OAuth de la cuenta de servicio (JWT RS256 -> access_token, 1 h)
//   clase      una por tienda: se crea la primera vez y se reescribe si cambia
//   objeto     uno por cliente: se crea al guardarlo y se reescribe con cada sello
//   mensajes   addMessage con TEXT_AND_NOTIFY: lo que hace sonar el teléfono
//
// `opciones.fetch` y `opciones.appUrl` son inyectables para los tests.
// ============================================================================

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ALCANCE = "https://www.googleapis.com/auth/wallet_object.issuer";
const TIMEOUT_MS = 8000;

export class ErrorGoogle extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

const b64url = (texto) => Buffer.from(texto).toString("base64url");

/** JWT firmado con la clave de la cuenta de servicio (RS256). */
export function firmarJwt(claims, clave) {
  const sinFirmar = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  return `${sinFirmar}.${createSign("RSA-SHA256").update(sinFirmar).sign(clave).toString("base64url")}`;
}

let token = null; // { valor, caduca, email }
const clasesAlDia = new Map(); // id de clase -> lo último que Google aceptó

/** Solo tests: empezar sin token ni clases recordadas. */
export function olvidarEstado() {
  token = null;
  clasesAlDia.clear();
}

/** Access token de la cuenta de servicio, reutilizado hasta un minuto antes de caducar. */
export async function tokenDeAcceso(config, { fetch: f = fetch, ahora = Date.now() } = {}) {
  if (token && token.email === config.email && token.caduca - 60_000 > ahora) return token.valor;
  const iat = Math.floor(ahora / 1000);
  const assertion = firmarJwt({ iss: config.email, scope: ALCANCE, aud: TOKEN_URL, iat, exp: iat + 3600 }, config.key);
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new ErrorGoogle(`Google no dio acceso a la cuenta de servicio: ${json.error_description || json.error || res.status}`, res.status);
  }
  token = { valor: json.access_token, caduca: ahora + (json.expires_in || 3600) * 1000, email: config.email };
  return token.valor;
}

async function llamar(config, metodo, ruta, cuerpo, opciones = {}) {
  const f = opciones.fetch || fetch;
  const acceso = await tokenDeAcceso(config, opciones);
  const res = await f(`${API}/${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${acceso}`, "content-type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { estado: res.status, json: await res.json().catch(() => null) };
}

function exigirOk(r, contexto) {
  if (r.estado >= 200 && r.estado < 300) return r.json;
  throw new ErrorGoogle(`Google Wallet (${contexto}): ${r.json?.error?.message || `HTTP ${r.estado}`}`, r.estado);
}

const base = (config, opciones) => ({ issuerId: config.issuerId, appUrl: opciones.appUrl || urlDeLaApp() });
const ruta = (tipo, id) => `${tipo}/${encodeURIComponent(id)}`;

/**
 * Deja la clase de la tienda como dice `construirClase`: la crea si no existe y
 * la reescribe si ha cambiado. Recuerda lo último enviado para no repetirlo en
 * cada sello.
 * @param {{conMensajes?: boolean, forzar?: boolean}} [opciones]
 * @returns {Promise<string>} id de la clase
 */
export async function asegurarClase(config, negocio, opciones = {}) {
  const clase = construirClase(negocio, base(config, opciones), { conMensajes: opciones.conMensajes !== false });
  const huella = JSON.stringify(clase);
  if (!opciones.forzar && clasesAlDia.get(clase.id) === huella) return clase.id;

  const r = await llamar(config, "PUT", ruta("loyaltyClass", clase.id), clase, opciones);
  if (r.estado === 404) exigirOk(await llamar(config, "POST", "loyaltyClass", clase, opciones), "crear la clase");
  else exigirOk(r, "actualizar la clase");
  clasesAlDia.set(clase.id, huella);
  return clase.id;
}

/**
 * Crea o reescribe el objeto de un cliente. Es lo que se hace antes de darle el
 * enlace de guardar: así el enlace solo lleva el id (cabe en una URL) y lo que
 * se guarda es exactamente el estado de ahora.
 * @returns {Promise<string>} id del objeto
 */
export async function guardarObjeto(config, cliente, negocio, opciones = {}) {
  await asegurarClase(config, negocio, opciones);
  const objeto = construirObjeto(cliente, negocio, base(config, opciones));
  const r = await llamar(config, "PUT", ruta("loyaltyObject", objeto.id), objeto, opciones);
  if (r.estado === 404) exigirOk(await llamar(config, "POST", "loyaltyObject", objeto, opciones), "crear el objeto");
  else exigirOk(r, "actualizar el objeto");
  return objeto.id;
}

/**
 * Pone al día el pase de un cliente que ya lo tiene en Google Wallet.
 * `notificar`: Google avisa en el teléfono si cambian los puntos (los sellos).
 * @returns {Promise<boolean>} false si ese objeto no existe (nunca lo guardó)
 */
export async function actualizarObjeto(config, cliente, negocio, { notificar = false, conMensajes = true, ...opciones } = {}) {
  await asegurarClase(config, negocio, opciones);
  const objeto = construirObjeto(cliente, negocio, base(config, opciones), { conMensajes });
  if (notificar) objeto.notifyPreference = "NOTIFY_ON_UPDATE";
  const r = await llamar(config, "PUT", ruta("loyaltyObject", objeto.id), objeto, opciones);
  if (r.estado === 404) return false;
  exigirOk(r, "actualizar el objeto");
  return true;
}

/** Mensaje con aviso a un cliente (una campaña). Google limita a 3 por pase y día. */
export async function avisarObjeto(config, cliente, negocio, cabecera, cuerpo, opciones = {}) {
  // Primero el objeto sin mensajes, para que el nuevo no salga repetido.
  const existe = await actualizarObjeto(config, cliente, negocio, { ...opciones, conMensajes: false });
  if (!existe) return false;
  const id = idObjeto(config.issuerId, cliente.serial);
  exigirOk(await llamar(config, "POST", `${ruta("loyaltyObject", id)}/addMessage`, mensajeConAviso("para-ti", cabecera, cuerpo), opciones), "mandar el mensaje");
  return true;
}

/** Mensaje con aviso a todos los que tienen la tarjeta de la tienda (una promo). */
export async function avisarClase(config, negocio, cabecera, cuerpo, opciones = {}) {
  await asegurarClase(config, negocio, { ...opciones, conMensajes: false, forzar: true });
  const id = idClase(config.issuerId, negocio.slug);
  exigirOk(await llamar(config, "POST", `${ruta("loyaltyClass", id)}/addMessage`, mensajeConAviso("promo", cabecera, cuerpo), opciones), "mandar la promo");
  // Lo que queda en Google ya es la clase con su promo: que el próximo sello no la reescriba.
  clasesAlDia.set(id, JSON.stringify(construirClase(negocio, base(config, opciones))));
}

/**
 * Enlace "Añadir a Google Wallet". Con el objeto ya creado por la API, el JWT
 * solo lleva su id y cabe de sobra en una URL (el límite práctico son 1.800
 * caracteres). `completo`: por si la API no respondió, el JWT lleva clase y
 * objeto enteros y Google los crea al guardarlo.
 */
export function enlaceGuardar(config, cliente, negocio, { completo = false, appUrl, ahora = Date.now() } = {}) {
  const b = { issuerId: config.issuerId, appUrl: appUrl || urlDeLaApp() };
  const payload = completo
    ? { loyaltyClasses: [construirClase(negocio, b)], loyaltyObjects: [construirObjeto(cliente, negocio, b)] }
    : { loyaltyObjects: [{ id: idObjeto(config.issuerId, cliente.serial), classId: idClase(config.issuerId, negocio.slug) }] };
  const jwt = firmarJwt({
    iss: config.email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(ahora / 1000),
    origins: [b.appUrl],
    payload,
  }, config.key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
