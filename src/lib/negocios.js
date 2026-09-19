// ============================================================================
// NEGOCIOS (multi-tenant)
// ----------------------------------------------------------------------------
// Un negocio = una tarjeta + su caja + su manager + su tag NFC.
//
// Los negocios VIVEN EN LA BASE DE DATOS: se crean, se editan y se archivan
// desde el admin (/admin). Lo que hay aquí abajo son dos cosas distintas:
//
//   SEMILLAS  los tres negocios de siempre, para que una base vacía arranque
//             con algo dentro. Una vez en la base, mandan los datos, no esto.
//   ESTILOS   las plantillas de diseño que puede elegir un negocio nuevo. El
//             dibujo del pase (lib/apple/dibujo.js) solo sabe de estos estilos.
// ============================================================================

/** Estilos de tarjeta disponibles. `estilo` decide la marca que se dibuja. */
export const ESTILOS = ["coffee", "barber", "pizza"];

// Cada estilo trae un tema completo y coherente. Al crear un negocio se parte
// de uno de estos y se le cambia el emoji y el color de acento.
const TEMA_DE_ESTILO = {
  coffee: {
    estilo: "coffee",
    emoji: "☕",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#ffd1dc 0%,#c3f0e0 40%,#a1c4fd 100%)",
    pageInk: "#2b2430",
    cardBg: "#fff7f2",
    ink: "#4a2c2a",
    accent: "#ff5c8a",
    atras: "Un sello por visita. Al completar la cartilla, invita la casa.",
  },
  barber: {
    estilo: "barber",
    emoji: "💈",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#0d0d0f,#17171c)",
    pageInk: "#e9e9ec",
    cardBg: "#141416",
    ink: "#f2f2f2",
    accent: "#c9a24b",
    atras: "Cada visita suma. Al completar la cartilla, la siguiente es gratis.",
  },
  pizza: {
    estilo: "pizza",
    emoji: "🍕",
    preset: "red",
    pageBg: "radial-gradient(circle at 30% 20%,#ffd54a,#ff7a18 55%,#c1121f 100%)",
    pageInk: "#ffffff",
    cardBg: "#fff3e0",
    ink: "#5a1a12",
    accent: "#c1121f",
    atras: "Cupón de un solo uso · enséñalo en caja.",
  },
};

/** Tema completo para un negocio nuevo: plantilla del estilo + sus retoques. */
export function temaPorDefecto({ estilo, emoji, accent } = {}) {
  const base = TEMA_DE_ESTILO[estilo] || TEMA_DE_ESTILO.coffee;
  return { ...base, ...(emoji ? { emoji } : {}), ...(accent ? { accent } : {}) };
}

// Primeros segmentos de la URL que NO pueden ser un negocio.
export const RESERVADOS = new Set(["api", "login", "admin", "plataforma", "p", "w", "icons", "_next", "favicon.ico"]);

/**
 * ¿Es un slug válido para un negocio? Solo mira la FORMA (minúsculas, guiones,
 * no reservado). Que exista o no lo dice la base de datos (`getNegocio`).
 * @param {unknown} slug
 */
export const esSlug = (slug) =>
  typeof slug === "string" && /^[a-z0-9][a-z0-9-]{1,30}$/.test(slug) && !RESERVADOS.has(slug);

// ---------------------------------------------------------------- semillas
// Los tres de siempre. Se siembran solos la primera vez que se lee la base.
export const SEMILLAS = {
  nube: {
    slug: "nube",
    nombre: "Nube Café",
    tipo: "sellos",
    meta: 8,
    premio: "café gratis",
    acciones: ["sellar", "canjear", "restar"],
    tema: { ...TEMA_DE_ESTILO.coffee, atras: "Un sello por café. Al 8º invita la casa ☕ · L–V." },
  },
  fade: {
    slug: "fade",
    nombre: "Fade Room",
    tipo: "sellos",
    meta: 6,
    premio: "corte gratis",
    acciones: ["sellar", "canjear"],
    tema: { ...TEMA_DE_ESTILO.barber, atras: "Cada corte suma. 6 = uno gratis. Niveles: Bronce · Plata · Oro." },
  },
  forno: {
    slug: "forno",
    nombre: "Forno Nostro",
    tipo: "descuento",
    meta: 1,
    premio: "20% en la Diavola",
    acciones: ["canjear"],
    tema: { ...TEMA_DE_ESTILO.pizza, atras: "Cupón 20% en tu Diavola 🍕 · un solo uso · enséñalo en caja." },
  },
};

export const LISTA_SEMILLAS = Object.values(SEMILLAS);

/**
 * Ficha completa de un negocio a partir de lo guardado. Rellena lo que falte
 * con la semilla (si la hay) y con el tema del estilo, para que un negocio
 * creado con cuatro datos a mano siga siendo un negocio válido.
 *
 * @param {string} slug
 * @param {object|null} guardado  { nombre, tipo, config }
 */
export function componerNegocio(slug, guardado) {
  const semilla = SEMILLAS[slug];
  const c = guardado?.config || {};
  const nombre = guardado?.nombre ?? semilla?.nombre ?? slug;
  const tipo = guardado?.tipo ?? semilla?.tipo ?? "sellos";
  const tema = { ...temaPorDefecto(c.tema || semilla?.tema), ...(semilla?.tema || {}), ...(c.tema || {}) };

  return {
    slug,
    nombre,
    tipo,
    tema,
    meta: c.meta ?? semilla?.meta ?? (tipo === "descuento" ? 1 : 8),
    premio: c.premio ?? semilla?.premio ?? "premio",
    acciones: c.acciones ?? semilla?.acciones ?? (tipo === "descuento" ? ["canjear"] : ["sellar", "canjear"]),
    promo: c.promo ?? null,
    ubicaciones: Array.isArray(c.ubicaciones) ? c.ubicaciones : [],
    // Texto libre que escribe el admin para que Claude sepa qué es esta tienda.
    brief: typeof c.brief === "string" ? c.brief : "",
    // Notas sobre campos concretos del pase: { "apple.premio": "esto debería ser X" }.
    notas: c.notas && typeof c.notas === "object" ? c.notas : {},
    archivado: c.archivado === true,
    creado: guardado?.creado ?? null,
  };
}

/** Config inicial de un negocio (lo que se guarda en la columna `config`). */
export function configInicial({ meta, premio, acciones, tema, brief }) {
  return {
    meta,
    premio,
    acciones,
    tema,
    brief: brief || "",
    promo: null,
    ubicaciones: [],
    notas: {},
    archivado: false,
  };
}
