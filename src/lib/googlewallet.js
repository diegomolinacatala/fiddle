import { hayGoogle, configGoogle, faltanVariablesGoogle } from "./google/config";
import { guardarObjeto, actualizarObjeto, avisarObjeto, avisarClase, asegurarClase, enlaceGuardar } from "./google/api";
import { TIPO_GOOGLE } from "./google/pase";
import { registrarPase, marcarInstalacion, addEvento, destinosDeAviso } from "./store";

// ============================================================================
// GOOGLE WALLET (Android) — fachada
// ----------------------------------------------------------------------------
// Lo que usa el resto de la app. El detalle está en lib/google/:
//   config.js  credenciales · pase.js  clase y objeto · api.js  REST de Google
//
// Quién tiene la tarjeta en Google Wallet se apunta en `registros` con
// pass_type "google" (el token es el id del objeto), igual que un iPhone. Se
// apunta cuando el cliente pide guardarla: Google solo confirma el guardado con
// callbacks firmados, que no están montados. Consecuencia: si alguien abre el
// enlace y no guarda, se le intentará actualizar y Google dirá que ese objeto
// existe pero nadie lo tiene. No rompe nada.
//
// Nada de aquí lanza hacia fuera salvo `prepararGuardado`: igual que con APNs,
// el sello ya está guardado y un fallo de Google no puede tumbar la caja.
// ============================================================================

export { hayGoogle, faltanVariablesGoogle, TIPO_GOOGLE };

const CONCURRENCIA = 10;

/** Enlace del botón "Añadir a Google Wallet". Pasa por nosotros para crear antes el objeto. */
export const rutaGuardarGoogle = (serial) => (hayGoogle() && serial ? `/api/google/guardar/${serial}` : null);

/**
 * A dónde manda el tap de la tienda a un cliente que no es de iPhone. En Android
 * con Google activo, directo a guardar en Google Wallet: igual que el iPhone
 * recibe el .pkpass y ve "Añadir" sin pasar por ninguna página. Si ya la tiene,
 * Google la abre en vez de duplicarla. Sin Google, o en ordenador, la tarjeta web.
 */
export const destinoDelTap = (plataforma, serial) =>
  (plataforma === "android" && rutaGuardarGoogle(serial)) || `/p/${serial}`;

/**
 * Lo que hace /api/google/guardar: deja el objeto creado en Google con el
 * estado de ahora, apunta que el cliente lo tiene y devuelve el enlace de Google.
 * Si la API falla, el enlace lleva clase y objeto enteros y Google los crea al
 * guardar: el cliente no se queda sin tarjeta por un mal momento de la API.
 * @returns {Promise<string>} URL de pay.google.com
 */
export async function prepararGuardado(cliente, negocio) {
  const config = configGoogle();
  let completo = false;
  let objetoId = `${config.issuerId}.${cliente.serial}`;
  try {
    objetoId = await guardarObjeto(config, cliente, negocio);
  } catch (e) {
    console.error(`[google] no se pudo crear el objeto de ${cliente.serial}; va el enlace completo:`, e);
    completo = true;
  }
  try {
    const nuevo = await registrarPase({
      dispositivo: `google-${cliente.serial}`,
      pushToken: objetoId,
      passType: TIPO_GOOGLE,
      serial: cliente.serial,
      negocio: negocio.slug,
    });
    if (nuevo) {
      await marcarInstalacion(cliente.serial, true);
      await addEvento(cliente.serial, "instalado", "Guardó la tarjeta en Google Wallet", { negocio: negocio.slug, actor: "cliente" });
    }
  } catch (e) {
    console.error(`[google] no se pudo apuntar el guardado de ${cliente.serial}:`, e);
  }
  return enlaceGuardar(config, cliente, negocio, { completo });
}

