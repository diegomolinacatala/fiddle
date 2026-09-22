// ============================================================================
// RESUMEN DEL ESTADO DE UN CLIENTE
// ----------------------------------------------------------------------------
// Funciones puras (sin dependencias) que responden "¿cuánto lleva este cliente?"
// en el idioma de cada sitio. Viven aparte para que la MISMA cuenta la usen el
// pase de Google, las pantallas y la vista previa del manager, y no se separen
// nunca entre sí.
// ============================================================================

import { cuentaCorta } from "./cartillas";

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

/** Etiqueta + valor del contador, tal cual sale en Google Wallet ("Sellos 5/8"). */
export function puntosDe(cliente, negocio) {
  const e = estadoDe(cliente, negocio);
  // Dos cartillas: "Cookies · Cafés" / "3/8 · 5/8", en el mismo orden que la banda.
  if (negocio.cartillas && !e.esCupon) {
    return { label: negocio.cartillas.map((c) => c.nombre).join(" · "), balance: cuentaCorta(cliente, negocio) };
  }
  return {
    label: e.esCupon ? "Cupón" : "Sellos",
    balance: e.esCupon ? (e.usado ? "Usado" : "Válido") : `${e.sellos}/${e.meta}`,
  };
}
