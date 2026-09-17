// ============================================================================
// SESIÓN / AUTENTICACIÓN (caja + manager, por negocio)
// ----------------------------------------------------------------------------
// Token firmado con HMAC-SHA256. Formato: `negocio.rol.exp.firma`.
// Usa Web Crypto (globalThis.crypto.subtle), así que el MISMO módulo corre en:
//   - middleware (Edge runtime)  -> verifica en cada petición
//   - route handlers (Node)      -> /api/login firma el token
//
// Roles: "manager" (todo su negocio) y "caja" (solo escanear y actuar). Una
// sesión SOLO vale para su negocio: la caja de Nube no entra en Fade.
//
// PINs por negocio y rol, desde env:  PIN_<SLUG>_CAJA  ·  PIN_<SLUG>_MANAGER
// Fuera de producción hay PINs de demo (1234 caja / 4321 manager) y un secreto de
// demo. EN PRODUCCIÓN no hay valores por defecto: sin AUTH_SECRET o sin PIN, no
// se puede entrar (falla cerrado).
// ============================================================================

const enc = new TextEncoder();

export const COOKIE = "sesion";
export const ROLES = ["caja", "manager"];
// La caja vive en un móvil de la tienda: sesión larga. El manager, corta.
export const TTL_SEGUNDOS = { caja: 60 * 60 * 24 * 30, manager: 60 * 60 * 12 };

const PINS_DEMO = { caja: "1234", manager: "4321" };
const SECRETO_DEMO = "demo-secret-cambia-en-produccion";

const esProduccion = () => process.env.NODE_ENV === "production";

/** Secreto HMAC, o null si falta en producción (=> nadie puede entrar). */
export function secretoSesion() {
  const secreto = process.env.AUTH_SECRET?.trim(); // tolera espacios/saltos al pegar en Vercel
  if (secreto) return secreto;
  return esProduccion() ? null : SECRETO_DEMO;
}

/** Nombre de la variable de entorno del PIN. `fade-room` -> PIN_FADE_ROOM_CAJA */
export const varPin = (slug, rol) =>
  `PIN_${String(slug).toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${rol.toUpperCase()}`;

/** PIN configurado para un negocio y rol, o null si no hay (en producción). */
export function pinDe(slug, rol) {
  const valor = process.env[varPin(slug, rol)]?.trim();
  if (valor) return valor;
  return esProduccion() ? null : PINS_DEMO[rol];
}

/**
 * Rol al que corresponde un PIN dentro de un negocio, o null.
 * @param {string} slug @param {string} pin @returns {"caja"|"manager"|null}
 */
export function rolParaPin(slug, pin) {
  if (!pin) return null;
  // Se comprueba manager primero: si alguien pone el mismo PIN a los dos, gana
  // el rol con más permisos (y así se ve el error de configuración).
  for (const rol of ["manager", "caja"]) {
    const esperado = pinDe(slug, rol);
    if (esperado && igualSeguro(String(pin), esperado)) return rol;
  }
  return null;
}

/**
 * ¿Una sesión puede acceder a un recurso del negocio `slug` que exige `rol`?
 * El manager hereda todo lo de la caja de SU negocio.
 */
export function puedeAcceder(sesion, slug, rol) {
  if (!sesion || sesion.negocio !== slug) return false;
  if (rol === "caja") return sesion.rol === "caja" || sesion.rol === "manager";
  return sesion.rol === rol;
}

async function hmacHex(secreto, data) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo (casi) constante para no filtrar por timing.
export function igualSeguro(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const SLUG_RE = /^[a-z0-9-]+$/;

/** Firma una sesión. Lanza si no hay secreto (producción sin AUTH_SECRET). */
export async function firmarSesion(slug, rol, ahora = Date.now()) {
  const secreto = secretoSesion();
  if (!secreto) throw new Error("Falta AUTH_SECRET en producción");
  if (!SLUG_RE.test(slug) || !ROLES.includes(rol)) throw new Error("Sesión inválida");
  const exp = ahora + TTL_SEGUNDOS[rol] * 1000;
  const payload = `${slug}.${rol}.${exp}`;
  return `${payload}.${await hmacHex(secreto, payload)}`;
}

/**
 * Verifica el token: firma válida + no caducado + rol conocido.
 * Devuelve { negocio, rol, exp } o null. Nunca lanza: cualquier fallo => null.
 */
export async function verificarSesion(token, ahora = Date.now()) {
  try {
    const secreto = secretoSesion();
    if (!token || !secreto) return null;
    const partes = token.split(".");
    if (partes.length !== 4) return null;
    const [negocio, rol, exp, firma] = partes;
    if (!SLUG_RE.test(negocio) || !ROLES.includes(rol)) return null;
    const expMs = Number(exp);
    if (!Number.isFinite(expMs) || expMs < ahora) return null;
    const esperada = await hmacHex(secreto, `${negocio}.${rol}.${exp}`);
    if (!igualSeguro(firma, esperada)) return null;
    return { negocio, rol, exp: expMs };
  } catch {
    return null;
  }
}

/** Lee y verifica la sesión de una Request (route handlers). */
export async function sesionDeRequest(request) {
  const cookie = request.cookies?.get?.(COOKIE)?.value;
  return verificarSesion(cookie);
}
