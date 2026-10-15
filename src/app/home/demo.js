import { componerNegocio } from "@/lib/negocios";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { camposDelPase } from "@/lib/apple/pase";
import { estadoParaPase } from "@/lib/horario";
import { PALETA as P } from "./paleta";

// ============================================================================
// LAS TARJETAS DE EJEMPLO DE LA WEB
// ----------------------------------------------------------------------------
// Tiendas inventadas que NO están en la base: se componen igual que una de
// verdad (componerNegocio con un estilo de partida y sus colores) y se pintan con
// CaraDelPase, que usa camposDelPase() y stripDelPase(), lo mismo que arma el
// .pkpass. Así lo que enseña la web es lo que el cliente ve en su móvil, no una
// maqueta. Ningún kit de marca: esos son de su tienda.
// ============================================================================

// Un horario cualquiera, para que «Abierto hasta…» lo escriba estadoParaPase y
// no una frase puesta a mano. Las dos horas son fijas: la página es estática.
const HORARIO = {
  zona: "Europe/Madrid",
  semana: [0, 1, 2, 3, 4, 5, 6].map((d) => (d === 6 ? null : { abre: "08:00", cierra: "20:00" })),
};
const ESTADOS = {
  abierto: estadoParaPase(HORARIO, Date.parse("2026-10-13T09:00:00Z")), // martes, 11:00
  cerrado: estadoParaPase(HORARIO, Date.parse("2026-10-13T04:30:00Z")), // martes, 6:30
};

/**
 * Una tienda de ejemplo y su cliente, ya recortados como los ve el navegador.
 * @param {{ slug: string, nombre: string, premio: string, tema: object, cartillas?: object[] }} tienda
 */
export function ejemplo({ slug, nombre, premio, tema, cartillas }, sellos, { sellos2 = 0, estado = null } = {}) {
  const config = { meta: 8, premio, tema, ...(cartillas ? { cartillas } : {}) };
  const negocio = componerNegocio(slug, { nombre, tipo: "sellos", config });
  const cliente = { serial: `ejemplo-${slug}`, codigo: "K7P", sellos, sellos2, premios: 0 };
  return { negocio: negocioDeTarjeta(negocio), cliente: clienteDeTarjeta(cliente), estado: estado ? ESTADOS[estado] : null };
}

/**
 * Lo que dice la pantalla de bloqueo tras un sello: el primer campo que avisa al
 * cambiar, con su changeMessage, como lo escribe el iPhone.
 */
export function avisoDe({ negocio, cliente }) {
  const campo = camposDelPase(cliente, negocio).secondaryFields.find((f) => f.changeMessage);
  return campo ? campo.changeMessage.replace("%@", campo.value) : "";
}

export const CAFETERIA = {
  slug: "tu-cafeteria",
  nombre: "Tu cafetería",
  premio: "café gratis",
  // camelOscuro y no camel: también pinta las etiquetas pequeñas del pase («PREMIO»).
  tema: { estilo: "coffee", cardBg: P.crema, ink: P.verde, accent: P.camelOscuro },
};

// ----------------------------------------------------------------------------
// EL CATÁLOGO: lo que sale de combinar las piezas de lib/apple/dibujo.js
// Cada diseño, su paleta: NO son los colores de fiddle, son los de cafeterías que
// no se parecen entre sí, para que se vea la variedad. Todas se llaman «Tu
// cafetería»: es tu tienda con otro aspecto, no un cliente inventado. Lo que
// cambia es el premio, la marca, la forma, el fondo y cómo se cuentan los sellos.
// - En las oscuras, lo claro del pase va en `detalle`: `accent` también pinta los
//   botones de la caja, con texto blanco, y nunca es claro.
// - `accent` nunca es el color de la tarjeta: las etiquetas («PREMIO») no se verían.
// ----------------------------------------------------------------------------
const tuya = (id, premio, tema, extra = {}) => ({ ...CAFETERIA, slug: `tu-cafeteria-${id}`, premio, tema: { estilo: "coffee", ...tema }, ...extra });
const diseno = (id, titulo, sellos, premio, tema, extra = {}) => {
  const { sellos2, estado, ...tienda } = extra;
  return { id, titulo, tienda: tuya(id, premio, tema, tienda), sellos, sellos2, estado };
};

