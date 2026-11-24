import { createHash, randomBytes } from "node:crypto";
import { crearInvitacion, getInvitacion, gastarInvitacion, reabrirInvitacion, invitacionesDeNegocio, getNegocio, guardarAcceso, hasSupabase, accesosDeNegocio } from "./store";
import { hashClave, problemaClaveElegida } from "./claves";
import { claveValida, correoLibre, usuarioCajaOcupado, normalizarLogin } from "./accesos";
import { nuevoCodigo, mandarCodigo, comprobarCodigo } from "./codigos";
import { usuarioDe, claveDe } from "./auth";
import { appUrl } from "./url";
import { auditar } from "./auditoria";
import { TOKEN } from "./tokenInvitacion";
import { leerEmail } from "./interesados";

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
// Desde el 24-11-2026 el enlace también pone CON QUÉ se entra: el dueño escribe su
// correo y lo verifica con un código (lib/codigos.js), que pasa a ser su usuario; y
// elige el usuario de la caja (lib/accesos.js). Hasta que termina, los accesos de
// antes siguen valiendo: así se le pasa el enlace a una tienda que ya trabaja.
//
// Cada rechazo lleva un `codigo` además del texto: la página decide con él qué
// aconsejar (pegar el código, pedir otro, ir a entrar) y el servidor lo deja en
// el log sin el token (docs/AUDITORIA-ACCESOS.md, A5).
// ============================================================================

export const DIAS_VALIDA = 7;
// Qué fija el enlace. "alta": las dos contraseñas (la tienda nueva). "manager": solo
// la del dueño, para recuperarla cuando la pierde; la caja no se entera. Es el mismo
// enlace, la misma tabla y la misma pantalla: cuando la recuperación la haga Supabase
// Auth por correo (CLAUDE.md → Cuentas), esto se convierte en eso, no se duplica.
export const ALCANCES = ["alta", "manager"];

const huellaDe = (token) => createHash("sha256").update(String(token)).digest("hex");

