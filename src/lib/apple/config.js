// ============================================================================
// APPLE WALLET — configuración (certificados de la cuenta de Apple Developer)
// ----------------------------------------------------------------------------
// Con estas variables firmamos los pases NOSOTROS y enviamos los avisos de
// actualización por APNs, sin intermediarios. Se generan con:
//   node scripts/apple-setup.mjs csr   -> subes el CSR a developer.apple.com
//   node scripts/apple-setup.mjs env   -> convierte el .cer en estas variables
// Guía completa: docs/APPLE-WALLET.md
//
//   APPLE_PASS_TYPE_ID        pass.com.tudominio.sellos
//   APPLE_TEAM_ID             10 caracteres (Membership details)
//   APPLE_PASS_CERT           certificado del Pass Type ID (PEM o PEM en base64)
//   APPLE_PASS_KEY            su clave privada (PEM o PEM en base64)
//   APPLE_PASS_KEY_PASSPHRASE opcional, si la clave está cifrada
//   APPLE_WWDR_CERT           intermedio Apple WWDR G4 (PEM o PEM en base64)
// ============================================================================

const REQUERIDAS = [
  "APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "APPLE_PASS_CERT",
  "APPLE_PASS_KEY",
  "APPLE_WWDR_CERT",
];

/** Variables de Apple que faltan (vacío = listo para firmar). */
export const faltanVariablesApple = () => REQUERIDAS.filter((v) => !process.env[v]);

export const hayApple = () => faltanVariablesApple().length === 0;

/**
 * Acepta un PEM tal cual, con "\n" escapados (típico al pegar en Vercel) o en
 * base64 (lo que genera el script, una sola línea sin problemas de saltos).
 */
export function leerPem(valor) {
  if (!valor) return null;
  const limpio = valor.trim();
  if (limpio.includes("-----BEGIN")) return limpio.replace(/\\n/g, "\n");
  const decodificado = Buffer.from(limpio, "base64").toString("utf8");
  if (!decodificado.includes("-----BEGIN")) {
    throw new Error("Certificado de Apple ilegible: ni PEM ni PEM en base64");
  }
  return decodificado;
}

/**
 * Config lista para firmar y para APNs, o null si falta algo.
 * @returns {null | {passTypeId:string, teamId:string, cert:string, key:string, passphrase?:string, wwdr:string}}
 */
export function configApple() {
  if (!hayApple()) return null;
  return {
    passTypeId: process.env.APPLE_PASS_TYPE_ID.trim(),
    teamId: process.env.APPLE_TEAM_ID.trim(),
    cert: leerPem(process.env.APPLE_PASS_CERT),
    key: leerPem(process.env.APPLE_PASS_KEY),
    passphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    wwdr: leerPem(process.env.APPLE_WWDR_CERT),
  };
}
