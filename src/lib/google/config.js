import { leerPem } from "../apple/config";

// ============================================================================
// GOOGLE WALLET — configuración (cuenta de servicio del emisor)
// ----------------------------------------------------------------------------
// Dos formas de dar las credenciales, la que sea más cómoda al pegar en Vercel:
//
//   A) GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SA_JSON
//      el fichero .json de la cuenta de servicio tal cual (o en base64)
//   B) GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SA_EMAIL + GOOGLE_WALLET_SA_KEY
//      el email y la clave privada por separado (PEM, con \n o en base64)
//
// Guía completa: docs/GOOGLE-WALLET.md
// ============================================================================

function leerJsonCuenta(valor) {
  const limpio = valor.trim();
  const texto = limpio.startsWith("{") ? limpio : Buffer.from(limpio, "base64").toString("utf8");
  const json = JSON.parse(texto);
  if (!json.client_email || !json.private_key) throw new Error("El JSON no trae client_email y private_key");
  return { email: json.client_email, key: json.private_key };
}

/** Qué variables faltan (vacío = listo). */
export function faltanVariablesGoogle() {
  const faltan = [];
  if (!process.env.GOOGLE_WALLET_ISSUER_ID?.trim()) faltan.push("GOOGLE_WALLET_ISSUER_ID");
  if (!process.env.GOOGLE_WALLET_SA_JSON?.trim()) {
    if (!process.env.GOOGLE_WALLET_SA_EMAIL?.trim()) faltan.push("GOOGLE_WALLET_SA_EMAIL (o GOOGLE_WALLET_SA_JSON)");
    if (!process.env.GOOGLE_WALLET_SA_KEY?.trim()) faltan.push("GOOGLE_WALLET_SA_KEY (o GOOGLE_WALLET_SA_JSON)");
  }
  return faltan;
}

export const hayGoogle = () => faltanVariablesGoogle().length === 0;

/**
 * Credenciales listas para firmar, o null si falta algo. Lanza si están pero no
 * se pueden leer (así el diagnóstico lo dice en vez de fallar en silencio).
 * @returns {null | {issuerId:string, email:string, key:string}}
 */
export function configGoogle() {
  if (!hayGoogle()) return null;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID.trim();
  const cuenta = process.env.GOOGLE_WALLET_SA_JSON?.trim()
    ? leerJsonCuenta(process.env.GOOGLE_WALLET_SA_JSON)
    : { email: process.env.GOOGLE_WALLET_SA_EMAIL.trim(), key: process.env.GOOGLE_WALLET_SA_KEY };
  return { issuerId, email: cuenta.email, key: leerPem(cuenta.key) };
}
