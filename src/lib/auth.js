// ============================================================================
// SESIÓN / AUTENTICACIÓN (caja + manager)
// ----------------------------------------------------------------------------
// Un token de sesión firmado con HMAC-SHA256. Formato: `rol.exp.firma`.
// Usa Web Crypto (globalThis.crypto.subtle), así que el MISMO módulo corre en:
//   - middleware (Edge runtime)  -> verifica en cada petición
//   - route handlers (Node)      -> /api/login firma el token
//
// Roles: "manager" (acceso total) y "worker" (solo caja). El PIN de cada rol
// sale de env; en modo demo hay valores por defecto para que arranque sin nada.
// ============================================================================

const enc = new TextEncoder();

const SECRET = process.env.AUTH_SECRET || "demo-secret-cambia-en-produccion";
const TTL_SECONDS = 60 * 60 * 12; // 12 h

export const COOKIE = "sesion";
export const TTL = TTL_SECONDS;

// PINs por rol (leídos en caliente para respetar cambios de env en tests).
export function pins() {
  return {
    manager: process.env.MANAGER_PIN || "4321",
    worker: process.env.WORKER_PIN || "1234",
  };
}

// Devuelve el rol al que corresponde un PIN, o null si no coincide con ninguno.
export function roleForPin(pin) {
  const { manager, worker } = pins();
  if (pin && pin === manager) return "manager";
  if (pin && pin === worker) return "worker";
  return null;
}

// ¿Un rol puede acceder a un recurso que exige `needed`?
// El manager hereda todo lo del worker.
export function canAccess(role, needed) {
  if (needed === "worker") return role === "worker" || role === "manager";
  return role === needed;
}

async function hmacHex(data) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo (casi) constante para no filtrar por timing.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function signSession(role) {
  const exp = Date.now() + TTL_SECONDS * 1000;
  const payload = `${role}.${exp}`;
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

// Verifica el token: firma válida + no caducado + rol conocido. Devuelve
// { role, exp } o null. Nunca lanza: cualquier fallo => null (denegar).
export async function verifySession(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [role, exp, sig] = parts;
    if (role !== "worker" && role !== "manager") return null;
    const expMs = Number(exp);
    if (!Number.isFinite(expMs) || expMs < Date.now()) return null;
    const expected = await hmacHex(`${role}.${exp}`);
    if (!safeEqual(sig, expected)) return null;
    return { role, exp: expMs };
  } catch {
    return null;
  }
}
