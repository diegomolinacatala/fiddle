import crypto from "crypto";
import { appUrl, urlCaja } from "./url";

// ============================================================================
// GOOGLE WALLET (Android) — enlace "Guardar en Google Wallet"
// ----------------------------------------------------------------------------
// Paralelo a lib/apple (iPhone). Google no se "empuja" igual: se genera un JWT
// firmado con la CUENTA DE SERVICIO y el usuario lo guarda con un enlace. Las
// ACTUALIZACIONES posteriores (sellos) se hacen con la Google Wallet REST API
// sobre el objeto ya guardado (pendiente).
//
// Estado: esqueleto listo. Genera el "Save link" real (RS256) si hay
// credenciales; sin ellas devuelve null y la UI no muestra el botón.
//
// Para activarlo, en Google Pay & Wallet Console:
//   1. Un Issuer ID.
//   2. Una LoyaltyClass por negocio (id = `<issuer>.<slug>`, p.ej. `<issuer>.nube`).
//   3. Una cuenta de servicio con permiso sobre el issuer (email + private key).
// ============================================================================

export const hayGoogle = () =>
  Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SA_EMAIL &&
    process.env.GOOGLE_WALLET_SA_KEY,
  );

const b64url = (input) => Buffer.from(input).toString("base64url");

// Objeto de fidelización del cliente (equivalente a construirPassJson de Apple).
function loyaltyObject(cliente, negocio) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  const esCupon = negocio.tipo === "descuento";
  const balance = esCupon
    ? ((cliente.premios || 0) > 0 ? "Usado" : "Válido")
    : `${Math.min(cliente.sellos, negocio.meta)}/${negocio.meta}`;
  return {
    id: `${issuer}.${cliente.serial}`,
    classId: `${issuer}.${negocio.slug}`,
    state: "ACTIVE",
    accountName: cliente.nombre || "Cliente",
    accountId: cliente.serial,
    loyaltyPoints: { label: esCupon ? "Cupón" : "Sellos", balance: { string: balance } },
    barcode: { type: "QR_CODE", value: urlCaja(cliente.serial) },
  };
}

/**
 * Enlace "Guardar en Google Wallet" para un cliente, o null sin credenciales.
 * El JWT se firma con la private key de la cuenta de servicio (RS256).
 * @returns {string|null}
 */
export function googleSaveUrl(cliente, negocio) {
  if (!hayGoogle() || !cliente?.serial || !negocio) return null;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: process.env.GOOGLE_WALLET_SA_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [appUrl()],
    payload: { loyaltyObjects: [loyaltyObject(cliente, negocio)] },
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  // Las private keys de Google traen los saltos de línea escapados en env.
  const privateKey = process.env.GOOGLE_WALLET_SA_KEY.replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey).toString("base64url");

  return `https://pay.google.com/gp/v/save/${unsigned}.${signature}`;
}
