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
//   ESTILOS   las plantillas de partida que puede elegir un negocio nuevo. No
//             son moldes cerrados: cada una es una combinación de las piezas de
//             lib/apple/dibujo.js, y desde /admin se cambian una a una.
// ============================================================================

// El dibujo del pase se arma con piezas sueltas (ver lib/apple/dibujo.js): qué
// marca, con qué forma de casilla y sobre qué banda. Un ESTILO no es más que
// una combinación de partida con nombre; a partir de ahí cada tienda cambia lo
// que quiera sin tocar código.
export { MARCAS, FORMAS, BANDAS, MODOS, NOMBRES_FAMILIA, familiaDeModo, modosDeFamilia } from "./apple/dibujo";
import { FORMAS, BANDAS, MODOS, piezasDeTema, resolverMarca } from "./apple/dibujo";
import { normalizarCartillas } from "./validacion";

// Cada estilo trae un tema completo y coherente. Al crear un negocio se parte
// de uno de estos y se le cambia el emoji y el color de acento.
const TEMA_DE_ESTILO = {
  coffee: {
    estilo: "coffee",
    emoji: "☕",
    marca: "coffee",
    forma: "circulo",
    banda: "clara",
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
    marca: "barber",
    forma: "redondeado",
    banda: "oscura",
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
    marca: "pizza",
    forma: "circulo",
    banda: "clara",
    preset: "red",
    pageBg: "radial-gradient(circle at 30% 20%,#ffd54a,#ff7a18 55%,#c1121f 100%)",
    pageInk: "#ffffff",
    cardBg: "#fff3e0",
    ink: "#5a1a12",
    accent: "#c1121f",
    atras: "Cupón de un solo uso · enséñalo en caja.",
  },
  // Neutro y sin dibujito: la marca son las iniciales o el número de la tienda.
  moderno: {
    estilo: "moderno",
    emoji: "◆",
    marca: "texto",
    texto: "",
    forma: "cuadrado",
    banda: "clara",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#f5efe6 0%,#e8dccb 55%,#d8c7ae 100%)",
    pageInk: "#3a2f26",
    cardBg: "#faf6f0",
    ink: "#3a2f26",
    accent: "#a98963",
    atras: "Un sello por visita. Al completar la cartilla, invita la casa.",
  },
  // La taza que se llena: un solo vaso grande que sube con cada sello.
  iced: {
    estilo: "iced",
    emoji: "\u{1F964}",
    marca: "vaso",
    forma: "circulo",
    banda: "degradado",
    modo: "relleno",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#f7f1e8 0%,#e9dcc9 55%,#cbb79b 100%)",
    pageInk: "#3a2f26",
    cardBg: "#fdfaf5",
    ink: "#3a2f26",
    accent: "#b08968",
    atras: "Cada consumición llena un poco más el vaso. Lleno = invita la casa.",
  },
  panaderia: {
    estilo: "panaderia",
    emoji: "\u{1F950}",
    marca: "croissant",
    forma: "circulo",
    banda: "clara",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#fff3dd 0%,#ffe0b8 55%,#f6c98a 100%)",
    pageInk: "#4a3319",
    cardBg: "#fff8ec",
    ink: "#4a3319",
    accent: "#d98d3f",
    atras: "Un sello por compra. Al completar la cartilla, te invitamos.",
  },
  bar: {
    estilo: "bar",
    emoji: "\u{1F37A}",
    marca: "jarra",
    forma: "redondeado",
    banda: "oscura",
    modo: "relleno",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#101015,#1c1a16)",
    pageInk: "#ece7dc",
    cardBg: "#17161a",
    ink: "#f3efe6",
    accent: "#e0b25c",
    atras: "Cada ronda llena la jarra. Llena = la siguiente la ponemos nosotros.",
  },
  mascotas: {
    estilo: "mascotas",
    emoji: "\u{1F43E}",
    marca: "huella",
    forma: "hexagono",
    banda: "clara",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#e7f8f1 0%,#c9ece0 55%,#9fd8c6 100%)",
    pageInk: "#14352c",
    cardBg: "#f2fbf7",
    ink: "#14352c",
    accent: "#3f8f7a",
    atras: "Un sello por visita. Al completar la cartilla, baño o premio gratis.",
  },
  gym: {
    estilo: "gym",
    emoji: "\u{1F3CB}️",
    marca: "pesa",
    forma: "cuadrado",
    banda: "oscura",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#0e0e10,#1a1614)",
    pageInk: "#eaeaea",
    cardBg: "#141416",
    ink: "#f2f2f2",
    accent: "#ff5f1f",
    atras: "Una sesión, un sello. Al completar la cartilla, semana gratis.",
  },
  belleza: {
    estilo: "belleza",
    emoji: "\u{1F338}",
    marca: "flor",
    forma: "rombo",
    banda: "rayas",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#ffeaf4 0%,#ffd6e8 55%,#e7b7d6 100%)",
    pageInk: "#43203a",
    cardBg: "#fff5fa",
    ink: "#43203a",
    accent: "#c46a9b",
    atras: "Un sello por cita. Al completar la cartilla, tratamiento de regalo.",
  },
  // Nutrición y suplementos: pocas compras grandes (un bote al mes), no muchas
  // visitas pequeñas. La barra que se carga de discos da sensación de avance
  // donde ocho círculos vacíos darían pereza.
  nutricion: {
    estilo: "nutricion",
    emoji: "\u{1F4AA}",
    marca: "bote",
    forma: "cuadrado",
    banda: "oscura",
    modo: "pesas",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#0b0f0d,#13201a)",
    pageInk: "#e8f5ee",
    cardBg: "#0f1512",
    ink: "#eafaf1",
    accent: "#00e07a",
    atras: "Un disco por compra. Al cargar la barra, el siguiente bote va a mitad de precio.",
  },
  pizzeria: {
    estilo: "pizzeria",
    emoji: "\u{1F355}",
    marca: "pizza",
    forma: "circulo",
    banda: "degradado",
    modo: "pizza",
    preset: "red",
    pageBg: "radial-gradient(circle at 30% 20%,#ffd54a,#ff7a18 55%,#c1121f 100%)",
    pageInk: "#ffffff",
    cardBg: "#fff3e0",
    ink: "#5a1a12",
    accent: "#c1121f",
    atras: "Cada pedido te gana una porción. Pizza completa = pizza gratis.",
  },
  // Cafetería de galletas: la cookie mordida, en chocolate sobre masa tostada.
  galletas: {
    estilo: "galletas",
    emoji: "\u{1F36A}",
    marca: "galleta",
    forma: "circulo",
    banda: "clara",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#fbf1e3 0%,#f1dcc0 55%,#d9b48a 100%)",
    pageInk: "#3b2314",
    cardBg: "#fbf1e3",
    ink: "#3b2314",
    accent: "#7a3f1d",
    atras: "Un sello por cookie. Al completar la cartilla, la siguiente te la invitamos.",
  },
  heladeria: {
    estilo: "heladeria",
    emoji: "\u{1F366}",
    marca: "helado",
    forma: "circulo",
    banda: "degradado",
    modo: "porciones",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#ffe3f1 0%,#d8ecff 55%,#c9f2e9 100%)",
    pageInk: "#3b2740",
    cardBg: "#fff8fc",
    ink: "#3b2740",
    accent: "#e8709b",
    atras: "Cada tarrina cierra un trozo. Círculo completo, tarrina de regalo.",
  },
  // Estudio de yoga/pilates: bonos largos, y ahí el aro se lee mejor que 20
  // casillas. El anillo aguanta cualquier meta sin cambiar de aspecto.
  estudio: {
    estilo: "estudio",
    emoji: "\u{1F9D8}",
    marca: "corazon",
    forma: "circulo",
    banda: "degradado",
    modo: "anillos",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#eef3ec 0%,#d7e4d3 55%,#b9cdb4 100%)",
    pageInk: "#2a382a",
    cardBg: "#f6faf4",
    ink: "#2a382a",
    accent: "#6b8f71",
    atras: "Una clase, un tramo del aro. Aro cerrado, clase invitada.",
  },
  // Club de socios: cartillas largas (20, 30 visitas) donde las casillas ya son
  // confeti y la barra se sigue leyendo de un vistazo.
  club: {
    estilo: "club",
    emoji: "\u{2B50}",
    marca: "estrella",
    forma: "redondeado",
    banda: "oscura",
    modo: "barra",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#0d0d10,#1a1712)",
    pageInk: "#ece7dc",
    cardBg: "#141416",
    ink: "#f3efe6",
    accent: "#c9a24b",
    atras: "Cada visita avanza la barra. Al completarla, premio de socio.",
  },
  floristeria: {
    estilo: "floristeria",
    emoji: "\u{1F33F}",
    marca: "flor",
    forma: "circulo",
    banda: "degradado",
    modo: "planta",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#f0f6ec 0%,#dbe9d4 55%,#bcd4b2 100%)",
    pageInk: "#25331f",
    cardBg: "#f8fbf5",
    ink: "#25331f",
    accent: "#5f8f52",
    atras: "Cada compra hace crecer la planta. Cuando florece, ramo de regalo.",
  },
  // Bar de noche, tatuajes, copas: la cuenta contada como fases de la luna.
  nocturno: {
    estilo: "nocturno",
    emoji: "\u{1F319}",
    marca: "copa",
    forma: "circulo",
    banda: "oscura",
    modo: "luna",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#06070d,#141a2e)",
    pageInk: "#e6e9f5",
    cardBg: "#0b0d16",
    ink: "#eef1fb",
    accent: "#b9c6ff",
    atras: "Cada visita llena un poco más la luna. Luna llena, ronda invitada.",
  },
  taller: {
    estilo: "taller",
    emoji: "\u{1F527}",
    marca: "rayo",
    forma: "cuadrado",
    banda: "oscura",
    modo: "aguja",
    preset: "dark",
    pageBg: "linear-gradient(160deg,#0d0d0f,#1d1712)",
    pageInk: "#f0ece6",
    cardBg: "#141414",
    ink: "#f5f2ee",
    accent: "#ff7a18",
    atras: "Cada servicio sube la aguja. Al tope, revisión gratis.",
  },
  academia: {
    estilo: "academia",
    emoji: "\u{1F4DA}",
    marca: "libro",
    forma: "redondeado",
    banda: "clara",
    modo: "escalera",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#eef2fb 0%,#d9e2f5 55%,#b9c8e8 100%)",
    pageInk: "#1f2a44",
    cardBg: "#f7f9fe",
    ink: "#1f2a44",
    accent: "#3d5da8",
    atras: "Una clase, un escalón. Al llegar arriba, sesión de regalo.",
  },
  clinica: {
    estilo: "clinica",
    emoji: "\u{1FA7A}",
    marca: "corazon",
    forma: "circulo",
    banda: "blanca",
    modo: "pulso",
    preset: "purple",
    pageBg: "linear-gradient(135deg,#eaf6fb 0%,#d2ecf5 55%,#aed9ea 100%)",
    pageInk: "#10333f",
    cardBg: "#f5fcff",
    ink: "#10333f",
    accent: "#0e8ba8",
    atras: "Cada sesión suma un latido. Al completar, sesión de regalo.",
  },
};

