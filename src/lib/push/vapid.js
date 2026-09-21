import { createECDH, hkdfSync } from "node:crypto";
import { secretoSesion } from "../auth";
import { appUrl } from "../url";

// ============================================================================
// AVISOS DEL NAVEGADOR (Android) — claves VAPID
// ----------------------------------------------------------------------------
// Cada aviso que mandamos a Chrome va firmado con un par de claves P-256 (VAPID)
// y el navegador solo acepta avisos firmados con la clave con la que se
// suscribió. Sin claves, no hay avisos.
//
// De dónde salen, por orden:
//   1. VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY, si están (lo limpio a largo plazo).
//   2. DERIVADAS de AUTH_SECRET con HKDF. Así funciona en cuanto se despliega,
//      sin tocar Vercel. Pega: si algún día se cambia AUTH_SECRET cambian las
//      claves y los teléfonos tienen que volver a activar los avisos (la tarjeta
//      se lo ofrece sola). Para evitarlo, fijar las dos variables de arriba.
// ============================================================================

// Orden del grupo de la curva P-256: la clave privada tiene que ser menor.
const ORDEN_P256 = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");

/**
 * Par VAPID determinista a partir de un secreto (mismo secreto = mismas claves).
 * @returns {{publica:string, privada:string}} base64url, 65 y 32 bytes
 */
export function derivarClaves(secreto) {
  // Una salida de HKDF fuera de rango es rarísima (2^-32), pero se reintenta.
  for (let intento = 0; intento < 8; intento++) {
    const privada = Buffer.from(hkdfSync("sha256", secreto, "sellos-avisos-web", `vapid-p256-${intento}`, 32));
    const n = BigInt(`0x${privada.toString("hex")}`);
    if (n === 0n || n >= ORDEN_P256) continue;
    const curva = createECDH("prime256v1");
    curva.setPrivateKey(privada);
    return { publica: curva.getPublicKey().toString("base64url"), privada: privada.toString("base64url") };
  }
  throw new Error("No se pudo derivar una clave VAPID válida");
}

let cache = { secreto: null, claves: null };

/**
 * Claves para firmar los avisos, o null si no hay de dónde sacarlas
 * (producción sin AUTH_SECRET ni VAPID_*).
 * @returns {{publica:string, privada:string, origen:"variables"|"derivadas"}|null}
 */
export function clavesPush() {
  const publica = process.env.VAPID_PUBLIC_KEY?.trim();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  if (publica && privada) return { publica, privada, origen: "variables" };

  const secreto = secretoSesion();
  if (!secreto) return null;
  if (cache.secreto !== secreto) cache = { secreto, claves: derivarClaves(secreto) };
  return { ...cache.claves, origen: "derivadas" };
}

export const hayPush = () => Boolean(clavesPush());

/**
 * Quién firma: una URL https o un mailto. Los servicios de push lo usan para
 * contactar si algo va mal. En local no hay https, así que va un mailto.
 */
export function sujetoPush() {
  const fijo = process.env.VAPID_SUBJECT?.trim();
  if (fijo) return fijo;
  const url = appUrl();
  return url.startsWith("https://") ? url : "mailto:avisos@example.com";
}
