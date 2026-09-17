import { X509Certificate, createPrivateKey } from "node:crypto";
import { configApple, faltanVariablesApple } from "./apple/config";
import { hasSupabase, comprobarTablas } from "./store";

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
