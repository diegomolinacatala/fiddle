import { X509Certificate, createPrivateKey } from "node:crypto";
import { configApple, faltanVariablesApple } from "./apple/config";
import { hasSupabase, comprobarTablas, contarSinCifrar } from "./store";
import { estadoClaveCifrado } from "./cifrado";
import { clavesPush } from "./push/vapid";
import { configGoogle, faltanVariablesGoogle } from "./google/config";
import { tokenDeAcceso } from "./google/api";

// ============================================================================
// DIAGNÓSTICO (panel "Estado de la integración" del manager)
// ----------------------------------------------------------------------------
// No basta con que las variables existan: aquí se comprueba que FUNCIONAN
// (certificado válido y de esta clave, Supabase responde y tiene las tablas) y
// se traduce cada fallo a qué hay que tocar. Nunca devuelve valores secretos.
// ============================================================================

const DIAS_AVISO_CADUCIDAD = 30;
const TIMEOUT_SUPABASE_MS = 8000;
const DIA_MS = 24 * 60 * 60 * 1000;

// "UID=pass.x\nCN=...\nOU=TEAM" -> { UID, CN, OU }
function camposSujeto(sujeto) {
  return Object.fromEntries(
    sujeto.split(/\n/).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

/**
 * Comprueba el certificado de Apple Wallet.
 * @param {ReturnType<typeof configApple>} [config]
 * @returns {{ok:boolean, problemas:string[], avisos:string[], passTypeId?:string, teamId?:string, caduca?:string, diasRestantes?:number}}
 */
export function diagnosticoApple(config, ahora = Date.now()) {
  const faltan = faltanVariablesApple();
  if (!config) {
    return { ok: false, problemas: [faltan.length ? `Faltan variables: ${faltan.join(", ")}` : "Configuración de Apple ilegible"], avisos: [] };
  }

  const problemas = [];
  const avisos = [];
  let cert;
  try {
    cert = new X509Certificate(config.cert);
  } catch {
    return { ok: false, problemas: ["APPLE_PASS_CERT no es un certificado válido (¿valor cortado al pegarlo?)"], avisos };
  }

  const sujeto = camposSujeto(cert.subject);
  const caduca = new Date(cert.validTo);
  const diasRestantes = Math.floor((caduca.getTime() - ahora) / DIA_MS);

  try {
    if (!cert.checkPrivateKey(createPrivateKey({ key: config.key, passphrase: config.passphrase }))) {
      problemas.push("APPLE_PASS_KEY no corresponde al certificado (¿pegada la de otro certificado?)");
    }
  } catch {
    problemas.push("APPLE_PASS_KEY no es una clave privada válida (¿valor cortado al pegarlo?)");
  }

  if (sujeto.UID !== config.passTypeId) {
    problemas.push(`APPLE_PASS_TYPE_ID (${config.passTypeId}) no coincide con el certificado (${sujeto.UID})`);
  }
  if (sujeto.OU !== config.teamId) {
    problemas.push(`APPLE_TEAM_ID (${config.teamId}) no coincide con el certificado (${sujeto.OU})`);
  }
  if (diasRestantes < 0) problemas.push(`El certificado caducó el ${caduca.toISOString().slice(0, 10)}`);
  else if (diasRestantes < DIAS_AVISO_CADUCIDAD) avisos.push(`El certificado caduca en ${diasRestantes} días: renuévalo`);

  try {
    const wwdr = new X509Certificate(config.wwdr);
    // checkIssued solo compara nombres; verify comprueba que lo firmó de verdad.
    if (!cert.checkIssued(wwdr) || !cert.verify(wwdr.publicKey)) {
      problemas.push("APPLE_WWDR_CERT no es el intermedio que emitió tu certificado (debe ser Apple WWDR G4)");
    }
  } catch {
    problemas.push("APPLE_WWDR_CERT no es un certificado válido (¿valor cortado al pegarlo?)");
  }

  return {
    ok: problemas.length === 0,
    problemas,
    avisos,
    passTypeId: sujeto.UID,
    teamId: sujeto.OU,
    caduca: caduca.toISOString().slice(0, 10),
    diasRestantes,
  };
}

/** Traduce el error de Supabase a qué hay que arreglar. */
export function explicarErrorSupabase(mensaje, tabla) {
  const m = String(mensaje || "");
  if (/does not exist|schema cache|could not find the table/i.test(m)) {
    return `Falta la tabla "${tabla}": ejecuta supabase/schema.sql en el SQL Editor`;
  }
  if (/invalid api key|jwt|apikey|unauthorized|no api key/i.test(m)) {
    return "SUPABASE_SERVICE_KEY no es válida (usa la Secret key o service_role, no la publishable/anon)";
  }
  if (/fetch failed|enotfound|getaddrinfo|invalid url|tiempo/i.test(m)) {
    return "No se puede conectar: revisa SUPABASE_URL (https://xxxx.supabase.co)";
  }
  if (/permission denied/i.test(m)) {
    return "Permiso denegado: la clave no es la de servicio (Secret key o service_role)";
  }
  return `Error de Supabase en "${tabla}": ${m.slice(0, 160)}`;
}

const conTimeout = (promesa, ms) =>
  Promise.race([promesa, new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("tiempo de espera agotado")), ms))]);

