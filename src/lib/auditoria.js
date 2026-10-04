import { addAuditoria } from "./store";
import { usuarioDe } from "./auth";

// ============================================================================
// REGISTRO DE AUDITORÍA (docs/RGPD.md, 6.8 y 6.9)
// ----------------------------------------------------------------------------
// Lo que no deja rastro en la ficha de una tarjeta: exportar clientes, cambiar
// una contraseña o la config, archivar o borrar una tienda, borrar un cliente,
// y cada vez que el admin entra en las pantallas de una tienda.
//
// `detalle` NUNCA lleva datos personales: un código de tarjeta, una clave de la
// config, un número. Apuntar no puede tumbar lo que se apunta: nunca lanza.
//
// La sesión del admin no dice cuál de los dos es (victor o diego): firma la
// plataforma y el rol. Queda como "admin".
// ============================================================================

const quienEs = (sesion) =>
  !sesion ? { usuario: null, rol: null }
  : sesion.rol === "admin" ? { usuario: "admin", rol: "admin" }
  : { usuario: usuarioDe(sesion.negocio, sesion.rol), rol: sesion.rol };

/**
 * @param {{negocio:string, rol:string}|null} sesion  quien lo hace (null: el reloj)
 * @param {string|null} negocio  la tienda afectada
 * @param {string} accion  "exportar", "config", "clave", "archivar", "borrar_tienda", "borrar_cliente", "entrada_admin"…
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
