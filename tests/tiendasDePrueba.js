// ============================================================================
// TIENDAS DE PRUEBA
// ----------------------------------------------------------------------------
// La app de verdad solo trae La Delicantería (lib/negocios.js). Los tests
// necesitan además los tres casos de siempre, que cubren lo que ella no:
//   nube   una sola cartilla (8 cafés)
//   fade   otra cartilla con otra meta y otro dibujo (barbería)
//   forno  un cupón de un solo uso (tipo "descuento")
// Se meten como semillas antes de cada fichero de tests (vitest `setupFiles`),
// así que para los tests existen igual que antes y en producción no aparecen.
// ============================================================================

import { SEMILLAS, temaDeEstilo } from "@/lib/negocios";

export const TIENDAS_DE_PRUEBA = {
  nube: {
    slug: "nube",
    nombre: "Nube Café",
    tipo: "sellos",
    meta: 8,
    premio: "café gratis",
    acciones: ["sellar", "canjear", "restar"],
    tema: { ...temaDeEstilo("coffee"), atras: "Un sello por café. Al 8º invita la casa. De lunes a viernes." },
  },
  fade: {
    slug: "fade",
    nombre: "Fade Room",
    tipo: "sellos",
    meta: 6,
    premio: "corte gratis",
    acciones: ["sellar", "canjear"],
    tema: { ...temaDeEstilo("barber"), atras: "Cada corte suma. 6 = uno gratis. Niveles: Bronce · Plata · Oro." },
  },
  forno: {
    slug: "forno",
    nombre: "Forno Nostro",
    tipo: "descuento",
    meta: 1,
    premio: "20% en la Diavola",
    acciones: ["canjear"],
    tema: { ...temaDeEstilo("pizza"), atras: "20 % en tu Diavola. Un solo uso: enséñalo en caja." },
  },
};

Object.assign(SEMILLAS, TIENDAS_DE_PRUEBA);
