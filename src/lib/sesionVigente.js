import { verificarSesion, usuarioDe, TTL_SEGUNDOS } from "./auth";
import { getAcceso, getNegocio } from "./store";
import { filaDe } from "./accesos";

// ============================================================================
// ¿SIGUE VALIENDO ESTA SESIÓN?
// ----------------------------------------------------------------------------
// La firma (lib/auth.js) dice quién es y hasta cuándo, pero no sabe qué pasó
// después. Dos cosas la dejan sin valor antes de que caduque:
//
//   - Se cambió la contraseña: `accesos.actualizado` es posterior a cuando se
//     emitió la sesión. Es lo que promete la pantalla de Ajustes ("si se pierde
//     el móvil, cámbiala: la vieja deja de valer"); sin esto, la caja perdida
//     seguía dentro los 30 días que dura su cookie.
//   - La tienda ya no está: archivada o borrada. Si el slug se reutiliza, la
//     tienda nueva tiene contraseñas nuevas, así que tampoco se cuela.
//
// El middleware (Edge) solo mira la firma. Esto lo miran las API (exigirNegocio)
// y las páginas del personal, que son las que enseñan datos.
//
// Si la base no responde, vale la firma: una caja sin poder entrar es peor. Es la
// misma regla que el login (lib/accesos.js).
// El admin no tiene fila en `accesos` (entra con variables) ni tienda propia.
// ============================================================================

/** Cuándo se firmó: la sesión solo guarda la caducidad, y cada rol dura lo suyo. */
export const emitidaEn = (sesion) => sesion.exp - TTL_SEGUNDOS[sesion.rol] * 1000;

/**
 * @param {{negocio:string, rol:string, exp:number}|null} sesion ya verificada
 * @returns {Promise<object|null>} la misma sesión, o null si ya no vale
 */
export async function sesionVigente(sesion) {
  if (!sesion || sesion.rol === "admin") return sesion;
  let acceso;
  let negocio;
  try {
    [acceso, negocio] = await Promise.all([
      getAcceso(usuarioDe(sesion.negocio, sesion.rol)),
      getNegocio(sesion.negocio),
    ]);
  } catch (e) {
    console.error("[sesión] no se pudo comprobar en la base; vale la firma:", e);
    return sesion;
  }
  if (!negocio) return null;
  const desde = Date.parse(filaDe(acceso, sesion)?.actualizado ?? "");
  return Number.isFinite(desde) && emitidaEn(sesion) < desde ? null : sesion;
}

/** Para las páginas: el valor de la cookie `sesion`, verificado y vigente. */
export const sesionDeCookie = async (valor) => sesionVigente(await verificarSesion(valor));
