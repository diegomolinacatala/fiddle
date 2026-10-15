// ============================================================================
// RESUMEN DEL ESTADO DE UN CLIENTE
// ----------------------------------------------------------------------------
// Funciones puras (sin dependencias) que responden "¿cuánto lleva este cliente?"
// en el idioma de cada sitio. Viven aparte para que la MISMA cuenta la usen el
// pase de Google, las pantallas y la vista previa del manager, y no se separen
// nunca entre sí.
// ============================================================================

import { cartillasDe, cuentaDeCartilla } from "./cartillas";

/** @param {{sellos:number, premios:number}} cliente @param {{tipo:string, meta:number}} negocio */
export function estadoDe(cliente, negocio) {
  const esCupon = negocio.tipo === "descuento";
  const meta = negocio.meta;
  const sellos = Math.min(cliente?.sellos ?? 0, meta);
  const faltan = Math.max(0, meta - (cliente?.sellos ?? 0));
  return {
    esCupon,
    meta,
    sellos,
    faltan,
    completa: !esCupon && faltan === 0,
    usado: esCupon && (cliente?.premios ?? 0) > 0,
  };
}

/**
 * Los huecos de puntos de Google Wallet, tal cual salen ("Sellos 5/8"). Google
 * tiene dos (loyaltyPoints y secondaryLoyaltyPoints). Con dos cartillas, uno por
 * cartilla, en el mismo orden que la banda y con lo que tiene guardado de ella:
 * "Cookies 3/8 · 2 gratis". Con una, solo el contador: el otro hueco es para los
 * premios guardados (google/pase.js).
 * @returns {{label:string, balance:string}[]}
 */
export function puntosDe(cliente, negocio) {
  const e = estadoDe(cliente, negocio);
  if (negocio.cartillas && !e.esCupon) {
    return cartillasDe(cliente, negocio).map((c) => ({ label: c.nombre, balance: cuentaDeCartilla(c) }));
  }
  return [{
    label: e.esCupon ? "Cupón" : "Sellos",
    balance: e.esCupon ? (e.usado ? "Usado" : "Válido") : `${e.sellos}/${e.meta}`,
  }];
}