export const RECHAZOS = {
  incompleto: "Enlace incompleto. Ábrelo tal cual llegó en el correo.",
  desconocido: "Este enlace no vale. Puede que se haya enviado otro más nuevo.",
  usada: "Este enlace ya se usó. Entra con tu correo y tu contraseña.",
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
 * Crea el enlace. Anula los anteriores de esa tienda que no se usaron, del alcance que sean.
 * @returns {Promise<{url:string, token:string, caduca:string, alcance:string}>}
 */
export async function nuevaInvitacion(slug, { alcance = "alta", ahora = Date.now() } = {}) {
  if (!ALCANCES.includes(alcance)) throw new Error(`Alcance no válido: ${alcance}`);
  const token = randomBytes(32).toString("base64url");
  const caduca = new Date(ahora + DIAS_VALIDA * 24 * 60 * 60 * 1000).toISOString();
  await crearInvitacion({ huella: huellaDe(token), negocio: slug, caduca, alcance });
  // El token suelto también: el correo lo lleva en texto por si el enlace llega cortado.
  return { url: `${appUrl()}/invitacion#${token}`, token, caduca, alcance };
}

/**
 * ¿Vale este enlace? Devuelve la tienda, qué fija y sus usuarios, o por qué no vale.
 * @returns {Promise<{ok:true, negocio:object, alcance:string, usuarios:{manager:string, caja:string}} | {ok:false, codigo:string, motivo:string}>}
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
    alcance: inv.alcance,
    usuarios: { manager: usuarioDe(negocio.slug, "manager"), caja: usuarioDe(negocio.slug, "caja") },
  };
}

/** Para qué es el código de un enlace: el de una invitación no vale en otra. */
const propositoDe = (token) => `inv:${huellaDe(token).slice(0, 24)}`;

/**
 * Lo que la pantalla ofrece ya escrito y si la tienda ya trabaja: el correo con que
 * entra el dueño (o el que dio en /alta), el usuario de la caja (o el de siempre) y
 * si ya hay accesos (para decirle que los de ahora valen hasta que termine).
 * @returns {Promise<{email:string|null, cajaUsuario:string, yaEntra:boolean}>}
 */
export async function sugerenciasDe(negocio) {
  const filas = await accesosDeNegocio(negocio.slug).catch(() => []);
  const de = (rol) => filas.find((f) => f.usuario === usuarioDe(negocio.slug, rol));
  return {
    email: de("manager")?.login || negocio.alta?.email || null,
    cajaUsuario: de("caja")?.login || usuarioDe(negocio.slug, "caja"),
    yaEntra: filas.length > 0 || Boolean(claveDe(negocio.slug, "manager") || claveDe(negocio.slug, "caja")),
  };
}

/**
 * Manda el código al correo que escribe el dueño. No cambia nada: solo prueba que
 * el correo es suyo. Lo que vuelve (`reto`) va con el código al aceptar.
 * @returns {Promise<{ok:true, reto:string, email:string} | {ok:false, motivo:string, codigo?:string, campo?:string}>}
 */
export async function codigoDeInvitacion(token, email, ahora = Date.now()) {
  const inv = await leerInvitacion(token, ahora);
  if (!inv.ok) return inv;
  // Si el correo ya es de otra tienda se dice DESPUÉS del código (solo lo sabe su
  // dueño): aquí, cualquiera con un enlace (y /alta da uno) sabría qué correos tienen cuenta.
  const correo = leerEmail(email)?.toLowerCase();
  if (!correo) return { ok: false, motivo: "Revisa el correo", campo: "email" };
  const { reto, codigo } = await nuevoCodigo(correo, propositoDe(token), ahora);
  const envio = await mandarCodigo(correo, codigo, { para: inv.negocio.nombre, ahora });
  if (!envio.ok) return { ok: false, motivo: envio.motivo, campo: "email", codigo: "correo" };
  return { ok: true, reto, email: correo };
}

/** ¿Es bueno el código? Para pasar de paso; al aceptar se vuelve a mirar. */
export async function verificarCodigoDeInvitacion(token, reto, codigo, ahora = Date.now()) {
  const inv = await leerInvitacion(token, ahora);
  if (!inv.ok) return inv;
  const r = await comprobarCodigo(reto, codigo, propositoDe(token), ahora);
  if (!r.ok) return { ok: false, motivo: r.motivo, campo: "codigo", codigoCorreo: r.codigo };
  const libre = await correoLibre(r.email, inv.negocio.slug);
  return libre.problema ? { ok: false, motivo: libre.problema, campo: "email" } : { ok: true, email: libre.email };
}

/**
 * Fija el correo y la contraseña del dueño y, con alcance "alta", el usuario y la
 * contraseña de la caja; y gasta el enlace. Las contraseñas van como ELEGIDAS
 * (lib/claves.js): se comparan tal cual.
 * @param {string} token
 * @param {{reto:string, codigo:string, manager:string, cajaUsuario?:string, caja?:string}} datos
 * @returns {Promise<{ok:true, negocio:string, alcance:string, email:string} | {ok:false, motivo:string, codigo?:string, campo?:string}>}
 */
export async function aceptarInvitacion(token, { reto, codigo, manager, cajaUsuario, caja }, ahora = Date.now()) {
  const inv = await leerInvitacion(token, ahora);
  if (!inv.ok) return inv;
  const { negocio, alcance } = inv;
  const slug = negocio.slug;

  // Mira el código y que el correo siga libre (otra tienda pudo quedárselo entretanto).
  const verificado = await verificarCodigoDeInvitacion(token, reto, codigo, ahora);
  if (!verificado.ok) return verificado;
  const email = verificado.email;

  const malManager = problemaClaveElegida(manager, email);
  if (malManager) return { ok: false, motivo: malManager, campo: "manager" };

  // Qué se va a guardar. Los hashes se calculan antes de gastar el enlace (tardan).
  let cambios;
  if (alcance === "manager") {
    // La caja sigue con la suya, y la sabe todo el personal: la nueva no puede ser esa.
    if (await claveValida(slug, "caja", manager)) {
      return { ok: false, motivo: "No puede ser la misma que la de la caja: la sabe quien la use", campo: "manager" };
    }
    cambios = [{ usuario: usuarioDe(slug, "manager"), rol: "manager", hash: await hashClave(manager, "elegida"), login: email }];
  } else {
    const loginCaja = normalizarLogin(cajaUsuario);
    const malUsuario = await usuarioCajaOcupado(loginCaja, slug);
    if (malUsuario) return { ok: false, motivo: malUsuario, campo: "cajaUsuario" };
    const malCaja = problemaClaveElegida(caja, loginCaja);
    if (malCaja) return { ok: false, motivo: malCaja, campo: "caja" };
    // La de la caja la sabrá cualquier empleado: no puede abrir también el manager.
    if (String(manager).trim() === String(caja).trim()) {
      return { ok: false, motivo: "La de la caja tiene que ser distinta de la tuya", campo: "caja" };
    }
    const [hashManager, hashCaja] = await Promise.all([hashClave(manager, "elegida"), hashClave(caja, "elegida")]);
    cambios = [
      { usuario: usuarioDe(slug, "manager"), rol: "manager", hash: hashManager, login: email },
      { usuario: usuarioDe(slug, "caja"), rol: "caja", hash: hashCaja, login: loginCaja },
    ];
  }

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
    for (const cambio of cambios) await guardarAcceso({ ...cambio, negocio: slug });
  } catch (e) {
    try {
      await reabrirInvitacion(huella);
    } catch (e2) {
      console.error("[invitación] guardar falló y no se pudo reabrir el enlace:", e2);
      await auditar({ negocio: slug, rol: "manager" }, slug, "invitacion", "sin_reabrir");
    }
    throw e;
  }
  return { ok: true, negocio: slug, alcance, email };
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
