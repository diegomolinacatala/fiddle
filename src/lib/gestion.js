import { createHash, timingSafeEqual } from "node:crypto";
import { cookieDeTarjeta, serialRecordado } from "./recordar";

// ============================================================================
// "TU TARJETA Y TUS DATOS" — quién puede tocar una tarjeta sin login
// ----------------------------------------------------------------------------
// La página /p/<serial>/datos deja al cliente dejar las promos, descargar sus
// datos y borrar la tarjeta (docs/RGPD.md, 3.5). El serial NO basta: va en el
// QR, y una foto de la tarjeta de otro llevaría hasta ahí. Vale una de dos:
//
//   la COOKIE del tap   el teléfono con que la sacó (lib/recordar.js). Es lo que
//                       lleva el botón «Gestionar mi tarjeta» de la página de la
//                       tienda.
//   la LLAVE            va en el reverso del pase (Apple) y en sus enlaces
//                       (Google), detrás de `#`: no llega al servidor al abrir
//                       la página ni a los logs; la página la manda en el cuerpo.
//
// La llave sale del `auth_token` del pase, pero NO es él: el token autentica al
// iPhone ante el web service, y un enlace se reenvía con más facilidad que un
// pase. Y no hace falta guardarla: se recalcula.
// ============================================================================

const LARGO = 32;

/** La llave de una tarjeta, o null si no tiene token (no debería pasar). */
export function llaveDe(cliente) {
  if (!cliente?.auth_token) return null;
  return createHash("sha256").update(`gestion:${cliente.serial}:${cliente.auth_token}`).digest("base64url").slice(0, LARGO);
}

/** El enlace entero, llave incluida: el del reverso del pase y Google. */
export function enlaceGestion(appUrl, cliente) {
  const llave = llaveDe(cliente);
  return `${appUrl}/p/${cliente.serial}/datos${llave ? `#${llave}` : ""}`;
}

function llaveValida(cliente, llave) {
  const buena = llaveDe(cliente);
  if (!buena || typeof llave !== "string" || llave.length !== buena.length) return false;
  return timingSafeEqual(Buffer.from(llave), Buffer.from(buena));
}

/**
 * ¿Esta petición puede tocar esta tarjeta? `cookies` es lo de Next
 * (`request.cookies` o `cookies()`): un `.get(nombre)?.value`.
 * @returns {"llave"|"cookie"|null} por dónde entró, o null
 */
export function accesoATarjeta(cliente, { cookies, llave }) {
  if (!cliente || cliente.borrado_en || cliente.fusionado_en) return null;
  if (llaveValida(cliente, llave)) return "llave";
  const recordado = serialRecordado(cookies?.get(cookieDeTarjeta(cliente.negocio))?.value);
  return recordado === cliente.serial ? "cookie" : null;
}
