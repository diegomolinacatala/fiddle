import { resolverUsuario, verificarAcceso, usuariosDemo, usuarioDe, claveDe, igualSeguro, ADMINS, PLATAFORMA } from "./auth";
import { getAcceso, getAccesoPorLogin, guardarAcceso, accesosDeNegocio, getNegocio } from "./store";
import { USUARIO_CAJA, problemaUsuarioCaja } from "./usuarioCaja";
import { leerEmail } from "./interesados";
import { generarClave, hashClave, comprobarClave, problemaClaveElegida, esElegida } from "./claves";

// ============================================================================
// QUIÉN ENTRA (contraseñas de las tiendas)
// ----------------------------------------------------------------------------
// Orden de verdad para un usuario de tienda (`nube`, `nube-caja`):
//   1. Si tiene contraseña en la base (tabla `accesos`), SOLO vale esa: así
//      cambiarla deja sin efecto la anterior, también la de Vercel.
//   2. Si no, la variable de entorno de siempre (CLAVE_NUBE_CAJA): las tiendas
//      que ya funcionaban siguen igual hasta que se les genere una.
//   3. En local (modo pruebas), además, contraseña = usuario. Nunca en producción.
// Los admins de la plataforma (victor, diego) siguen solo con variables.
//
// Si la base no responde, se cae a la variable: quedarse sin caja por un fallo
// de Supabase sería peor que aceptar la contraseña de respaldo.
//
// CON QUÉ SE ENTRA (desde el 24-11-2026, columna `accesos.login`): el dueño, con su
// correo verificado (lib/codigos.js); la caja, con el usuario que eligió. Los dos
// los pone la invitación (lib/invitaciones.js). Mientras una fila no tenga `login`
// se entra con el usuario de siempre (`nube`, `nube-caja`): así La Delicantería
// sigue entrando igual hasta que haga el cambio. Con `login`, SOLO con él: el
// nombre viejo deja de abrir esa puerta.
//
// La sesión no cambia: sigue llevando el usuario de siempre (`nube`), que es el
// que mira lib/sesionVigente.js. El login es solo con qué nombre se busca la fila.
// ============================================================================

export const ROLES_TIENDA = ["manager", "caja"];

/**
 * La fila de `accesos` si es de verdad de ese negocio y rol; si no, null. Una
 * tienda `pan-caja` de antes de `slugDeTiendaLibre` pudo pisar la caja de `pan`:
 * esa fila no abre la puerta de `pan` ni le cierra la sesión a su caja.
 */
export const filaDe = (fila, { negocio, rol }) => (fila?.negocio === negocio && fila?.rol === rol ? fila : null);

/** Un nombre de acceso tal como se busca: sin espacios a los lados y en minúsculas. */
export const normalizarLogin = (texto) => String(texto ?? "").trim().toLowerCase();

async function leerFila(lectura, que) {
  try {
    return await lectura();
  } catch (e) {
    console.error(`[accesos] no se pudo leer ${que} de la base:`, e);
    return null;
  }
}

/**
 * A qué tienda y rol lleva lo que se escribe en «Correo o usuario». No mira la
 * contraseña. Primero un `login` (correo o usuario elegido); si no hay, el usuario
 * de siempre, que solo vale si esa fila aún no tiene `login`.
 * @returns {Promise<{negocio:string, rol:"caja"|"manager"|"admin", usuario:string}|null>}
 */
export async function buscarAcceso(texto) {
  const login = normalizarLogin(texto);
  if (!login) return null;
  if (ADMINS.includes(login)) return { negocio: PLATAFORMA, rol: "admin", usuario: login };
  const fila = await leerFila(() => getAccesoPorLogin(login), "el login");
  if (fila && ROLES_TIENDA.includes(fila.rol)) {
    return { negocio: fila.negocio, rol: fila.rol, usuario: usuarioDe(fila.negocio, fila.rol) };
  }
  if (login.includes("@")) return null;
  const quien = resolverUsuario(login);
  if (!quien || quien.rol === "admin") return null;
  const suya = filaDe(await leerFila(() => getAcceso(usuarioDe(quien.negocio, quien.rol)), "el acceso"), quien);
  if (suya?.login) return null; // ya entra con su correo o su usuario nuevo
  return { negocio: quien.negocio, rol: quien.rol, usuario: usuarioDe(quien.negocio, quien.rol) };
}