/** Combinaciones de partida al crear una tienda (el orden es el del selector). */
export const ESTILOS = Object.keys(TEMA_DE_ESTILO);

/**
 * Rellena las piezas de dibujo que falten. Los temas viejos solo tenían
 * `estilo`, así que de ahí se deducen: un tema guardado hace meses tiene que
 * seguir pintándose igual que antes.
 */
export function completarTema(tema = {}) {
  return { ...tema, ...piezasDeTema(tema) };
}

/** Tema completo para un negocio nuevo: plantilla del estilo + sus retoques. */
export function temaPorDefecto({ estilo, emoji, accent, marca, forma, banda, modo, texto } = {}) {
  const base = TEMA_DE_ESTILO[estilo] || TEMA_DE_ESTILO.coffee;
  const retoques = {
    emoji, accent, texto,
    marca: resolverMarca(marca) || undefined,
    forma: FORMAS.includes(forma) ? forma : undefined,
    banda: BANDAS.includes(banda) ? banda : undefined,
    modo: MODOS.includes(modo) ? modo : undefined,
  };
  for (const k of Object.keys(retoques)) if (retoques[k] === undefined || retoques[k] === "") delete retoques[k];
  return completarTema({ ...base, ...retoques });
}

// Primeros segmentos de la URL que NO pueden ser un negocio.
// "crm" está reservado aunque no sea una ruta de primer nivel: /admin/crm es la
// vista de la plataforma, y una tienda con ese slug la taparía.
export const RESERVADOS = new Set(["api", "login", "admin", "plataforma", "crm", "p", "w", "icons", "marcas", "_next", "favicon.ico"]);

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
    tema: { ...TEMA_DE_ESTILO.coffee, atras: "Un sello por café. Al 8º invita la casa. De lunes a viernes." },
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
    tema: { ...TEMA_DE_ESTILO.pizza, atras: "20 % en tu Diavola. Un solo uso: enséñalo en caja." },
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
  const tema = completarTema({ ...temaPorDefecto(c.tema || semilla?.tema), ...(semilla?.tema || {}), ...(c.tema || {}) });
  // Con dos cartillas, la primera manda sobre la meta y el premio del negocio:
  // es la misma cartilla vista desde el código de siempre (ver lib/cartillas.js).
  const cartillas = tipo === "descuento" ? null : normalizarCartillas(c.cartillas);

  return {
    slug,
    nombre,
    tipo,
    tema,
    meta: cartillas?.[0].meta ?? c.meta ?? semilla?.meta ?? (tipo === "descuento" ? 1 : 8),
    premio: cartillas?.[0].premio ?? c.premio ?? semilla?.premio ?? "premio",
    cartillas,
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
