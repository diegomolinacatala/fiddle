import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// ============================================================================
// CONTRASEÑAS DE LAS TIENDAS (en la base, nunca en claro)
// ----------------------------------------------------------------------------
// Se guarda solo el hash scrypt con su sal: ni nosotros podemos leer una
// contraseña, solo generar otra. Por eso se enseñan UNA vez al crearlas.
//
// Las generamos nosotros, legibles y sin caracteres que se confundan al
// dictarlas en el mostrador (0/O, 1/I/L): "K7MP-X3QR-9HTB", 12 caracteres de
// 31 posibles, ~59 bits. Con 10 intentos por IP cada 15 minutos, sobra.
//
// Solo Node (route handlers): el middleware no toca contraseñas, solo sesiones.
// ============================================================================

const scrypt = promisify(scryptCb);
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LARGO_HASH = 32;
// N=2^15 (~50 ms por comprobación): caro para quien prueba millones, invisible en un login.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Contraseña nueva: "K7MP-X3QR-9HTB". */
export function generarClave() {
  const letra = () => ALFABETO[randomInt(ALFABETO.length)];
  return Array.from({ length: 3 }, () => Array.from({ length: 4 }, letra).join("")).join("-");
}

/** "scrypt$<sal hex>$<hash hex>": lo único que se guarda. */
export async function hashClave(clave) {
  const sal = randomBytes(16);
  const hash = await scrypt(String(clave), sal, LARGO_HASH, PARAMS);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * ¿Coincide la contraseña con el hash guardado? Nunca lanza. Mayúsculas y
 * guiones dan igual: "k7mp x3qr 9htb" vale, que se teclea en un móvil.
 */
export async function comprobarClave(clave, guardado) {
  try {
    const [tipo, salHex, hashHex] = String(guardado || "").split("$");
    if (tipo !== "scrypt" || !salHex || !hashHex) return false;
    const esperado = Buffer.from(hashHex, "hex");
    const hash = await scrypt(normalizarClave(clave), Buffer.from(salHex, "hex"), esperado.length, PARAMS);
    return timingSafeEqual(hash, esperado);
  } catch {
    return false;
  }
}

/** Las generadas se comparan sin mayúsculas, espacios ni guiones. */
function normalizarClave(clave) {
  const s = String(clave ?? "").trim();
  const limpia = s.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{12}$/.test(limpia) ? `${limpia.slice(0, 4)}-${limpia.slice(4, 8)}-${limpia.slice(8)}` : s;
}
