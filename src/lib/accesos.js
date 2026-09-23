import { resolverUsuario, verificarAcceso, usuariosDemo, usuarioDe, claveDe, igualSeguro } from "./auth";
import { getAcceso, guardarAcceso, accesosDeNegocio } from "./store";
import { generarClave, hashClave, comprobarClave } from "./claves";

// ============================================================================
// QUIÉN ENTRA (contraseñas de las tiendas)
// ----------------------------------------------------------------------------
// Orden de verdad para un usuario de tienda (`nube`, `nube-caja`):
//   1. Si tiene contraseña en la base (tabla `accesos`), SOLO vale esa: así
//      cambiarla deja sin efecto la anterior, también la de Vercel.
//   2. Si no, la variable de entorno de siempre (CLAVE_NUBE_CAJA): las tiendas
//      que ya funcionaban siguen igual hasta que se les genere una.
//   3. En modo pruebas (USUARIOS_DEMO), además, contraseña = usuario.
// Los admins de la plataforma (victor, diego) siguen solo con variables.
//
// Si la base no responde, se cae a la variable: quedarse sin caja por un fallo
// de Supabase sería peor que aceptar la contraseña de respaldo.
// ============================================================================

export const ROLES_TIENDA = ["manager", "caja"];

/** @returns {Promise<{negocio:string, rol:string, usuario:string}|null>} */
export async function comprobarAcceso(usuario, clave) {
  const quien = resolverUsuario(usuario);
  if (!quien || !clave) return null;
  if (quien.rol === "admin") return verificarAcceso(usuario, clave);

  let guardado = null;
  try {
    guardado = await getAcceso(usuarioDe(quien.negocio, quien.rol));
  } catch (e) {
    console.error("[accesos] no se pudo leer la contraseña de la base; se usa la de respaldo:", e);
  }
  if (!guardado?.hash) return verificarAcceso(usuario, clave);

  const ok = (await comprobarClave(clave, guardado.hash))
    || (usuariosDemo() && igualSeguro(String(clave), quien.usuario));
  return ok ? quien : null;
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
 * Cómo entra cada usuario de una tienda, sin enseñar contraseñas.
 * `desde`: fecha de la contraseña de la base (null si no tiene).
 * `respaldo`: si hay variable de entorno (solo cuenta cuando no hay `desde`).
 */
export async function estadoAccesos(slug) {
  const enBase = await accesosDeNegocio(slug);
  return ROLES_TIENDA.map((rol) => {
    const usuario = usuarioDe(slug, rol);
    return {
      rol,
      usuario,
      desde: enBase.find((a) => a.usuario === usuario)?.actualizado ?? null,
      respaldo: Boolean(claveDe(slug, rol)),
    };
  });
}
