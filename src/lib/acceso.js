import { RESERVADOS } from "./negocios";

// ============================================================================
// REGLAS DE ACCESO POR RUTA (función pura, la usa el middleware)
// ----------------------------------------------------------------------------
// Devuelve qué exige una petición antes de llegar a la página / API:
//   { tipo: "publica" }                      -> pasa sin sesión
//   { tipo: "admin" }                        -> solo el admin de la plataforma
//   { tipo: "sesion" }                       -> cualquier sesión válida; el handler
//                                               comprueba el negocio (p.ej. el
//                                               negocio sale del cliente o del body)
//   { tipo: "negocio", slug, rol }           -> sesión de ESE negocio con ese rol
//
// Por defecto, cualquier /api desconocida exige sesión (falla cerrado).
// ============================================================================

// Públicas a propósito:
//   /  /login  /api/login  /api/logout     entrada
//   /home                                  la web de fiddle (precios y contacto)
//   /api/tap                               el cliente emite su pase (sin login)
//   /p/<serial>  /api/pase/<serial>        el cliente ve / descarga SU pase
//   /p/<serial>/listo                      lo abre en iPhone y dice «Todo listo»
//   /api/wallet/...                        web service de Apple Wallet (se
//                                          autentica con el token del pase)
//   /api/manifest  /api/negocios           manifest PWA y directorio
//   /api/tarjeta/<serial>                  la tarjeta web se pone al día sola
//   /p/<serial>/datos                      "Tu tarjeta y tus datos": promos, descargar
//   /api/tarjeta/<serial>/datos            y borrar. Sin login, pero con la llave del
//                                          pase o la cookie del tap (lib/gestion.js)
//   /api/push/<serial>                     el cliente activa los avisos en Android
//   /api/google/guardar/<serial>           "Añadir a Google Wallet"
//   /api/imagen/<tipo>                     iconos y banda: los descargan Google
//                                          Wallet y Android, sin sesión
//   /invitacion  /api/invitacion           el dueño de una tienda nueva elige sus
//                                          contraseñas (vale el token del enlace)
//   /api/cron/avisos                       el reloj de los avisos automáticos: no
//                                          hay sesión, lo protege CRON_SECRET en
//                                          su handler (sin él, no hace nada)
const PUBLICAS = [
  /^\/$/,
  /^\/home$/,
  /^\/login$/,
  /^\/privacidad$/,
  /^\/invitacion$/,
  /^\/api\/invitacion$/,
  /^\/api\/login$/,
  /^\/api\/logout$/,
  /^\/api\/tap$/,
  /^\/p\/[^/]+(\/listo)?$/,
  /^\/p\/[^/]+\/datos$/,
  /^\/api\/pase\/[^/]+$/,
  /^\/api\/wallet(\/.*)?$/,
  /^\/api\/manifest$/,
  /^\/api\/negocios$/,
  /^\/api\/salud$/,
  /^\/api\/tarjeta\/[^/]+$/,
  /^\/api\/tarjeta\/[^/]+\/datos$/,
  /^\/api\/push\/[^/]+$/,
  /^\/api\/google\/guardar\/[^/]+$/,
  /^\/api\/imagen\/[^/]+$/,
  /^\/api\/cron\/avisos$/,
];

// Qué primeros segmentos NO son un negocio: RESERVADOS vive en negocios.js para
// que no se separe de la validación de slugs al crear una tienda.

/**
 * @param {string} pathname
 * @param {URLSearchParams} params
 * @param {string} [method]
 * @returns {{tipo:"publica"} | {tipo:"sesion"} | {tipo:"negocio", slug:string|null, rol:"caja"|"manager"}}
 */
