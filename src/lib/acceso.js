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
//   /api/tap                               el cliente emite su pase (sin login)
//   /p/<serial>  /api/pase/<serial>        el cliente ve / descarga SU pase
//   /api/wallet/...                        web service de Apple Wallet (se
//                                          autentica con el token del pase)
//   /api/manifest  /api/negocios           manifest PWA y directorio
const PUBLICAS = [
  /^\/$/,
  /^\/login$/,
  /^\/api\/login$/,
  /^\/api\/logout$/,
  /^\/api\/tap$/,
  /^\/p\/[^/]+$/,
  /^\/api\/pase\/[^/]+$/,
  /^\/api\/wallet(\/.*)?$/,
  /^\/api\/manifest$/,
  /^\/api\/negocios$/,
  /^\/api\/salud$/,
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
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) {
    return { tipo: "admin" };
  }

  // Páginas de un negocio: /<slug> (landing pública), /<slug>/caja, /<slug>/manager
  const pagina = pathname.match(/^\/([a-z0-9-]+)(?:\/(caja|manager))?\/?$/);
  if (pagina && !RESERVADOS.has(pagina[1])) {
    if (!pagina[2]) return { tipo: "publica" };
    return { tipo: "negocio", slug: pagina[1], rol: pagina[2] };
  }

  const b = params.get("b");
  if (pathname === "/api/negocio") {
    return { tipo: "negocio", slug: b, rol: method === "GET" ? "caja" : "manager" };
  }
  if (pathname === "/api/clientes") return { tipo: "negocio", slug: b, rol: "caja" };
  if (pathname === "/api/crear") return { tipo: "negocio", slug: b, rol: "manager" };

  // /w/<serial>, /api/accion, /api/cliente/<serial>, /api/promo, /api/estado y
  // cualquier otra: sesión válida; el handler valida el negocio concreto.
  return { tipo: "sesion" };
}

/** `next` seguro para redirigir tras el login (evita open redirects). */
export function destinoSeguro(next) {
  if (typeof next !== "string" || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Negocio al que apunta una ruta (/nube/caja -> "nube"), o null. */
export function negocioDeRuta(pathname) {
  const m = typeof pathname === "string" && pathname.match(/^\/([a-z0-9-]+)(?:\/|$)/);
  return m && !RESERVADOS.has(m[1]) ? m[1] : null;
}
