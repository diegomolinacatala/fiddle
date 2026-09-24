import { createHash, randomBytes } from "node:crypto";
import { crearInvitacion, getInvitacion, gastarInvitacion, getNegocio, guardarAcceso } from "./store";
import { hashClave, problemaClaveElegida } from "./claves";
import { usuarioDe } from "./auth";
import { appUrl } from "./url";

// ============================================================================
// INVITAR A UNA TIENDA (el dueño elige sus contraseñas)
// ----------------------------------------------------------------------------
// El admin crea la tienda y le manda al dueño un enlace por correo (lo envía
// desde su propio correo: el botón abre un mailto ya escrito). Al abrirlo, el
// dueño elige la contraseña del manager y la de la caja, y entra.
//
// El enlace lleva un token de un solo uso que caduca: la contraseña nunca va en
// claro por correo. En la base solo queda su huella (sha256), así que ni
// leyendo la tabla se puede usar. El token va detrás de `#`: el navegador no lo
// manda al pedir la página, y no acaba en los logs de Vercel ni en un Referer.
//
// Al elegirlas, las contraseñas que generó el admin dejan de valer (se
// sobrescribe el hash), y la invitación queda gastada.
// ============================================================================

export const DIAS_VALIDA = 7;

const huellaDe = (token) => createHash("sha256").update(String(token)).digest("hex");
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes en base64url

/**
 * Crea el enlace. Anula los anteriores de esa tienda que no se usaron.
 * @returns {Promise<{url:string, caduca:string}>}
 */
export async function nuevaInvitacion(slug, ahora = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const caduca = new Date(ahora + DIAS_VALIDA * 24 * 60 * 60 * 1000).toISOString();
  await crearInvitacion({ huella: huellaDe(token), negocio: slug, caduca });
  return { url: `${appUrl()}/invitacion#${token}`, caduca };
}

/**
 * ¿Vale este enlace? Devuelve la tienda y sus usuarios, o por qué no vale.
 * @returns {Promise<{ok:true, negocio:object, usuarios:{manager:string, caja:string}} | {ok:false, motivo:string}>}
 */
export async function leerInvitacion(token, ahora = Date.now()) {
  if (!TOKEN.test(String(token ?? ""))) return { ok: false, motivo: "Enlace incompleto. Ábrelo tal cual llegó en el correo." };
  const inv = await getInvitacion(huellaDe(token));
  if (!inv) return { ok: false, motivo: "Este enlace no vale. Puede que se haya enviado otro más nuevo." };
  if (inv.usada) return { ok: false, motivo: "Este enlace ya se usó. Entra con tu usuario y tu contraseña." };
  if (Date.parse(inv.caduca) < ahora) return { ok: false, motivo: "Este enlace ha caducado. Pide otro." };
  const negocio = await getNegocio(inv.negocio);
  if (!negocio) return { ok: false, motivo: "La tienda de este enlace ya no existe." };
  return {
    ok: true,
    negocio,
    usuarios: { manager: usuarioDe(negocio.slug, "manager"), caja: usuarioDe(negocio.slug, "caja") },
  };
}

/**
 * Fija las dos contraseñas y gasta el enlace.
 * @returns {Promise<{ok:true, negocio:string} | {ok:false, motivo:string, campo?:string}>}
 */
export async function aceptarInvitacion(token, { manager, caja }, ahora = Date.now()) {
  const inv = await leerInvitacion(token, ahora);
  if (!inv.ok) return inv;
  const { usuarios, negocio } = inv;

  const malManager = problemaClaveElegida(manager, usuarios.manager);
  if (malManager) return { ok: false, motivo: malManager, campo: "manager" };
  const malCaja = problemaClaveElegida(caja, usuarios.caja);
  if (malCaja) return { ok: false, motivo: malCaja, campo: "caja" };
  // La de la caja la sabrá cualquier empleado: no puede abrir también el manager.
  if (String(manager).trim() === String(caja).trim()) {
    return { ok: false, motivo: "La de la caja tiene que ser distinta de la tuya", campo: "caja" };
  }

  // Los hashes antes de gastar el enlace (tardan): si algo falla, se puede reintentar.
  const [hashManager, hashCaja] = await Promise.all([hashClave(manager), hashClave(caja)]);
  if (!(await gastarInvitacion(huellaDe(token)))) {
    return { ok: false, motivo: "Este enlace ya se usó. Entra con tu usuario y tu contraseña." };
  }
  await guardarAcceso({ usuario: usuarios.manager, negocio: negocio.slug, rol: "manager", hash: hashManager });
  await guardarAcceso({ usuario: usuarios.caja, negocio: negocio.slug, rol: "caja", hash: hashCaja });
  return { ok: true, negocio: negocio.slug };
}