export function reglaDeRuta(pathname, params, method = "GET") {
  if (PUBLICAS.some((re) => re.test(pathname))) return { tipo: "publica" };

  // El admin de la plataforma: su página y su API.
  // /api/estado es el panel de integraciones de /admin: de toda la plataforma.
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/") || pathname === "/api/estado") {
    return { tipo: "admin" };
  }

  // Páginas de un negocio: /<slug> (landing pública), /<slug>/caja, /<slug>/manager,
  // /<slug>/crm, /<slug>/avisos, /<slug>/plantilla, /<slug>/ajustes. Todo lo que no es
  // la caja es del manager: ve a todos los clientes, les manda avisos y cambia las contraseñas.
  const pagina = pathname.match(/^\/([a-z0-9-]+)(?:\/(caja|manager|crm|avisos|plantilla|ajustes))?\/?$/);
  if (pagina && !RESERVADOS.has(pagina[1])) {
    if (!pagina[2]) return { tipo: "publica" };
    return { tipo: "negocio", slug: pagina[1], rol: pagina[2] === "caja" ? "caja" : "manager" };
  }

  const b = params.get("b");
  // El logo propio de una tienda: verlo es público (la tarjeta web, el icono de
  // la app); subir uno es del manager.
  if (pathname === "/api/logo") return method === "GET" ? { tipo: "publica" } : { tipo: "negocio", slug: b, rol: "manager" };
  // Igual las fotos de la banda y los iconos que sube la tienda: verlos, cualquiera
  // (la tarjeta web pinta su banda); su lista, subir y quitar, solo el manager.
  if (pathname === "/api/fondo") return method === "GET" ? { tipo: "publica" } : { tipo: "negocio", slug: b, rol: "manager" };
  if (pathname === "/api/propios") return { tipo: "negocio", slug: b, rol: "manager" };
  if (pathname === "/api/negocio") {
    return { tipo: "negocio", slug: b, rol: method === "GET" ? "caja" : "manager" };
  }
  if (pathname === "/api/clientes") return { tipo: "negocio", slug: b, rol: "caja" };
  if (pathname === "/api/crear") return { tipo: "negocio", slug: b, rol: "manager" };
  // El manager puede cambiar la contraseña de SU caja (un empleado que se va), la
  // suya propia (dando la actual) y cerrar todas las sesiones de su tienda.
  if (pathname === "/api/accesos/caja" || pathname === "/api/accesos/manager" || pathname === "/api/sesiones") {
    return { tipo: "negocio", slug: b, rol: "manager" };
  }
  // CRM y avisos automáticos: quién es quién y qué se le dice. Solo el manager.
  // Las dos que llevan ?b= se comprueban aquí; /api/crm/campana (el negocio va
  // en el cuerpo, como en /api/promo) y /api/crm/cliente/<serial> (sale del
  // propio cliente) caen abajo, en "sesión", y las valida su handler.
  if (pathname === "/api/crm" || pathname === "/api/automatizaciones") {
    return { tipo: "negocio", slug: b, rol: "manager" };
  }
  // La plantilla (lib/plantilla.js): la lista y sus cuentas son del manager;
  // «quién atiende desde este móvil» lo pide y lo deja la caja.
  if (pathname === "/api/plantilla") return { tipo: "negocio", slug: b, rol: "manager" };
  if (pathname === "/api/plantilla/quien") return { tipo: "negocio", slug: b, rol: "caja" };

  // /w/<serial>, /api/accion, /api/cliente/<serial>, /api/promo y cualquier
  // otra: sesión válida; el handler valida el negocio concreto.
  return { tipo: "sesion" };
}

/** `next` seguro para redirigir tras el login (evita open redirects). */
export function destinoSeguro(next) {
  if (typeof next !== "string" || !next.startsWith("/")) return null;
  // El navegador se salta tabuladores y saltos de línea, y lee "\" como "/":
  // "/\t/evil.com" acaba siendo "//evil.com", que es otro dominio.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  if (next.startsWith("//")) return null;
  return next;
}

/** Negocio al que apunta una ruta (/nube/caja -> "nube"), o null. */
export function negocioDeRuta(pathname) {
  const m = typeof pathname === "string" && pathname.match(/^\/([a-z0-9-]+)(?:\/|$)/);
  return m && !RESERVADOS.has(m[1]) ? m[1] : null;
}

