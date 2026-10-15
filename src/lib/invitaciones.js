import { createHash, randomBytes } from "node:crypto";
import { crearInvitacion, getInvitacion, gastarInvitacion, getNegocio, guardarAcceso } from "./store";
import { hashClave, problemaClaveElegida } from "./claves";
import { comprobarAcceso } from "./accesos";
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
// Qué fija el enlace. "alta": las dos contraseñas (la tienda nueva). "manager": solo
// la del dueño, para recuperarla cuando la pierde; la caja no se entera. Es el mismo
// enlace, la misma tabla y la misma pantalla: cuando la recuperación la haga Supabase
// Auth por correo (CLAUDE.md → Cuentas), esto se convierte en eso, no se duplica.
export const ALCANCES = ["alta", "manager"];

const huellaDe = (token) => createHash("sha256").update(String(token)).digest("hex");
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes en base64url
const YA_USADO = "Este enlace ya se usó. Entra con tu usuario y tu contraseña.";

/**
 * Crea el enlace. Anula los anteriores de esa tienda que no se usaron, del alcance que sean.
 * @returns {Promise<{url:string, caduca:string, alcance:string}>}
 */
export async function nuevaInvitacion(slug, { alcance = "alta", ahora = Date.now() } = {}) {
  if (!ALCANCES.includes(alcance)) throw new Error(`Alcance no válido: ${alcance}`);
  const token = randomBytes(32).toString("base64url");
  const caduca = new Date(ahora + DIAS_VALIDA * 24 * 60 * 60 * 1000).toISOString();
  await crearInvitacion({ huella: huellaDe(token), negocio: slug, caduca, alcance });
  return { url: `${appUrl()}/invitacion#${token}`, caduca, alcance };
}

/**
 * ¿Vale este enlace? Devuelve la tienda, qué fija y sus usuarios, o por qué no vale.
 * @returns {Promise<{ok:true, negocio:object, alcance:string, usuarios:{manager:string, caja:string}} | {ok:false, motivo:string}>}
 */
export async function leerInvitacion(token, ahora = Date.now()) {
  if (!TOKEN.test(String(token ?? ""))) return { ok: false, motivo: "Enlace incompleto. Ábrelo tal cual llegó en el correo." };
  const inv = await getInvitacion(huellaDe(token));
  if (!inv) return { ok: false, motivo: "Este enlace no vale. Puede que se haya enviado otro más nuevo." };
  if (inv.usada) return { ok: false, motivo: YA_USADO };
  if (Date.parse(inv.caduca) < ahora) return { ok: false, motivo: "Este enlace ha caducado. Pide otro." };
  const negocio = await getNegocio(inv.negocio);
  if (!negocio) return { ok: false, motivo: "La tienda de este enlace ya no existe." };
  return {
    ok: true,
    negocio,
    alcance: inv.alcance,
    usuarios: { manager: usuarioDe(negocio.slug, "manager"), caja: usuarioDe(negocio.slug, "caja") },
  };
}

/**
 * Fija las contraseñas que toque según el alcance (las dos, o solo la del manager) y
 * gasta el enlace. Van como ELEGIDAS (lib/claves.js): se comparan tal cual.
 * @returns {Promise<{ok:true, negocio:string, alcance:string} | {ok:false, motivo:string, campo?:string}>}
 */
export async function aceptarInvitacion(token, { manager, caja }, ahora = Date.now()) {
  const inv = await leerInvitacion(token, ahora);
  if (!inv.ok) return inv;
  const { usuarios, negocio, alcance } = inv;
  const slug = negocio.slug;

  const malManager = problemaClaveElegida(manager, usuarios.manager);
  if (malManager) return { ok: false, motivo: malManager, campo: "manager" };

  if (alcance === "manager") {
    // La caja sigue con la suya, y la sabe todo el personal: la nueva no puede ser esa.
    if (await comprobarAcceso(usuarios.caja, manager)) {
      return { ok: false, motivo: "No puede ser la misma que la de la caja: la sabe quien la use", campo: "manager" };
    }
    const hashManager = await hashClave(manager, "elegida");
    if (!(await gastarInvitacion(huellaDe(token)))) return { ok: false, motivo: YA_USADO };
    await guardarAcceso({ usuario: usuarios.manager, negocio: slug, rol: "manager", hash: hashManager });
    return { ok: true, negocio: slug, alcance };
  }

  const malCaja = problemaClaveElegida(caja, usuarios.caja);
  if (malCaja) return { ok: false, motivo: malCaja, campo: "caja" };
  // La de la caja la sabrá cualquier empleado: no puede abrir también el manager.
  if (String(manager).trim() === String(caja).trim()) {
    return { ok: false, motivo: "La de la caja tiene que ser distinta de la tuya", campo: "caja" };
  }

  // Los hashes antes de gastar el enlace (tardan): si algo falla, se puede reintentar.
  const [hashManager, hashCaja] = await Promise.all([hashClave(manager, "elegida"), hashClave(caja, "elegida")]);
  if (!(await gastarInvitacion(huellaDe(token)))) return { ok: false, motivo: YA_USADO };
  await guardarAcceso({ usuario: usuarios.manager, negocio: slug, rol: "manager", hash: hashManager });
  await guardarAcceso({ usuario: usuarios.caja, negocio: slug, rol: "caja", hash: hashCaja });
  return { ok: true, negocio: slug, alcance };
}