// Seriales (de esta lista o de toda la tienda) que tienen la tarjeta en Google.
async function serialesEnGoogle({ seriales, negocio }) {
  const destinos = await destinosDeAviso({ seriales, negocio, passType: TIPO_GOOGLE });
  return new Set(destinos.map((d) => d.serial));
}

async function enLotes(lista, fn) {
  let hechos = 0;
  const fallos = [];
  for (let i = 0; i < lista.length; i += CONCURRENCIA) {
    const r = await Promise.allSettled(lista.slice(i, i + CONCURRENCIA).map(fn));
    for (const x of r) {
      if (x.status === "fulfilled" && x.value !== false) hechos++;
      else if (x.status === "rejected") fallos.push(String(x.reason?.message || x.reason));
    }
  }
  if (fallos.length) console.error("[google] fallos al actualizar:", JSON.stringify(fallos.slice(0, 5)));
  return { hechos, fallos: fallos.length };
}

/**
 * Pone al día el pase de Google de UN cliente (tras un sello, un canje, un
 * cambio de nombre). `notificar`: que el teléfono avise (solo si suben o se
 * canjean sellos; una corrección de la caja se actualiza en silencio).
 * @returns {Promise<number>} 1 si se actualizó, 0 si no lo tiene o no hay Google
 */
export async function actualizarEnGoogle(cliente, negocio, { notificar = false } = {}) {
  if (!hayGoogle()) return 0;
  try {
    if (!(await serialesEnGoogle({ seriales: [cliente.serial] })).has(cliente.serial)) return 0;
    return (await actualizarObjeto(configGoogle(), cliente, negocio, { notificar })) ? 1 : 0;
  } catch (e) {
    console.error(`[google] no se pudo actualizar ${cliente.serial}:`, e);
    return 0;
  }
}

/**
 * Campaña a un grupo: a cada uno de la lista que tenga la tarjeta en Google le
 * llega el mensaje con aviso. Sin texto, se le quita el mensaje de la tarjeta.
 * @param {object[]} clientes  ya con el `mensaje` guardado
 * @returns {Promise<number>} cuántos
 */
export async function mensajeEnGoogle(clientes, negocio, texto) {
  if (!hayGoogle() || !clientes.length) return 0;
  try {
    const conGoogle = await serialesEnGoogle({ seriales: clientes.map((c) => c.serial) });
    const config = configGoogle();
    const destino = clientes.filter((c) => conGoogle.has(c.serial));
    const r = await enLotes(destino, (c) => (texto
      ? avisarObjeto(config, c, negocio, "Para ti", texto)
      : actualizarObjeto(config, c, negocio)));
    return r.hechos;
  } catch (e) {
    console.error("[google] campaña fallida:", e);
    return 0;
  }
}

/**
 * La tienda cambió (promo, premio, sellos de la cartilla, ubicación). La clase
 * se reescribe siempre; con una promo NUEVA, además, suena el teléfono de todos.
 * Si cambió la cartilla, los objetos también (el "5/8" pasa a "5/10").
 * @param {{promoNueva?: string|null, clientes?: object[]}} opciones
 *   `clientes`: los de la tienda, si hay que reescribir sus objetos
 * @returns {Promise<number>} objetos actualizados (o 1 si solo fue la clase)
 */
export async function tiendaEnGoogle(negocio, { promoNueva = null, clientes = null } = {}) {
  if (!hayGoogle()) return 0;
  try {
    const config = configGoogle();
    const conGoogle = await serialesEnGoogle({ negocio: negocio.slug });
    if (!conGoogle.size) return 0;
    if (promoNueva) await avisarClase(config, negocio, "Promo", promoNueva);
    else await asegurarClase(config, negocio);
    if (!clientes) return conGoogle.size;
    const r = await enLotes(clientes.filter((c) => conGoogle.has(c.serial)), (c) => actualizarObjeto(config, c, negocio));
    return r.hechos;
  } catch (e) {
    console.error(`[google] no se pudo actualizar la tienda ${negocio.slug}:`, e);
    return 0;
  }
}