/**
 * ¿Es esa la contraseña de ese rol de esa tienda? La de la base si hay fila; si
 * no, la variable de Vercel. Para comprobar dentro (cambiar la propia, «no puede
 * ser la de la caja»), sin pasar por el nombre con que se entra.
 */
export async function claveValida(slug, rol, clave) {
  if (!ROLES_TIENDA.includes(rol) || !clave) return false;
  const usuario = usuarioDe(slug, rol);
  // La de otra tienda u otro rol cuenta como sin fila: vale la variable, como antes.
  const guardado = filaDe(await leerFila(() => getAcceso(usuario), "la contraseña"), { negocio: slug, rol });
  if (!guardado?.hash) return Boolean(verificarAcceso(usuario, clave));
  return (await comprobarClave(clave, guardado.hash)) || (usuariosDemo() && igualSeguro(String(clave), usuario));
}

/**
 * Lo que escribe quien entra. `quien`: lo que ya devolvió `buscarAcceso`, para no
 * buscarlo dos veces.
 * @returns {Promise<{negocio:string, rol:string, usuario:string}|null>}
 */
export async function comprobarAcceso(texto, clave, quien = undefined) {
  const acceso = quien === undefined ? await buscarAcceso(texto) : quien;
  if (!acceso || !clave) return null;
  if (acceso.rol === "admin") return verificarAcceso(acceso.usuario, clave);
  // En local, «contraseña = lo que se escribe» también con un alias (`nube-manager`).
  if (usuariosDemo() && igualSeguro(String(clave), normalizarLogin(texto))) return acceso;
  return (await claveValida(acceso.negocio, acceso.rol, clave)) ? acceso : null;
}

// ---------------------------------------------------------------------------
// Los nombres nuevos. El usuario de la caja es único en toda la plataforma (como
// en cualquier web): no puede ser de otra fila, ni un admin, ni el usuario de
// siempre de OTRA tienda (`pan`, `pan-caja`: ese nombre acabaría en esta caja).
// El de siempre de su propia caja sí vale: quien quiera, se queda con `nube-caja`.
// ---------------------------------------------------------------------------

export { USUARIO_CAJA, problemaUsuarioCaja };

/**
 * ¿Puede la caja de `slug` llamarse así? null si sí; si no, por qué.
 * @returns {Promise<string|null>}
 */
export async function usuarioCajaOcupado(texto, slug) {
  const u = normalizarLogin(texto);
  const forma = problemaUsuarioCaja(u);
  if (forma) return forma;
  const ocupado = "Ese usuario ya existe. Prueba con otro, por ejemplo con el nombre de tu cafetería.";
  if (ADMINS.includes(u)) return ocupado;
  const fila = await getAccesoPorLogin(u);
  if (fila && !(fila.negocio === slug && fila.rol === "caja")) return ocupado;
  const viejo = resolverUsuario(u);
  if (viejo && !(viejo.negocio === slug && viejo.rol === "caja") && (await getNegocio(viejo.negocio, { incluirArchivados: true }))) return ocupado;
  return null;
}

/**
 * ¿Puede el dueño de `slug` entrar con este correo? Uno por tienda: el mismo correo
 * en dos no sabría a cuál entrar (con las cuentas de persona, CLAUDE.md → Cuentas,
 * una persona tendrá varias).
 * @returns {Promise<{email:string, problema:null} | {email:null, problema:string}>}
 */
