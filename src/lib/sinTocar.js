// ============================================================================
// LA FICHA VUELVE SOLA AL ESCÁNER
// ----------------------------------------------------------------------------
// Con el móvil fijo en el mostrador (La Delicantería), la caja se queda en la
// ficha del último cliente y, al cogerlo para el siguiente, se le suma o se le
// quita un sello al anterior sin querer. Si nadie toca la ficha en
// `SEGUNDOS_SIN_TOCAR`, vuelve sola al escáner. Es una opción de la caja
// (Tienda → Editar vista de caja, `volverSinTocar`), apagada de partida: con el
// móvil en el bolsillo hay quien abre la ficha, prepara el café y sella después.
//
// Los segundos son fijos a propósito: un número más que elegir es una duda más
// para el dueño, y 30 s dan para cobrar y charlar sin que el siguiente cliente
// encuentre la ficha del anterior.
//
// Los últimos `SEGUNDOS_AVISO` se ve una barra que se vacía: cualquier toque la
// para y la cuenta vuelve a empezar. Antes de irse, lo pendiente sale por la
// fila de siempre (lib/filaCaja.js, `vaciar`).
//
// Funciones puras: la hora llega de fuera. La usa la ficha y la prueban los tests.
// ============================================================================

export const SEGUNDOS_SIN_TOCAR = 30;
export const SEGUNDOS_AVISO = 5;

// Lo que cuenta como tocar la ficha: un toque (o un clic), el scroll y el
// teclado (escribir el nombre del cliente). El scroll cuenta por lo que lo
// mueve (el dedo, la rueda, las flechas), no por el evento `scroll`: ese salta
// también cuando la página cambia de alto sola (se quita el recuadro del premio
// al refrescarse) y alargaría la cuenta sin que nadie la tocara. `input` va
// aparte porque en Android el teclado no siempre manda `keydown` por cada letra.
export const TOQUES = ["pointerdown", "touchstart", "touchmove", "wheel", "keydown", "input"];

/**
 * En qué punto está la cuenta `ahora` si la ficha se tocó por última vez en `ultimo` (ms).
 * Si el reloj del móvil va hacia atrás, nunca espera más de la cuenta entera.
 * @returns {{ fase: "quieta" | "aviso" | "salir", quedan: number, mirar: number }}
 *   `quedan`: ms hasta irse. `mirar`: ms hasta el próximo cambio de fase (0 si ya toca irse).
 */
export function cuentaSinTocar(ultimo, ahora, segundos = SEGUNDOS_SIN_TOCAR, aviso = SEGUNDOS_AVISO) {
  const total = segundos * 1000;
  const quedan = Math.min(total, Math.max(0, ultimo + total - ahora));
  if (quedan === 0) return { fase: "salir", quedan: 0, mirar: 0 };
  const avisoMs = Math.min(aviso * 1000, total);
  if (quedan <= avisoMs) return { fase: "aviso", quedan, mirar: quedan };
  return { fase: "quieta", quedan, mirar: quedan - avisoMs };
}
