// ============================================================================
// SESIÓN / AUTENTICACIÓN (caja + manager, por negocio)
// ----------------------------------------------------------------------------
// Token firmado con HMAC-SHA256. Formato: `negocio.rol.usuario.iat.exp.firma`:
// quién es (el usuario con el que entró: `nube-caja`, `victor`), cuándo se firmó
// (`iat`) y hasta cuándo vale (`exp`). El `iat` es lo que compara
// lib/sesionVigente.js con un cambio de contraseña o un «cerrar todas las
// sesiones»: por eso al RENOVAR una sesión (renovarSesion) se alarga `exp` y se
// conserva `iat`, y la sesión sigue cayendo si la contraseña cambió después de
// entrar. Usa Web Crypto (globalThis.crypto.subtle), así que el MISMO módulo corre en:
//   - middleware (Edge runtime)  -> verifica en cada petición y renueva
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
// MODO PRUEBAS: SOLO fuera de producción (en local) y sin AUTH_SECRET propio, la
// contraseña puede ser igual que el usuario (nube/nube) y el login los muestra.
// EN PRODUCCIÓN no hay valores por defecto ni interruptor que los encienda: sin
// AUTH_SECRET o sin contraseña configurada, no se puede entrar (falla cerrado).
// ============================================================================

const enc = new TextEncoder();

export const COOKIE = "sesion";
export const ROLES = ["caja", "manager", "admin"];
// La caja vive en un móvil de la tienda: sesión larga. La del manager también, y se
// RENUEVA sola mientras la use (DESLIZANTES): con 12 h sin renovar, el dueño tecleaba
// cada mañana una contraseña generada que no podía cambiar, y así se pierden. La del
// admin sigue corta: entra con una variable de Vercel y no tiene otro corte.
export const TTL_SEGUNDOS = { caja: 60 * 60 * 24 * 30, manager: 60 * 60 * 24 * 30, admin: 60 * 60 * 12 };
// Qué sesiones se vuelven a firmar al usarlas cuando les queda menos de la mitad, y
// cuánto puede vivir una desde que se entró aunque se use a diario: pasado eso, al
// login otra vez (una cookie robada que se usara cada día no viviría para siempre).
const DESLIZANTES = ["manager"];
export const MAX_SESION_MS = 90 * 24 * 60 * 60 * 1000;

// ADMIN DE LA PLATAFORMA: no es de ningún negocio, es de todos. Entra en /admin,
// donde se crean, editan y archivan las tiendas. Su sesión lleva este negocio
// de mentira en el hueco del slug (por eso "plataforma" es un slug reservado).
export const ADMINS = ["victor", "diego"];
export const PLATAFORMA = "plataforma";

const SECRETO_DEMO = "demo-secret-cambia-en-produccion";

const esProduccion = () => process.env.NODE_ENV === "production";

/**
 * ¿Están activos los accesos de prueba (usuario = contraseña, visibles en el login)?
 * Solo en local. Antes los encendía USUARIOS_DEMO=1 también en producción; con
 * clientes de verdad eso dejaba entrar como admin con victor/victor, así que la
 * variable ya no se lee: si se queda olvidada en Vercel, no abre nada.
 *
 * Y solo con el secreto de demo: si en local hay un AUTH_SECRET de verdad (el de
 * Vercel pegado en .env.local), victor/victor firmaría sesiones que valen en
 * producción, porque el token no dice dónde se firmó.
 */
export const usuariosDemo = () => !esProduccion() && !process.env.AUTH_SECRET?.trim();

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
 * ¿Puede llamarse así una tienda NUEVA? Sus dos usuarios tienen que llevar de
 * vuelta a ella al entrar. `pan-caja` no: su manager sería la caja de `pan`, y
 * su contraseña pisaría la de esa caja. Tampoco `pan-manager`, `victor` o `diego`.
 */
