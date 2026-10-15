import { addAuditoria } from "./store";
import { usuarioDe } from "./auth";

// ============================================================================
// REGISTRO DE AUDITORÍA (docs/RGPD.md, 6.8 y 6.9)
// ----------------------------------------------------------------------------
// Lo que no deja rastro en la ficha de una tarjeta: entrar (los logins que
// salen bien), exportar clientes, cambiar una contraseña o la config, crear y
// aceptar una invitación, cerrar las sesiones, archivar o borrar una tienda,
// borrar un cliente, y cada vez que el admin entra en las pantallas de una tienda.
//
// `detalle` NUNCA lleva datos personales: un código de tarjeta, una clave de la
// config, un número. Apuntar no puede tumbar lo que se apunta: nunca lanza.
//
// `usuario` es con quién se entró: el token de sesión lo lleva (lib/auth.js), así
// que el admin queda como «victor» o «diego». Una sesión de antes de llevarlo
// queda como "admin" a secas.
// ============================================================================

const quienEs = (sesion) =>
  !sesion ? { usuario: null, rol: null }
  : { usuario: sesion.usuario ?? (sesion.rol === "admin" ? "admin" : usuarioDe(sesion.negocio, sesion.rol)), rol: sesion.rol };

/**
 * @param {{negocio:string, rol:string, usuario?:string}|null} sesion  quien lo hace (null: el reloj)
 * @param {string|null} negocio  la tienda afectada
 * @param {string} accion  "login", "exportar", "config", "clave", "invitacion", "sesiones", "archivar", "borrar_tienda", "borrar_cliente", "entrada_admin"…
 * @param {string|null} [detalle]
 */
export async function auditar(sesion, negocio, accion, detalle = null) {
  try {
    await addAuditoria({ negocio, ...(sesion ? quienEs(sesion) : { usuario: "reloj", rol: "reloj" }), accion, detalle });
  } catch (e) {
    console.error(`[auditoria] no se pudo apuntar ${accion} en ${negocio}:`, e);
  }
}

/** El admin abrió una pantalla de una tienda (lo que ve ahí son sus clientes). */
export async function apuntarEntradaAdmin(sesion, negocio, pantalla) {
  if (sesion?.rol !== "admin") return;
  await auditar(sesion, negocio, "entrada_admin", pantalla);
}