export const DISENOS = [
  // ---- los del móvil de la portada
  diseno("abierto", "Dice si estás abierto", 7, "café gratis", { cardBg: "#f6ece0", ink: "#3a2318", accent: "#b04a26" }, { estado: "abierto" }),
  diseno("vaso", "Un vaso que se llena", 5, "matcha gratis", { estilo: "iced", cardBg: "#eef2df", ink: "#22361b", accent: "#4f7f27" }),
  diseno("luna", "Una luna que se completa", 5, "infusión gratis", { marca: "estrella", modo: "luna", banda: "oscura", cardBg: "#221a45", ink: "#f0edfa", accent: "#5b48b0", detalle: "#f5d67c" }),
  diseno("doble", "Dos cartillas en una", 5, "café gratis", { doble: "filas", banda: "oscura", cardBg: "#3d0f1c", ink: "#fbefe9", accent: "#9c2f45", detalle: "#f2c66d" }, {
    sellos2: 2,
    cartillas: [
      { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
      { nombre: "Bollería", marca: "croissant", meta: 6, premio: "croissant gratis" },
    ],
  }),
  diseno("forma", "Elige la forma y el fondo", 5, "cookie gratis", { estilo: "galletas", marca: "galleta", forma: "rombo", banda: "rayas", cardBg: "#fde7ec", ink: "#4b1626", accent: "#c73a62" }),
  diseno("iniciales", "Con tus iniciales", 3, "café gratis", { estilo: "moderno", marca: "texto", texto: "TC", forma: "cuadrado", banda: "clara", cardBg: "#c2392b", ink: "#ffffff", accent: "#8c2219", detalle: "#ffffff" }),
  diseno("cerrado", "Y cuándo vuelves a abrir", 4, "café gratis", { marca: "grano", forma: "hexagono", banda: "clara", cardBg: "#1d1c21", ink: "#f2ede3", accent: "#93692a", detalle: "#e3b860" }, { estado: "cerrado" }),
  // ---- y los de las cintas
  diseno("galleta", "Una cookie que se llena", 5, "cookie gratis", { estilo: "galletas", marca: "galleta", modo: "relleno", banda: "clara", cardBg: "#3b2314", ink: "#fbf1e3", accent: "#7a3f1d", detalle: "#f1c48d" }),
  diseno("escalera", "Una escalera", 5, "smoothie gratis", { marca: "vaso", modo: "escalera", banda: "clara", cardBg: "#fff6d6", ink: "#3d3200", accent: "#c97a00" }),
  diseno("pulso", "Un pulso", 5, "café gratis", { marca: "taza", modo: "pulso", banda: "oscura", cardBg: "#0e1726", ink: "#e6f0ff", accent: "#2a6fdb", detalle: "#7fb2ff" }),
  diseno("porciones", "Un helado por porciones", 5, "helado gratis", { estilo: "heladeria", marca: "helado", modo: "porciones", banda: "degradado", cardBg: "#e6f7f1", ink: "#14352c", accent: "#d9578a" }),
  diseno("planta", "Una planta que crece", 5, "tostada gratis", { marca: "grano", modo: "planta", cardBg: "#e8f0e3", ink: "#1c3a28", accent: "#357049" }),
  diseno("anillos", "Un aro que se cierra", 6, "chai gratis", { estilo: "estudio", marca: "corazon", modo: "anillos", banda: "degradado", cardBg: "#f0eafb", ink: "#2c2150", accent: "#6a4fc0" }),
  diseno("aguja", "Una aguja que sube", 5, "café gratis", { marca: "grano", modo: "aguja", banda: "clara", cardBg: "#fff7ec", ink: "#2b1a0e", accent: "#e2621b" }),
  diseno("torre", "Una torre que se apila", 5, "tarta gratis", { marca: "taza", modo: "torre", banda: "clara", cardBg: "#e6eef5", ink: "#1f3346", accent: "#2f6f8f" }),
  diseno("cifra", "La cifra, bien grande", 6, "café gratis", { estilo: "moderno", marca: "grano", modo: "cifra", banda: "oscura", cardBg: "#111111", ink: "#ffffff", accent: "#d9481f" }),
  diseno("camino", "Un camino hasta el premio", 4, "brunch gratis", { modo: "camino", banda: "oscura", cardBg: "#0f3b3d", ink: "#e8f6f2", accent: "#1d7d6d", detalle: "#86e3cc" }),
  diseno("manzana", "Hexágonos sobre rayas", 5, "zumo gratis", { marca: "manzana", forma: "hexagono", banda: "rayas", cardBg: "#fff3e3", ink: "#4a2a00", accent: "#e0581a" }),
  diseno("corazon", "Corazones", 6, "brunch gratis", { marca: "corazon", forma: "redondeado", banda: "degradado", cardBg: "#ffe5d9", ink: "#5c1f12", accent: "#e4572e" }),
  diseno("taza", "Una taza que se llena", 5, "café gratis", { marca: "taza", modo: "relleno", banda: "degradado", cardBg: "#efe4d6", ink: "#3a2318", accent: "#7a4a2a" }),
];

const porId = (ids) => ids.map((id) => DISENOS.find((d) => d.id === id));

// El móvil de la portada: una tarjeta por cosa que sabe hacer, y la última dice
// cuándo vuelves a abrir (su título empieza por «Y»).
export const CARRUSEL = porId(["abierto", "vaso", "luna", "doble", "forma", "iniciales", "cerrado"]);

// Las dos cintas que separan las secciones. La primera, justo debajo del móvil,
// con lo que el móvil no enseña; la segunda mezcla de todo. Ninguna repite
// diseño de la otra.
export const CINTAS = [
  porId(["galleta", "escalera", "pulso", "porciones", "planta", "anillos", "aguja", "torre", "cifra"]),
  porId(["camino", "luna", "manzana", "iniciales", "corazon", "doble", "taza", "forma", "vaso"]),
];

/** La diapositiva hecha tienda + cliente + línea de estado. */
export const ejemploDe = (d) => ejemplo(d.tienda, d.sellos, { sellos2: d.sellos2, estado: d.estado });