export function slugDeTiendaLibre(slug) {
  const manager = resolverUsuario(usuarioDe(slug, "manager"));
  const caja = resolverUsuario(usuarioDe(slug, "caja"));
  return manager?.negocio === slug && manager.rol === "manager" && caja?.negocio === slug && caja.rol === "caja";
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

// El admin de antes de llevar el nombre en el token, y las sesiones de admin que firma
// un test sin decir cuál: la auditoría las apunta como "admin" a secas.
const ADMIN_SIN_NOMBRE = "admin";
const usuarioValido = (slug, rol, usuario) =>
  rol === "admin" ? ADMINS.includes(usuario) || usuario === ADMIN_SIN_NOMBRE : usuario === usuarioDe(slug, rol);

/**
 * Firma una sesión. Lanza si no hay secreto (producción sin AUTH_SECRET).
 * `usuario`: con quién entró (el admin, `victor` o `diego`; una tienda, el suyo, que
 * sale solo del slug y el rol). `iat`: solo al renovar, para conservar la original.
 */
export async function firmarSesion(slug, rol, ahora = Date.now(), { usuario, iat = ahora } = {}) {
  const secreto = secretoSesion();
  if (!secreto) throw new Error("Falta AUTH_SECRET en producción");
  if (!SLUG_RE.test(slug) || !ROLES.includes(rol)) throw new Error("Sesión inválida");
  const quien = usuario ?? (rol === "admin" ? ADMIN_SIN_NOMBRE : usuarioDe(slug, rol));
  if (!usuarioValido(slug, rol, quien) || !Number.isFinite(iat) || iat > ahora) throw new Error("Sesión inválida");
  const exp = ahora + TTL_SEGUNDOS[rol] * 1000;
  const payload = `${slug}.${rol}.${quien}.${iat}.${exp}`;
  return `${payload}.${await hmacHex(secreto, payload)}`;
}

/**
 * Verifica el token: firma válida + no caducado + rol conocido.
 * Devuelve { negocio, rol, usuario, iat, exp } o null. Nunca lanza: cualquier fallo => null.
 */
export async function verificarSesion(token, ahora = Date.now()) {
  try {
    const secreto = secretoSesion();
    if (!token || !secreto) return null;
    const partes = token.split(".");
    const sesion = partes.length === 6 ? deSeisPartes(partes) : partes.length === 4 && ahora < FIN_FORMATO_VIEJO ? deCuatroPartes(partes) : null;
    if (!sesion) return null;
    const { negocio, rol, usuario, iat, exp, firma, payload } = sesion;
    if (!SLUG_RE.test(negocio) || !ROLES.includes(rol) || !usuarioValido(negocio, rol, usuario)) return null;
    if (!Number.isFinite(iat) || !Number.isFinite(exp) || iat > exp || exp < ahora) return null;
    if (!igualSeguro(firma, await hmacHex(secreto, payload))) return null;
    return { negocio, rol, usuario, iat, exp };
  } catch {
    return null;
  }
}

const deSeisPartes = ([negocio, rol, usuario, iat, exp, firma]) =>
  ({ negocio, rol, usuario, iat: Number(iat), exp: Number(exp), firma, payload: `${negocio}.${rol}.${usuario}.${iat}.${exp}` });

// El formato de antes del 15-10-2026 (`negocio.rol.exp.firma`), para no echar a la
// caja que estaba dentro al desplegar. Sin `iat`, se deduce de la caducidad con la
// duración de hoy: para la caja (30 días entonces y ahora) es exacto; un manager de
// entonces (12 h) sale más viejo de lo que era, y a lo sumo vuelve a entrar. Deja de
// aceptarse solo el 15-11-2026, cuando todas esas sesiones han caducado ya; después
// de esa fecha, borrar `deCuatroPartes`.
const FIN_FORMATO_VIEJO = Date.UTC(2026, 10, 15);
const deCuatroPartes = ([negocio, rol, exp, firma]) =>
  ROLES.includes(rol) && {
    negocio, rol, firma,
    usuario: rol === "admin" ? ADMIN_SIN_NOMBRE : usuarioDe(negocio, rol),
    iat: Number(exp) - TTL_SEGUNDOS[rol] * 1000,
    exp: Number(exp),
    payload: `${negocio}.${rol}.${exp}`,
  };

/**
 * La sesión renovada (un token nuevo con la MISMA fecha de emisión y la caducidad
 * entera por delante) si es de las que se deslizan y le queda menos de la mitad;
 * si no, null. Lo llama el middleware en cada petición: así el dueño no vuelve al
 * login mientras use la app, y un cambio de contraseña posterior a `iat` la sigue
 * echando (lib/sesionVigente.js).
 */
export async function renovarSesion(sesion, ahora = Date.now()) {
  if (!sesion || !DESLIZANTES.includes(sesion.rol)) return null;
  if (sesion.exp - ahora >= (TTL_SEGUNDOS[sesion.rol] * 1000) / 2) return null;
  if (ahora - sesion.iat >= MAX_SESION_MS) return null; // ya ha vivido bastante: caduca y vuelve a entrar
  return firmarSesion(sesion.negocio, sesion.rol, ahora, { usuario: sesion.usuario, iat: sesion.iat });
}

/** Las opciones de la cookie de sesión, las mismas donde quiera que se ponga. */
export const cookieSesion = (rol) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: esProduccion(),
  path: "/",
  maxAge: TTL_SEGUNDOS[rol],
});

/**
 * Firma un texto cualquiera con el mismo secreto que las sesiones:
 * `<texto>.<exp>.<firma>`. Para cookies que no son la sesión pero tampoco
 * pueden forjarse (quién atiende la caja, lib/quien.js). El texto puede llevar
 * puntos: la caducidad y la firma van al final y se leen desde la derecha.
 * Lanza sin secreto en producción, como firmarSesion.
 */
export async function firmarTexto(texto, exp) {
  const secreto = secretoSesion();
  if (!secreto) throw new Error("Falta AUTH_SECRET en producción");
  if (typeof texto !== "string" || !texto || !Number.isFinite(exp)) throw new Error("Texto inválido");
  const payload = `${texto}.${exp}`;
  return `${payload}.${await hmacHex(secreto, payload)}`;
}

/** El texto de un token de `firmarTexto` si la firma vale y no ha caducado; si no, null. Nunca lanza. */
export async function verificarTexto(token, ahora = Date.now()) {
  try {
    const secreto = secretoSesion();
    if (!token || !secreto) return null;
    const i = token.lastIndexOf(".");
    const payload = token.slice(0, i);
    const firma = token.slice(i + 1);
    const j = payload.lastIndexOf(".");
    if (i <= 0 || j <= 0) return null;
    const expMs = Number(payload.slice(j + 1));
    if (!Number.isFinite(expMs) || expMs < ahora) return null;
    const esperada = await hmacHex(secreto, payload);
    return igualSeguro(firma, esperada) ? payload.slice(0, j) : null;
  } catch {
    return null;
  }
}

/** Lee y verifica la sesión de una Request (route handlers). */
export async function sesionDeRequest(request) {
  const cookie = request.cookies?.get?.(COOKIE)?.value;
  return verificarSesion(cookie);
}
