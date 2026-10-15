import { createHash, randomBytes } from "node:crypto";
import { crearInvitacion, getInvitacion, gastarInvitacion, reabrirInvitacion, invitacionesDeNegocio, getNegocio, guardarAcceso, hasSupabase } from "./store";
import { hashClave, problemaClaveElegida } from "./claves";
import { usuarioDe } from "./auth";
import { appUrl } from "./url";
import { auditar } from "./auditoria";
import { TOKEN } from "./tokenInvitacion";

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
//
// Cada rechazo lleva un `codigo` además del texto: la página decide con él qué
// aconsejar (pegar el código, pedir otro, ir a entrar) y el servidor lo deja en
// el log sin el token (docs/AUDITORIA-ACCESOS.md, A5).
// ============================================================================

export const DIAS_VALIDA = 7;

const huellaDe = (token) => createHash("sha256").update(String(token)).digest("hex");

export const RECHAZOS = {
  incompleto: "Enlace incompleto. Ábrelo tal cual llegó en el correo.",
  desconocido: "Este enlace no vale. Puede que se haya enviado otro más nuevo.",
  usada: "Este enlace ya se usó. Entra con tu usuario y tu contraseña.",
  caducada: "Este enlace ha caducado. Pide otro.",
  sin_tienda: "La tienda de este enlace ya no existe.",
};
const rechazo = (codigo) => ({ ok: false, codigo, motivo: RECHAZOS[codigo] });

/**
 * ¿Los enlaces que cree este servidor van a valer cuando el dueño los abra? En la
 * web de dev (Vercel sin base de datos) cada función tiene su /tmp: la invitación
 * vive en una y la siguiente petición puede caer en otra que no la tiene
 * (docs/ENTORNOS.md). En local, con ficheros, sí valen: hay un solo proceso.
 */
export const enlacesFiables = () => hasSupabase() || !process.env.VERCEL_ENV;

/**
 * Crea el enlace. Anula los anteriores de esa tienda que no se usaron.
 * @returns {Promise<{url:string, token:string, caduca:string}>}
 */
export async function nuevaInvitacion(slug, ahora = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const caduca = new Date(ahora + DIAS_VALIDA * 24 * 60 * 60 * 1000).toISOString();
  await crearInvitacion({ huella: huellaDe(token), negocio: slug, caduca });
  // El token suelto también: el correo lo lleva en texto por si el enlace llega cortado.
  return { url: `${appUrl()}/invitacion#${token}`, token, caduca };
}

/**
 * ¿Vale este enlace? Devuelve la tienda y sus usuarios, o por qué no vale.
 * @returns {Promise<{ok:true, negocio:object, usuarios:{manager:string, caja:string}} | {ok:false, codigo:string, motivo:string}>}
 */
export async function leerInvitacion(token, ahora = Date.now()) {
  if (!TOKEN.test(String(token ?? ""))) return rechazo("incompleto");
  const inv = await getInvitacion(huellaDe(token));
  if (!inv) return rechazo("desconocido");
  if (inv.usada) return rechazo("usada");
  if (Date.parse(inv.caduca) < ahora) return rechazo("caducada");
  const negocio = await getNegocio(inv.negocio);
  if (!negocio) return rechazo("sin_tienda");
  return {
    ok: true,
    negocio,
    usuarios: { manager: usuarioDe(negocio.slug, "manager"), caja: usuarioDe(negocio.slug, "caja") },
  };
}

/**
 * Fija las dos contraseñas y gasta el enlace.
 * @returns {Promise<{ok:true, negocio:string} | {ok:false, motivo:string, codigo?:string, campo?:string}>}
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
  // Primero se gasta el enlace, que es atómico: con dos pestañas, o un reintento del
  // navegador tras un corte, solo UNA petición escribe contraseñas y firma sesión;
  // la otra ve «ya se usó». (Si escribieran las dos, la segunda subiría
  // `accesos.actualizado` después de firmar la primera y esa sesión rebotaría al
  // login: justo «el enlace no funcionó».) Luego las contraseñas; si la base falla
  // a medias, el enlace se reabre para que el dueño repita: antes se quedaba sin
  // contraseñas y con el enlace gastado (docs/AUDITORIA-ACCESOS.md, M1). Si tampoco
  // se puede reabrir, queda en el log y en la auditoría: el admin lo ve en la ficha
  // («usado» sin que el dueño entre) y crea otro.
  const huella = huellaDe(token);
  if (!(await gastarInvitacion(huella))) return rechazo("usada");
  try {
    await guardarAcceso({ usuario: usuarios.manager, negocio: negocio.slug, rol: "manager", hash: hashManager });
    await guardarAcceso({ usuario: usuarios.caja, negocio: negocio.slug, rol: "caja", hash: hashCaja });
  } catch (e) {
    try {
      await reabrirInvitacion(huella);
    } catch (e2) {
      console.error("[invitación] guardar falló y no se pudo reabrir el enlace:", e2);
      await auditar({ negocio: negocio.slug, rol: "manager" }, negocio.slug, "invitacion", "sin_reabrir");
    }
    throw e;
  }
  return { ok: true, negocio: negocio.slug };
}

/**
 * Cómo está el enlace de una tienda, para la ficha del admin: el pendiente (sin
 * usar y sin caducar), el último que caducó sin usarse y cuándo se usó el último.
 * Nunca el token ni su huella. Crear uno nuevo borra los pendientes y los
 * caducados (lib/store.js), así que como mucho hay uno de cada.
 * @returns {Promise<{pendiente:{creado:string, caduca:string}|null, caducada:{creado:string, caduca:string}|null, ultimaUsada:string|null}>}
 */
export async function estadoInvitacion(slug, ahora = Date.now()) {
  const todas = await invitacionesDeNegocio(slug);
  const sinUsar = todas.filter((i) => !i.usada);
  const fechas = ({ creado, caduca }) => ({ creado, caduca });
  const pendiente = sinUsar.find((i) => Date.parse(i.caduca) >= ahora);
  const caducada = sinUsar.find((i) => Date.parse(i.caduca) < ahora);
  const usadas = todas.map((i) => i.usada).filter(Boolean).sort();
  return {
    pendiente: pendiente ? fechas(pendiente) : null,
    caducada: caducada ? fechas(caducada) : null,
    ultimaUsada: usadas.at(-1) ?? null,
  };
}
