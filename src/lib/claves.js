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
// La excepción es la invitación: ahí el dueño elige las suyas.
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

// Dos clases de contraseña, y el hash dice cuál es (sin columna nueva):
//   "scrypt$<sal>$<hash>"          GENERADA por nosotros (o de antes de distinguirlas):
//                                  se compara sin mayúsculas, espacios ni guiones.
//   "scrypt-elegida$<sal>$<hash>"  ELEGIDA por el dueño: se compara tal cual (solo se
//                                  quitan los espacios de los lados). Antes una elegida
//                                  de 12 letras y cifras ("micafeteria1") se aplanaba
//                                  como si fuera generada y valía también en mayúsculas.
const GENERADA = "scrypt";
const ELEGIDA = "scrypt-elegida";
// Una elegida se compara tal cual, salvo los espacios de los lados y la forma Unicode:
// «café» escrito en un iPhone y en un PC pueden ser bytes distintos (NFC y NFD) para
// las mismas letras, y es la misma contraseña.
const PREPARAR = { [GENERADA]: normalizarClave, [ELEGIDA]: (clave) => String(clave ?? "").trim().normalize("NFC") };
const ETIQUETA = { generada: GENERADA, elegida: ELEGIDA };

/**
 * Lo único que se guarda. `tipo`: "generada" (de `generarClave`) o "elegida" (la
 * escribió una persona). Se prepara igual que al comprobar, y el hash es de eso.
 */
export async function hashClave(clave, tipo = "generada") {
  const etiqueta = ETIQUETA[tipo];
  if (!etiqueta) throw new Error(`Tipo de contraseña no válido: ${tipo}`);
  const sal = randomBytes(16);
  const hash = await scrypt(PREPARAR[etiqueta](clave), sal, LARGO_HASH, PARAMS);
  return `${etiqueta}$${sal.toString("hex")}$${hash.toString("hex")}`;
}

/** ¿Coincide la contraseña con el hash guardado? Nunca lanza. */
export async function comprobarClave(clave, guardado) {
  try {
    const [etiqueta, salHex, hashHex] = String(guardado || "").split("$");
    if (!PREPARAR[etiqueta] || !salHex || !hashHex) return false;
    const esperado = Buffer.from(hashHex, "hex");
    const hash = await scrypt(PREPARAR[etiqueta](clave), Buffer.from(salHex, "hex"), esperado.length, PARAMS);
    return timingSafeEqual(hash, esperado);
  } catch {
    return false;
  }
}

/** ¿Este hash es de una contraseña que eligió una persona? */
export const esElegida = (guardado) => String(guardado || "").startsWith(`${ELEGIDA}$`);

/**
 * Una que elige el dueño (invitación, lib/invitaciones.js). Larga antes que
 * rara: diez caracteres ya no se adivinan con 10 intentos cada 15 minutos.
 * @returns {string|null} el problema, o null si vale
 */
export function problemaClaveElegida(clave, usuario) {
  const s = String(clave ?? "");
  if (s.trim().length < MIN_ELEGIDA) return `Tiene que tener al menos ${MIN_ELEGIDA} caracteres`;
  if (s.length > 200) return "Demasiado larga";
  if (s.trim().toLowerCase() === String(usuario).toLowerCase()) return "No puede ser igual que el usuario";
  if (/^(.)\1+$/.test(s.trim())) return "No puede ser el mismo carácter repetido";
  return null;
}
export const MIN_ELEGIDA = 10;

/** Las generadas se comparan sin mayúsculas, espacios ni guiones: "k7mp x3qr 9htb" vale, que se teclea en un móvil. */
function normalizarClave(clave) {
  const s = String(clave ?? "").trim();
  const limpia = s.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{12}$/.test(limpia) ? `${limpia.slice(0, 4)}-${limpia.slice(4, 8)}-${limpia.slice(8)}` : s;
}