/**
 * Comprueba la base de datos de verdad (conexión + tablas).
 * @returns {Promise<{ok:boolean, detalle:string}>}
 */
export async function diagnosticoSupabase(comprobar = comprobarTablas) {
  if (!hasSupabase()) return { ok: false, detalle: "Sin SUPABASE_URL / SUPABASE_SERVICE_KEY: ficheros locales (no válido en Vercel)" };
  try {
    const r = await conTimeout(comprobar(), TIMEOUT_SUPABASE_MS);
    return r.ok
      ? { ok: true, detalle: "Supabase conectado · 6 tablas" }
      : { ok: false, detalle: explicarErrorSupabase(r.error, r.tabla) };
  } catch (e) {
    return { ok: false, detalle: explicarErrorSupabase(e?.message || e, "conexión") };
  }
}

// ============================== ANDROID ==============================

/**
 * Avisos del navegador (la tarjeta web de Android). Funcionan en cuanto hay
 * claves VAPID: fijas en variables o derivadas de AUTH_SECRET.
 * @returns {{ok:boolean, detalle:string}}
 */
export function diagnosticoPush(claves = clavesPush()) {
  if (!claves) {
    return { ok: false, detalle: "Sin AUTH_SECRET ni VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY: la tarjeta de Android no puede avisar" };
  }
  const publica = Buffer.from(claves.publica, "base64url");
  const privada = Buffer.from(claves.privada, "base64url");
  if (publica.length !== 65 || publica[0] !== 0x04 || privada.length !== 32) {
    return { ok: false, detalle: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no tienen el formato de web-push (base64url, 65 y 32 bytes)" };
  }
  return claves.origen === "variables"
    ? { ok: true, detalle: "Activos, con claves VAPID propias" }
    : { ok: true, detalle: "Activos (claves derivadas de AUTH_SECRET: si cambias AUTH_SECRET, los clientes tendrán que reactivarlos)" };
}

/**
 * Google Wallet: ¿están las credenciales, se pueden leer y las acepta Google?
 * `comprobar` pide un token de verdad (la prueba de que la cuenta de servicio vale).
 * @returns {Promise<{ok:boolean, configurado:boolean, detalle:string}>}
 */
export async function diagnosticoGoogle({ comprobar = (config) => tokenDeAcceso(config) } = {}) {
  const faltan = faltanVariablesGoogle();
  const algunaPuesta = ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SA_JSON", "GOOGLE_WALLET_SA_EMAIL", "GOOGLE_WALLET_SA_KEY"]
    .some((v) => process.env[v]?.trim());
  if (!algunaPuesta) {
    return {
      ok: false,
      configurado: false,
      detalle: "Sin configurar. Android usa la tarjeta web con avisos; para Google Wallet sigue docs/GOOGLE-WALLET.md",
    };
  }
  if (faltan.length) return { ok: false, configurado: true, detalle: `Faltan variables: ${faltan.join(", ")}` };

  let config;
  try {
    config = configGoogle();
    createPrivateKey(config.key);
  } catch (e) {
    return { ok: false, configurado: true, detalle: `La clave de la cuenta de servicio no se puede leer (${String(e.message).slice(0, 80)})` };
  }
  if (!/^\d{10,25}$/.test(config.issuerId)) {
    return { ok: false, configurado: true, detalle: "GOOGLE_WALLET_ISSUER_ID debe ser el número largo de la consola de Google Pay & Wallet" };
  }
  try {
    await conTimeout(comprobar(config), TIMEOUT_SUPABASE_MS);
    return { ok: true, configurado: true, detalle: `Emisor ${config.issuerId} · cuenta ${config.email}` };
  } catch (e) {
    return { ok: false, configurado: true, detalle: `Google rechaza la cuenta de servicio: ${String(e?.message || e).slice(0, 160)}` };
  }
}

/**
 * Nombres y notas de los clientes cifrados (lib/cifrado.js): que haya clave, que
 * sirva, y que no queden datos de antes en claro.
 * @returns {Promise<{ok:boolean, pendientes:number|null, detalle:string}>}
 */
export async function diagnosticoCifrado({ contar = contarSinCifrar } = {}) {
  const clave = estadoClaveCifrado();
  if (!clave.ok && clave.problema === "falta") {
    return { ok: false, pendientes: null, detalle: "Falta CIFRADO_CLAVE: los nombres y notas se guardan sin cifrar" };
  }
  if (!clave.ok) return { ok: false, pendientes: null, detalle: "CIFRADO_CLAVE no sirve: tienen que ser 32 bytes en base64" };
  try {
    const pendientes = await conTimeout(contar(), TIMEOUT_SUPABASE_MS);
    if (pendientes > 0) {
      return { ok: false, pendientes, detalle: `Cifrado activo, pero ${pendientes} clientes tienen datos de antes sin cifrar` };
    }
    return { ok: true, pendientes: 0, detalle: "Nombres y notas cifrados (AES-256-GCM)" };
  } catch (e) {
    return { ok: false, pendientes: null, detalle: `No se pudo comprobar: ${String(e?.message || e).slice(0, 120)}` };
  }
}
