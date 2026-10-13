import { firmarTexto, verificarTexto } from "./auth";
import { comprobarClave } from "./claves";
import {
  valorQuien, quienDePayload, empleadoDeValor, huellaDePin, HORAS_PIN, COOKIE_QUIEN, COOKIE_ULTIMO, DIAS_ULTIMO,
} from "./plantilla";

// ============================================================================
// QUIÉN ATIENDE DESDE ESTE MÓVIL (la parte del servidor de lib/plantilla.js)
// ----------------------------------------------------------------------------
// La cookie `quien` va firmada con el secreto de las sesiones y caduca a las
// HORAS_PIN; cada uso de la caja la vuelve a poner (ventana que se desliza: con
// cola no se pide el PIN, tras el descanso sí). Lleva la huella del PIN: si el
// manager se lo quita, la cookie deja de valer en todos sus móviles.
//
// Solo Node (route handlers y páginas): usa scrypt para comparar el PIN.
// ============================================================================

const comun = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };

/** El token de la cookie `quien` para este empleado, válido HORAS_PIN desde ahora. */
export const firmarQuien = (slug, empleado, ahora = Date.now()) =>
  firmarTexto(valorQuien(slug, empleado.id, huellaDePin(empleado.pin)), ahora + HORAS_PIN * 3600 * 1000);

/** El empleado al que apunta un token de `quien`, si la firma vale, no caducó y su PIN sigue siendo el mismo. */
export async function leerQuien(token, slug, plantilla, ahora = Date.now()) {
  return quienDePayload(await verificarTexto(token, ahora), slug, plantilla);
}

/** Lo mismo, leyendo la cookie de una Request. */
export const quienDeRequest = (request, slug, plantilla) =>
  leerQuien(request.cookies.get(COOKIE_QUIEN)?.value, slug, plantilla);

/** Quién fue la última vez en este móvil (sin firmar: solo propone un nombre). */
export const ultimoDeRequest = (request, slug, plantilla) =>
  empleadoDeValor(request.cookies.get(COOKIE_ULTIMO)?.value, slug, plantilla);

/** Deja (o renueva) las dos cookies en una respuesta: la firmada de hoy y la de «la última vez». */
export async function ponerCookiesQuien(res, slug, empleado) {
  res.cookies.set(COOKIE_QUIEN, await firmarQuien(slug, empleado), { ...comun, maxAge: HORAS_PIN * 3600 });
  res.cookies.set(COOKIE_ULTIMO, `${slug}.${empleado.id}`, { ...comun, maxAge: DIAS_ULTIMO * 24 * 3600 });
  return res;
}

/** ¿Es su PIN? Nunca lanza. */
export const pinCorrecto = (pin, empleado) => comprobarClave(pin, empleado?.pin);