export async function correoLibre(texto, slug) {
  const email = leerEmail(texto)?.toLowerCase();
  if (!email) return { email: null, problema: "Revisa el correo" };
  const fila = await getAccesoPorLogin(email);
  if (fila && !(fila.negocio === slug && fila.rol === "manager")) {
    return { email: null, problema: "Ese correo ya entra en otra cafetería. Usa otro." };
  }
  return { email, problema: null };
}

/**
 * ¿Choca un slug nuevo con alguien que ya entra con ese nombre? Al crear una tienda
 * (admin o /alta): sus usuarios de siempre (`pan`, `pan-caja`) no pueden ser el
 * usuario que eligió la caja de otra.
 */
export async function slugChocaConLogin(slug) {
  // `pan-manager` también lleva al dueño de `pan` (resolverUsuario).
  const nombres = [...ROLES_TIENDA.map((rol) => usuarioDe(slug, rol)), `${slug}-manager`];
  const filas = await Promise.all(nombres.map((n) => getAccesoPorLogin(n)));
  return filas.some(Boolean);
}

/**
 * Genera y guarda una contraseña nueva. La devuelve en claro UNA vez: después
 * solo queda el hash. La anterior deja de valer en el acto.
 * @returns {Promise<{rol:string, usuario:string, clave:string}>}
 */
export async function nuevaClave(slug, rol) {
  if (!ROLES_TIENDA.includes(rol)) throw new Error(`Rol no válido: ${rol}`);
  const usuario = usuarioDe(slug, rol);
  const clave = generarClave();
  await guardarAcceso({ usuario, negocio: slug, rol, hash: await hashClave(clave) });
  return { rol, usuario, clave };
}

/**
 * El dueño cambia SU contraseña (Ajustes → «Tu acceso»): tiene que saber la actual,
 * y la nueva es una elegida (lib/claves.js) distinta de la actual y de la de la
 * caja, que la sabe todo el personal. Guardarla saca a sus otras sesiones
 * (lib/sesionVigente.js); la de quien lo pide se vuelve a firmar en la respuesta.
 * @returns {Promise<{ok:true, usuario:string} | {ok:false, motivo:string, campo:"actual"|"nueva"}>}
 */
export async function cambiarClavePropia(slug, rol, { actual, nueva }) {
  if (!ROLES_TIENDA.includes(rol)) throw new Error(`Rol no válido: ${rol}`);
  const usuario = usuarioDe(slug, rol);
  if (!(await claveValida(slug, rol, actual))) return { ok: false, motivo: "La contraseña actual no es correcta", campo: "actual" };
  const problema = problemaClaveElegida(nueva, usuario);
  if (problema) return { ok: false, motivo: problema, campo: "nueva" };
  if (String(nueva).trim() === String(actual).trim()) return { ok: false, motivo: "La nueva tiene que ser distinta de la actual", campo: "nueva" };
  if (rol === "manager" && (await claveValida(slug, "caja", nueva))) {
    return { ok: false, motivo: "No puede ser la misma que la de la caja: la sabe quien la use", campo: "nueva" };
  }
  await guardarAcceso({ usuario, negocio: slug, rol, hash: await hashClave(nueva, "elegida") });
  return { ok: true, usuario };
}

/**
 * Cómo entra cada usuario de una tienda, sin enseñar contraseñas.
 * `desde`: fecha de la contraseña de la base (null si no tiene).
 * `elegida`: la escribió una persona (invitación o Ajustes), no se la generamos.
 * `respaldo`: si hay variable de entorno (solo cuenta cuando no hay `desde`).
 */
export async function estadoAccesos(slug) {
  const enBase = await accesosDeNegocio(slug);
  return ROLES_TIENDA.map((rol) => {
    const usuario = usuarioDe(slug, rol);
    const fila = enBase.find((a) => a.usuario === usuario);
    return {
      rol,
      usuario,
      desde: fila?.actualizado ?? null,
      elegida: Boolean(fila) && esElegida(fila.hash),
      respaldo: Boolean(claveDe(slug, rol)),
      login: fila?.login ?? null,
    };
  });
}
