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
export function ejemplo({ slug, nombre, premio, tema, cartillas }, sellos, { sellos2 = 0, estado = null, meta = 8 } = {}) {
  const config = { meta, premio, tema, ...(cartillas ? { cartillas } : {}) };
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
// cambia es el premio, la marca, la forma, el fondo y cómo se cuentan los puntos.
// - En las oscuras, lo claro del pase va en `detalle`: `accent` también pinta los
//   botones de la caja, con texto blanco, y nunca es claro.
// - `accent` nunca es el color de la tarjeta: las etiquetas («PREMIO») no se verían.
// ----------------------------------------------------------------------------
const tuya = (id, premio, tema, extra = {}) => ({ ...CAFETERIA, slug: `tu-cafeteria-${id}`, premio, tema: { estilo: "coffee", ...tema }, ...extra });
const diseno = (id, titulo, sellos, premio, tema, extra = {}) => {
  const { sellos2, estado, ...tienda } = extra;
  return { id, titulo, tienda: tuya(id, premio, tema, tienda), sellos, sellos2, estado };
};

// Lo básico, a propósito (07-11-2026): la marca que se llena y las dos cartillas
// lado a lado, que es lo que mejor luce en un móvil; casillas y alguna barra de
// vez en cuando. Café y cookies sobre todo. Nada de la banda «oscura» (lleva el
// poste de barbería), ni rayas, ni porciones: se veían recargadas. Cada una se
// miró rasterizada antes de entrar.
// Las dos cartillas van en la tienda; en el tema, solo que van lado a lado. La taza,
// siempre a la derecha: a la izquierda el asa se come la cifra.
const CAFES = { nombre: "Cafés", marca: "taza", modo: "relleno", meta: 8, premio: "café gratis" };
const COOKIES = { nombre: "Cookies", marca: "galleta", modo: "relleno", meta: 8, premio: "cookie gratis" };

export const DISENOS = [
  // ---- los del móvil de la portada
  diseno("abierto", "Dice si estás abierto", 6, "café gratis", { marca: "taza", modo: "relleno", banda: "clara", cardBg: "#f6ece0", ink: "#3a2318", accent: "#a0482a" }, { estado: "abierto" }),
  diseno("vaso", "Un vaso que se llena", 5, "matcha gratis", { estilo: "iced", marca: "vaso", modo: "relleno", banda: "clara", cardBg: "#eef2df", ink: "#22361b", accent: "#4f7f27" }),
  diseno("doble", "Cookies y café, lado a lado", 5, "cookie gratis", { doble: "lados", banda: "clara", cardBg: "#f3e9df", ink: "#3a2318", accent: "#7a4a2a" }, { sellos2: 3, cartillas: [COOKIES, CAFES] }),
  diseno("galleta", "Una cookie que se llena", 5, "cookie gratis", { estilo: "galletas", marca: "galleta", modo: "relleno", banda: "clara", cardBg: "#3b2314", ink: "#fbf1e3", accent: "#7a3f1d", detalle: "#f1c48d" }),
  diseno("casillas", "O un punto en cada casilla", 5, "café gratis", { marca: "taza", forma: "circulo", banda: "clara", cardBg: "#e8f0e3", ink: "#1c3a28", accent: "#357049" }),
  diseno("zumo", "Lo que vendas", 5, "zumo gratis", { marca: "manzana", modo: "relleno", banda: "clara", cardBg: "#fff3e3", ink: "#4a2a00", accent: "#d0501a" }),
  diseno("cerrado", "Y cuándo vuelves a abrir", 4, "café gratis", { marca: "taza", modo: "relleno", banda: "clara", cardBg: "#2b1d16", ink: "#f3e9dd", accent: "#8a5a2b", detalle: "#e8c48f" }, { estado: "cerrado" }),
  // ---- y los de las cintas
  diseno("lados-noche", "Cookies y café, de noche", 6, "cookie gratis", { doble: "lados", banda: "clara", cardBg: "#1f1b1a", ink: "#f2ede3", accent: "#8a5a2b", detalle: "#e3b860" }, { sellos2: 4, cartillas: [COOKIES, CAFES] }),
  diseno("cookie-rosa", "Una cookie rosa", 6, "cookie gratis", { estilo: "galletas", marca: "galleta", modo: "relleno", banda: "clara", cardBg: "#fde7ec", ink: "#4b1626", accent: "#b8325a" }),
  diseno("taza-azul", "Una taza, en azul", 5, "café gratis", { marca: "taza", modo: "relleno", banda: "clara", cardBg: "#e6eef5", ink: "#1f3346", accent: "#2f5f8a" }),
  diseno("cookie-casillas", "Cookies en casillas", 3, "cookie gratis", { estilo: "galletas", marca: "galleta", forma: "redondeado", banda: "clara", cardBg: "#fff6d6", ink: "#3d3200", accent: "#a86400" }),
  diseno("lados-matcha", "Matcha y cookies", 4, "matcha gratis", { estilo: "iced", doble: "lados", banda: "clara", cardBg: "#eef2df", ink: "#22361b", accent: "#4f7f27" }, { sellos2: 6, cartillas: [{ ...CAFES, nombre: "Matchas", marca: "vaso", premio: "matcha gratis" }, COOKIES] }),
  diseno("grano", "Granos de café", 5, "café gratis", { marca: "grano", forma: "circulo", banda: "clara", cardBg: "#f3ece4", ink: "#2b1a0e", accent: "#6b3e26" }),
  diseno("barra", "Una barra que avanza", 5, "café gratis", { marca: "taza", modo: "barra", banda: "clara", cardBg: "#fff7ec", ink: "#2b1a0e", accent: "#c2571a" }),
  diseno("corazon", "Corazones", 6, "brunch gratis", { marca: "corazon", forma: "circulo", banda: "clara", cardBg: "#ffe9e0", ink: "#5c1f12", accent: "#d04a2a" }),
  diseno("taza-teja", "Una taza, a todo color", 6, "café gratis", { marca: "taza", modo: "relleno", banda: "clara", cardBg: "#b8432f", ink: "#ffffff", accent: "#8c2219", detalle: "#ffffff" }),
  diseno("lados-helado", "Helado y café", 3, "helado gratis", { doble: "lados", banda: "clara", cardBg: "#f0eafb", ink: "#2c2150", accent: "#6a4fc0" }, { sellos2: 5, cartillas: [{ ...COOKIES, nombre: "Helados", marca: "helado", premio: "helado gratis" }, CAFES] }),
  diseno("smoothie", "Un smoothie que se llena", 6, "smoothie gratis", { estilo: "iced", marca: "vaso", modo: "relleno", banda: "clara", cardBg: "#fff0e6", ink: "#4a1e00", accent: "#c4501a" }),
  diseno("cookie-crema", "Cookies, en crema", 7, "cookie gratis", { estilo: "galletas", marca: "galleta", modo: "relleno", banda: "clara", cardBg: "#f6efe4", ink: "#3a2318", accent: "#8a5a2b" }),
];

const porId = (ids) => ids.map((id) => DISENOS.find((d) => d.id === id));

// El móvil de la portada: una tarjeta por cosa que sabe hacer, y la última dice
// cuándo vuelves a abrir (su título empieza por «Y»).
export const CARRUSEL = porId(["abierto", "vaso", "doble", "galleta", "casillas", "zumo", "cerrado"]);

// Las dos cintas que separan las secciones. La primera, justo debajo del móvil,
// con lo que el móvil no enseña; la segunda mezcla de todo. Ninguna repite
// diseño de la otra.
export const CINTAS = [
  porId(["lados-noche", "cookie-rosa", "taza-azul", "cookie-casillas", "lados-matcha", "grano", "barra", "corazon", "taza-teja"]),
  porId(["lados-helado", "galleta", "smoothie", "doble", "cookie-crema", "vaso", "abierto", "zumo", "casillas"]),
];

/** La diapositiva hecha tienda + cliente + línea de estado. */
export const ejemploDe = (d) => ejemplo(d.tienda, d.sellos, { sellos2: d.sellos2, estado: d.estado });
