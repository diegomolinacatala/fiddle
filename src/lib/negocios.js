// ============================================================================
// NEGOCIOS (multi-tenant)
// ----------------------------------------------------------------------------
// Cada negocio = una tarjeta + su propia caja + su propio manager + su tag NFC.
// Estos son los PRESETS (diseño y valores por defecto). Se siembran en la BD la
// primera vez; luego el manager de cada negocio puede editarlos.
//
// Para añadir un negocio nuevo: añade una entrada aquí. Su link, su caja, su
// manager y su tag salen solos en /<slug>/...  (fully modular).
// ============================================================================

export const NEGOCIOS = {
  nube: {
    slug: "nube",
    nombre: "Nube Café",
    tipo: "sellos", // cartilla de sellos
    meta: 8,
    premio: "café gratis",
    acciones: ["sellar", "canjear", "restar"],
    tema: {
      emoji: "☕",
      estilo: "coffee", // preview colorido
      preset: "purple", // colorPreset del pase real (WalletWallet)
      pageBg: "linear-gradient(135deg,#ffd1dc 0%,#c3f0e0 40%,#a1c4fd 100%)",
      pageInk: "#2b2430", // color del texto sobre pageBg
      cardBg: "#fff7f2",
      ink: "#4a2c2a",
      accent: "#ff5c8a",
      atras: "Un sello por café. Al 8º invita la casa ☕ · L–V.",
    },
  },

  fade: {
    slug: "fade",
    nombre: "Fade Room",
    tipo: "sellos",
    meta: 6,
    premio: "corte gratis",
    acciones: ["sellar", "canjear"],
    tema: {
      emoji: "💈",
      estilo: "barber", // sleek + animado, niveles atrás
      preset: "dark",
      pageBg: "linear-gradient(160deg,#0d0d0f,#17171c)",
      pageInk: "#e9e9ec",
      cardBg: "#141416",
      ink: "#f2f2f2",
      accent: "#c9a24b", // oro
      atras: "Cada corte suma. 6 = uno gratis. Niveles: Bronce · Plata · Oro.",
    },
  },

  forno: {
    slug: "forno",
    nombre: "Forno Nostro",
    tipo: "descuento", // cupón de un solo uso
    meta: 1,
    premio: "20% en la Diavola",
    acciones: ["canjear"],
    tema: {
      emoji: "🍕",
      estilo: "pizza",
      preset: "red",
      pageBg: "radial-gradient(circle at 30% 20%,#ffd54a,#ff7a18 55%,#c1121f 100%)",
      pageInk: "#ffffff",
      cardBg: "#fff3e0",
      ink: "#5a1a12",
      accent: "#c1121f",
      atras: "Cupón 20% en tu Diavola 🍕 · un solo uso · enséñalo en caja.",
    },
  },
};

export const LISTA_NEGOCIOS = Object.values(NEGOCIOS);

/** @param {unknown} slug @returns {boolean} */
export const esNegocio = (slug) => typeof slug === "string" && Object.hasOwn(NEGOCIOS, slug);

// Config editable (lo que se guarda en BD). El resto (tema, tipo, nombre) es del preset.
// `ubicaciones` = tiendas físicas: el pase se sugiere en la pantalla de bloqueo al
// acercarse (Apple Wallet, máx. 10). [{ lat, lng, texto? }]
export function configDefault(slug) {
  const n = NEGOCIOS[slug];
  return { meta: n.meta, premio: n.premio, acciones: n.acciones, promo: null, ubicaciones: [] };
}
