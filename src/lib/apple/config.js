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
//
// PASS TYPE ID PROPIO DE UNA TIENDA. Wallet apila en un solo montón todos los
// pases que comparten Pass Type ID: con uno para todas, la tarjeta de una tienda
// sale agrupada con las de las demás. Una tienda se separa con dos variables más:
//   APPLE_PASS_TYPE_ID_<SLUG>  pass.com.tudominio.delicanteria
//   APPLE_PASS_CERT_<SLUG>     su certificado, pedido con el MISMO CSR que el
//                              general: así comparte APPLE_PASS_KEY
// <SLUG> es el slug en mayúsculas y con "_" por "-" (la-deli -> LA_DELI). Team
// ID, clave y WWDR son de la cuenta y no se repiten.
// Genera las dos: node scripts/apple-setup.mjs env --tienda <slug> --cer <.cer>
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

/** Nombres de las variables que cambian por tienda (o las generales, sin slug). */
export function variablesDe(slug) {
  if (!slug) return { passTypeId: "APPLE_PASS_TYPE_ID", cert: "APPLE_PASS_CERT" };
  const sufijo = slug.toUpperCase().replace(/-/g, "_");
  return { passTypeId: `APPLE_PASS_TYPE_ID_${sufijo}`, cert: `APPLE_PASS_CERT_${sufijo}` };
}

/**
 * Las variables propias de una tienda que faltan cuando solo está puesta una de
 * las dos. Vacío si están las dos o ninguna (ninguna = usa el Pass Type ID general).
 */
export function faltanVariablesTienda(slug) {
  const nombres = Object.values(variablesDe(slug));
  const faltan = nombres.filter((v) => !process.env[v]);
  return faltan.length === 1 ? faltan : [];
}

/**
 * Slugs de las tiendas con Pass Type ID propio, leídos de las variables (basta
 * una de las dos: así el panel ve también las que están a medias).
 */
export function tiendasConPassTypePropio() {
  const sufijos = Object.keys(process.env)
    .filter((k) => process.env[k])
    .map((k) => /^APPLE_PASS_(?:TYPE_ID|CERT)_([A-Z0-9_]+)$/.exec(k)?.[1])
    .filter(Boolean);
  return [...new Set(sufijos)].map((s) => s.toLowerCase().replace(/_/g, "-")).sort();
}

/**
 * Config lista para firmar y para APNs, o null si falta algo. Con `slug`, la de
 * esa tienda si tiene Pass Type ID propio; si no, la general. `tienda` dice de
 * quién es el certificado (null = el general, compartido).
 * @param {string} [slug]
 * @returns {null | {passTypeId:string, teamId:string, cert:string, key:string, passphrase?:string, wwdr:string, tienda:string|null}}
 */
export function configApple(slug) {
  if (!hayApple()) return null;
  const general = {
    passTypeId: process.env.APPLE_PASS_TYPE_ID.trim(),
    teamId: process.env.APPLE_TEAM_ID.trim(),
    cert: leerPem(process.env.APPLE_PASS_CERT),
    key: leerPem(process.env.APPLE_PASS_KEY),
    passphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    wwdr: leerPem(process.env.APPLE_WWDR_CERT),
    tienda: null,
  };
  if (!slug) return general;
  const vars = variablesDe(slug);
  const passTypeId = process.env[vars.passTypeId]?.trim();
  const cert = process.env[vars.cert];
  if (!passTypeId || !cert) return general;
  return { ...general, passTypeId, cert: leerPem(cert), tienda: slug };
}

/**
 * Las configs con que pueden estar firmados los pases de una tienda: la suya y
 * la general. Un pase no cambia nunca de Pass Type ID (Apple solo acepta la
 * actualización si coincide), así que los emitidos antes de que la tienda
 * tuviera uno propio siguen en el general hasta que el cliente los reinstale.
 * @returns {NonNullable<ReturnType<typeof configApple>>[]}
 */
export function configsDeTienda(slug) {
  const general = configApple();
  if (!general) return [];
  const propia = configApple(slug);
  return propia.passTypeId === general.passTypeId ? [general] : [propia, general];
}
