import { verificarSesion, usuarioDe } from "./auth";
import { getAcceso, getNegocio, saveNegocio } from "./store";
import { filaDe } from "./accesos";

// ============================================================================
// ¿SIGUE VALIENDO ESTA SESIÓN?
// ----------------------------------------------------------------------------
// La firma (lib/auth.js) dice quién es, cuándo entró (`iat`) y hasta cuándo
// vale, pero no sabe qué pasó después. Tres cosas la dejan sin valor antes de
// que caduque, y las tres se miran contra `iat` (no contra la caducidad: la
// sesión del manager se renueva y la caducidad se mueve, la emisión no):
//
//   - Se cambió la contraseña: `accesos.actualizado` es posterior a cuando se
//     emitió la sesión. Es lo que promete la pantalla de Ajustes ("si se pierde
//     el móvil, cámbiala: la vieja deja de valer"); sin esto, la caja perdida
//     seguía dentro los 30 días que dura su cookie.
//   - Se cerraron todas las sesiones de la tienda (`negocio.sesionesDesde`,
//     Ajustes → «Cerrar todas las sesiones»): las emitidas antes de esa fecha no
//     valen, sin cambiar ninguna contraseña. Es la «versión de sesión» de la
//     tienda; cuando las sesiones vivan en el servidor (CLAUDE.md → Cuentas) será
//     borrarlas de ahí.
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

/**
 * @param {{negocio:string, rol:string, iat:number, exp:number}|null} sesion ya verificada
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
  const cortes = [filaDe(acceso, sesion)?.actualizado, negocio.sesionesDesde].map((iso) => Date.parse(iso ?? ""));
  return cortes.some((desde) => Number.isFinite(desde) && sesion.iat < desde) ? null : sesion;
}

/**
 * Cierra todas las sesiones de una tienda (manager y caja, en todos los
 * dispositivos) sin tocar contraseñas: las firmadas antes de ahora dejan de valer.
 * Quien lo pide vuelve a firmar la suya justo después (con `iat` de ahora).
 * @returns {Promise<string>} la fecha que quedó guardada
 */
export async function cerrarSesionesDe(slug, ahora = Date.now()) {
  const sesionesDesde = new Date(ahora).toISOString();
  // La config se guarda entera (leer, mezclar, escribir): si el reloj o el manager
  // escribían la suya a la vez, la fecha podía perderse sin que nadie lo viera. Se
  // comprueba lo guardado y, si no está, se vuelve a intentar; si tampoco, se lanza
  // (mejor un error en pantalla que un «cerradas» que no cerró nada).
  for (let intento = 0; intento < 2; intento++) {
    await saveNegocio(slug, { sesionesDesde });
    if ((await getNegocio(slug, { incluirArchivados: true }))?.sesionesDesde === sesionesDesde) return sesionesDesde;
  }
  throw new Error(`No se pudo guardar el cierre de sesiones de ${slug}`);
}

/** Para las páginas: el valor de la cookie `sesion`, verificado y vigente. */
export const sesionDeCookie = async (valor) => sesionVigente(await verificarSesion(valor));
