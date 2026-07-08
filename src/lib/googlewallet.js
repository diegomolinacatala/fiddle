import crypto from "crypto";
import { appUrl } from "./walletwallet";

// ============================================================================
// GOOGLE WALLET (Android) — enlace "Guardar en Google Wallet"
// ----------------------------------------------------------------------------
// Paralelo a walletwallet.js (Apple). A diferencia de Apple, Google no "empuja"
// vía nuestra API: se genera un JWT firmado con la CUENTA DE SERVICIO y el
// usuario lo guarda con un enlace. Las ACTUALIZACIONES posteriores (sellos) se
// hacen con la Google Wallet REST API sobre el objeto ya guardado.
//
// Estado: esqueleto listo y compilable. Genera el "Save link" real (RS256) si
// hay credenciales; en demo devuelve null (no rompe nada, igual que hoy).
//
// Para activarlo hace falta, en Google Pay & Wallet Console:
//   1. Un Issuer ID.
//   2. Una LoyaltyClass creada (id = `<issuer>.fidelizacion`).
//   3. Una cuenta de servicio con permiso sobre el issuer (email + private key).
// Ver docs/DEPLOY.md.
// ============================================================================

export const isDemoGoogle = () =>
  !(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SA_EMAIL &&
    process.env.GOOGLE_WALLET_SA_KEY
  );

// Una clase de fidelización por programa (se crea una vez en la consola).
const CLASS_SUFFIX = process.env.GOOGLE_WALLET_CLASS_SUFFIX || "fidelizacion";

const b64url = (input) => Buffer.from(input).toString("base64url");

// Modela el objeto de fidelización del cliente (equivalente a buildPassBody).
function loyaltyObject(cliente, prog) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  const meta = prog.meta;
  const sellos = Math.min(cliente.sellos, meta);
  return {
    id: `${issuer}.${cliente.serial}`,
    classId: `${issuer}.${CLASS_SUFFIX}`,
    state: "ACTIVE",
    accountName: cliente.nombre || "Cliente",
    accountId: cliente.serial,
    loyaltyPoints: {
      label: "Sellos",
      balance: { string: `${sellos}/${meta}` },
    },
    barcode: { type: "QR_CODE", value: `${appUrl()}/w/${cliente.serial}` },
  };
}

/**
 * Enlace "Guardar en Google Wallet" para un cliente. Devuelve la URL o null
 * (demo / sin credenciales). El JWT se firma con la private key de la cuenta
 * de servicio (RS256), sin dependencias externas.
 *
 * @param {{serial: string, sellos: number, premios?: number, nombre?: string|null}} cliente
 * @param {{titulo, meta, premio}} prog
 * @returns {string|null}
 */
export function googleSaveUrl(cliente, prog) {
  if (isDemoGoogle() || !cliente?.serial) return null;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: process.env.GOOGLE_WALLET_SA_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [appUrl()],
    payload: { loyaltyObjects: [loyaltyObject(cliente, prog)] },
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  // Las private keys de Google traen los saltos de línea escapados en env.
  const privateKey = process.env.GOOGLE_WALLET_SA_KEY.replace(/\\n/g, "\n");
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey)
    .toString("base64url");

  return `https://pay.google.com/gp/v/save/${unsigned}.${signature}`;
}
