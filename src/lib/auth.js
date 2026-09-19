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
// ENTRADA: usuario + contraseña en un único login.
//   usuario `nube`        -> manager de nube (incluye lo de la caja)
//   usuario `nube-caja`   -> solo caja de nube
// La contraseña sale de env: CLAVE_<SLUG>_<ROL> (o PIN_<SLUG>_<ROL>, el mismo
// valor con el nombre antiguo).
//
// MODO PRUEBAS: fuera de producción, o con USUARIOS_DEMO=1, la contraseña puede
// ser igual que el usuario (nube/nube) y el login los muestra en pantalla.
// EN PRODUCCIÓN sin USUARIOS_DEMO no hay valores por defecto: sin AUTH_SECRET o
// sin contraseña configurada, no se puede entrar (falla cerrado).
// ============================================================================

const enc = new TextEncoder();

export const COOKIE = "sesion";
export const ROLES = ["caja", "manager", "admin"];
// La caja vive en un móvil de la tienda: sesión larga. El manager y el admin, cortas.
export const TTL_SEGUNDOS = { caja: 60 * 60 * 24 * 30, manager: 60 * 60 * 12, admin: 60 * 60 * 12 };

// ADMIN DE LA PLATAFORMA: no es de ningún negocio, es de todos. Entra en /admin,
// donde se crean, editan y archivan las tiendas. Su sesión lleva este negocio
// de mentira en el hueco del slug (por eso "plataforma" es un slug reservado).
export const ADMINS = ["victor", "diego"];
export const PLATAFORMA = "plataforma";

const SECRETO_DEMO = "demo-secret-cambia-en-produccion";

const esProduccion = () => process.env.NODE_ENV === "production";

/** ¿Están activos los accesos de prueba (usuario = contraseña, visibles en el login)? */
export const usuariosDemo = () => process.env.USUARIOS_DEMO === "1" || !esProduccion();

/** Secreto HMAC, o null si falta en producción (=> nadie puede entrar). */
export function secretoSesion() {
  const secreto = process.env.AUTH_SECRET?.trim(); // tolera espacios/saltos al pegar en Vercel
  if (secreto) return secreto;
  return esProduccion() ? null : SECRETO_DEMO;
}

/**
 * Variable de entorno de la contraseña.
 *   negocio:  `fade` + caja  -> CLAVE_FADE_CAJA
 *   admin:    `victor`       -> CLAVE_ADMIN_VICTOR
 */
export const varClave = (nombre, rol) => {
  const limpio = String(nombre).toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return rol === "admin" ? `CLAVE_ADMIN_${limpio}` : `CLAVE_${limpio}_${rol.toUpperCase()}`;
};
/** Nombre antiguo, que sigue valiendo: PIN_FADE_CAJA */
export const varPin = (slug, rol) => varClave(slug, rol).replace(/^CLAVE_/, "PIN_");

/** Contraseña configurada, o null si no hay ninguna. */
export function claveDe(nombre, rol) {
  return process.env[varClave(nombre, rol)]?.trim() || process.env[varPin(nombre, rol)]?.trim() || null;
}

/** Usuario de acceso de un negocio y rol: `nube` (manager) · `nube-caja`. */
export const usuarioDe = (slug, rol) => (rol === "manager" ? slug : `${slug}-caja`);

/**
 * A qué negocio y rol corresponde un usuario. No comprueba la contraseña.
 * @returns {{negocio:string, rol:"caja"|"manager"|"admin", usuario:string}|null}
 */
export function resolverUsuario(usuario) {
  const limpio = String(usuario ?? "").trim().toLowerCase();
  if (ADMINS.includes(limpio)) return { negocio: PLATAFORMA, rol: "admin", usuario: limpio };
  const m = /^([a-z0-9-]+?)(?:-(caja|manager))?$/.exec(limpio);
  if (!m) return null;
  return { negocio: m[1], rol: m[2] === "caja" ? "caja" : "manager", usuario: limpio };
}

/**
 * Comprueba usuario + contraseña. Devuelve a quién corresponde, o null.
 * @returns {{negocio:string, rol:"caja"|"manager"}|null}
 */
export function verificarAcceso(usuario, clave) {
  const quien = resolverUsuario(usuario);
  if (!quien || !clave) return null;

  const valida = [claveDe(quien.rol === "admin" ? quien.usuario : quien.negocio, quien.rol)];
  // En pruebas vale además "contraseña = usuario" (nube/nube, victor/victor).
  if (usuariosDemo()) valida.push(quien.usuario);

  return valida.some((esperada) => esperada && igualSeguro(String(clave), esperada)) ? quien : null;
}

/**
 * ¿Una sesión puede acceder a un recurso del negocio `slug` que exige `rol`?
 * El manager hereda todo lo de la caja de SU negocio.
 */
export function puedeAcceder(sesion, slug, rol) {
  if (!sesion) return false;
  if (sesion.rol === "admin") return true; // el admin de la plataforma entra en todos
  if (sesion.negocio !== slug) return false;
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
