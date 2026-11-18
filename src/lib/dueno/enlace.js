// ============================================================================
// EL ENLACE DEL QR: bajarse la tarjeta del dueño en el iPhone sin entrar
// ----------------------------------------------------------------------------
// El dueño suele mirar Tienda en el ordenador, y ahí no hay Wallet. La fila le
// enseña un QR; la cámara del iPhone abre el enlace en Safari, que NO tiene su
// sesión, así que el enlace lleva su propia llave:
//
//   - Firmada con el secreto de las sesiones (firmarTexto): no se puede inventar.
//   - Caduca a los MINUTOS_ENLACE: un QR fotografiado o reenviado deja de valer pronto.
//   - Lleva la huella del token del pase: «Cambiar la llave» en el admin lo anula.
//   - Lleva quién lo pidió, para que la descarga quede apuntada a su nombre.
//
// El pase solo lleva cifras de la tienda (ningún cliente), y lo mismo se baja
// desde Tienda con la sesión. Lo que se acepta: quien tenga el enlace en esos
// minutos se lleva la tarjeta del dueño.
// ============================================================================

import { createHash } from "node:crypto";
import { firmarTexto, verificarTexto } from "../auth";
import { getNegocio } from "../store";
import { tarjetaDe } from "./tarjeta";

export const MINUTOS_ENLACE = 10;
const PREFIJO = "duenopase";
const SLUG = /^[a-z0-9-]+$/;
const USUARIO = /^[a-z0-9_-]+$/;

const huella = (token) => createHash("sha256").update(String(token)).digest("hex").slice(0, 16);

/**
 * La llave del QR para la tarjeta de esta tienda, pedida por `sesion`.
 * @returns {Promise<{token:string, hasta:string}>}
 */
export async function firmarEnlace(negocio, sesion, ahora = Date.now()) {
  const tarjeta = tarjetaDe(negocio);
  if (!tarjeta) throw new Error("Esta tienda no tiene la tarjeta del dueño");
  const usuario = String(sesion?.usuario ?? sesion?.rol ?? "");
  const rol = String(sesion?.rol ?? "");
  if (!SLUG.test(negocio.slug) || !USUARIO.test(usuario) || !USUARIO.test(rol)) throw new Error("Sesión no válida para el enlace");
  const exp = ahora + MINUTOS_ENLACE * 60_000;
  const token = await firmarTexto([PREFIJO, negocio.slug, huella(tarjeta.token), rol, usuario].join(":"), exp);
  return { token, hasta: new Date(exp).toISOString() };
}

/**
 * La tienda y quién pidió el enlace, si la llave vale: firma buena, sin caducar y con
 * la tarjeta encendida y la misma llave del pase. Si no, null. Nunca lanza.
 * @returns {Promise<{negocio:object, quien:{negocio:string, rol:string, usuario:string}}|null>}
 */
export async function negocioDeEnlace(token, ahora = Date.now()) {
  try {
    const texto = await verificarTexto(String(token || ""), ahora);
    if (!texto) return null;
    const [prefijo, slug, suHuella, rol, usuario, ...sobra] = texto.split(":");
    if (prefijo !== PREFIJO || sobra.length || !SLUG.test(slug || "")) return null;
    const negocio = await getNegocio(slug);
    const tarjeta = tarjetaDe(negocio);
    if (!tarjeta || huella(tarjeta.token) !== suHuella) return null;
    return { negocio, quien: { negocio: slug, rol, usuario } };
  } catch {
    return null;
  }
}