// Los usuarios de tienda (`nube`, `nube-caja`) sin pasar por lib/auth.js: esto lo
// importa /login, que corre en el navegador, y auth.js lleva la lista de admins
// de la plataforma, que no tiene que salir en el JavaScript público. La forma es
// la misma que la de `resolverUsuario` (hay un test que lo fija); los admins no
// son de ninguna tienda y aquí no cuentan.
const USUARIO_TIENDA = /^([a-z0-9-]+?)(?:-(caja|manager))?$/;

/** @returns {{slug:string, rol:"caja"|"manager"}|null} la tienda y el rol de un usuario de acceso, o null */
export function tiendaDeUsuario(usuario) {
  const m = USUARIO_TIENDA.exec(String(usuario ?? "").trim().toLowerCase());
  if (!m || RESERVADOS.has(m[1])) return null;
  return { slug: m[1], rol: m[2] === "caja" ? "caja" : "manager" };
}

/** Usuario de acceso de una tienda y rol: `nube` (manager) · `nube-caja`. Igual que `usuarioDe` en lib/auth.js. */
export const usuarioDeTienda = (slug, rol) => (rol === "caja" ? `${slug}-caja` : slug);

/**
 * Qué usuario rellenar en /login. El middleware (y «Salir») mandan `b`, la
 * tienda, y `next`, a dónde iba. Quien iba a la caja (/<slug>/caja) o a una
 * ficha (/w/<serial>, donde cae la cámara al leer un QR) es la caja:
 * `<slug>-caja`. El resto (manager, crm, avisos, plantilla, ajustes), el dueño:
 * `<slug>`. Sin tienda, nada. Rellenar siempre el del dueño mandaba a la caja a
 * fallar con su propia contraseña hasta quedar bloqueada (docs/AUDITORIA-ACCESOS.md, A2).
 * @param {string|null} b
 * @param {string|null} next
 * @returns {string}
 */
export function usuarioSugerido(b, next) {
  const tienda = tiendaDeUsuario(b);
  if (!tienda) return "";
  if (tienda.rol === "caja") return usuarioDeTienda(tienda.slug, "caja"); // ya venía el de la caja
  const ruta = (destinoSeguro(next) || "").split(/[?#]/)[0].replace(/\/+$/, "");
  const deCaja = ruta === `/${tienda.slug}/caja` || ruta.startsWith("/w/");
  return usuarioDeTienda(tienda.slug, deCaja ? "caja" : "manager");
}

// ----------------------------------------------------------------------------
// LOS USUARIOS QUE RECUERDA ESTE MÓVIL
// /login guarda en el propio navegador (localStorage) con qué usuarios se entró,
// el último primero, para no teclearlos: el móvil fijo de la caja sale ya con el
// suyo. NUNCA la contraseña. Solo usuarios de tienda, con su tienda (`t`) tal como
// la dijo el servidor al entrar: un admin que entre en el móvil de la caja no se
// queda propuesto para el siguiente que lo coja.
// ----------------------------------------------------------------------------

export const CLAVE_RECORDADOS = "fiddle-usuarios";
export const MAX_RECORDADOS = 3;
// Con `typeof`: una RegExp convierte null en "null", que tiene forma de usuario.
const esUsuario = (x) => typeof x === "string" && /^[a-z0-9-]{1,60}$/.test(x);

/** Lo guardado, ya limpio: lo que no tenga forma de usuario se descarta. */
export function leerRecordados(texto) {
  let lista;
  try { lista = JSON.parse(texto || "[]"); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((r) => r && esUsuario(r.u) && esUsuario(r.t))
    .map((r) => ({ u: r.u, t: r.t }))
    .slice(0, MAX_RECORDADOS);
}

/**
 * La lista con este usuario delante, sin repetir y con tope. El usuario sale de la
 * tienda y el rol (`nube-caja`), no de lo tecleado: `Nube ` es `nube`.
 * @param {{u:string, t:string}[]} lista
 * @param {{negocio:string, rol:string}} entrada lo que devolvió /api/login
 */
export function recordarUsuario(lista, { negocio, rol }) {
  if ((rol !== "caja" && rol !== "manager") || !esUsuario(negocio)) return lista;
  const u = usuarioDeTienda(negocio, rol);
  return [{ u, t: negocio }, ...lista.filter((r) => r.u !== u)].slice(0, MAX_RECORDADOS);
}
