import { ejemplo, CAFETERIA } from "../demo";

// ============================================================================
// LO QUE SE PUEDE ELEGIR EN «DISEÑA TU TARJETA» (/home/tarjeta)
// ----------------------------------------------------------------------------
// Un probador para quien aún no es cliente: pocas opciones y todas buenas. No es
// el editor del manager (ahí está todo); aquí cada mando tiene cinco u ocho
// valores elegidos a mano para que ninguna combinación quede fea.
//
// La tarjeta se arma con `ejemplo()` de demo.js, que compone una tienda como una
// de verdad y la pinta con las funciones del pase: lo que se ve aquí es lo que
// saldría en el Wallet, no una maqueta. Puro y sin nada del servidor: lo usa el
// navegador en cada cambio.
// ============================================================================

/**
 * Las paletas, en el orden del carrusel. Las reglas de demo.js valen aquí:
 * `accent` nunca es claro (pinta botones con texto blanco) y, en las oscuras, lo
 * claro del pase va en `detalle`. La banda lisa es siempre la «clara» (un
 * velo del color de la tarjeta): la «oscura» lleva el poste de barbería.
 */
export const PALETAS = [
  { id: "crema", nombre: "Crema", cardBg: "#f6ece0", ink: "#3a2318", accent: "#b04a26" },
  { id: "matcha", nombre: "Matcha", cardBg: "#eef2df", ink: "#22361b", accent: "#4f7f27" },
  { id: "rosa", nombre: "Fresa", cardBg: "#fde7ec", ink: "#4b1626", accent: "#c73a62" },
  { id: "lavanda", nombre: "Lavanda", cardBg: "#f0eafb", ink: "#2c2150", accent: "#6a4fc0" },
  { id: "mantequilla", nombre: "Mantequilla", cardBg: "#fff6d6", ink: "#3d3200", accent: "#a86400" },
  { id: "teja", nombre: "Teja", cardBg: "#c2392b", ink: "#ffffff", accent: "#8c2219", detalle: "#ffffff" },
  { id: "cacao", nombre: "Cacao", cardBg: "#3b2314", ink: "#fbf1e3", accent: "#7a3f1d", detalle: "#f1c48d" },
  { id: "granate", nombre: "Granate", cardBg: "#3d0f1c", ink: "#fbefe9", accent: "#9c2f45", detalle: "#f2c66d" },
  { id: "botella", nombre: "Botella", cardBg: "#0f3b3d", ink: "#e8f6f2", accent: "#1d7d6d", detalle: "#86e3cc" },
  { id: "noche", nombre: "Noche", cardBg: "#0e1726", ink: "#e6f0ff", accent: "#2a6fdb", detalle: "#7fb2ff" },
  { id: "carbon", nombre: "Carbón", cardBg: "#1d1c21", ink: "#f2ede3", accent: "#93692a", detalle: "#e3b860" },
];

/** Las marcas que salen: las de una cafetería. El croissant no: en pequeño parece un arco. */
export const ICONOS = [
  { id: "taza", nombre: "Taza" },
  { id: "grano", nombre: "Grano" },
  { id: "vaso", nombre: "Vaso" },
  { id: "jarra", nombre: "Jarra" },
  { id: "galleta", nombre: "Cookie" },
  { id: "helado", nombre: "Helado" },
  { id: "corazon", nombre: "Corazón" },
  { id: "estrella", nombre: "Estrella" },
];

/** Cómo se cuentan los puntos (MODOS de dibujo.js, sin la pizza: es de pizzería). */
export const MODOS = [
  { id: "casillas", nombre: "Casillas" },
  { id: "relleno", nombre: "Se llena" },
  { id: "anillos", nombre: "Un aro" },
  { id: "porciones", nombre: "Porciones" },
  { id: "barra", nombre: "Una barra" },
  { id: "cifra", nombre: "La cifra" },
];

/** La casilla de cada punto: solo cuenta con casillas. */
export const FORMAS = [
  { id: "circulo", nombre: "Círculo" },
  { id: "redondeado", nombre: "Redondeada" },
  { id: "cuadrado", nombre: "Cuadrada" },
  { id: "hexagono", nombre: "Hexágono" },
  { id: "rombo", nombre: "Rombo" },
];

/** El fondo de la banda. «Liso» es la banda «clara» de dibujo.js. */
export const FONDOS = [
  { id: "liso", nombre: "Liso" },
  { id: "degradado", nombre: "Degradado" },
  { id: "rayas", nombre: "Rayas" },
];

export const PREMIOS = ["café gratis", "cookie gratis", "croissant gratis", "tostada gratis", "matcha gratis"];
export const METAS = [6, 8, 10];

export const NOMBRE_POR_DEFECTO = CAFETERIA.nombre;
export const MAX_NOMBRE = 24;

/**
 * Las partes de la tarjeta, en el orden en que se recorren. `parte` es lo que la
 * cámara encuadra (el `data-parte` de CaraDelPase); `todo` es la tarjeta entera.
 */
export const SECCIONES = [
  { id: "color", nombre: "Color", parte: "todo", pista: "Desliza para probar colores" },
  { id: "nombre", nombre: "Nombre", parte: "cabecera", pista: "Así sale arriba, junto al icono" },
  { id: "icono", nombre: "Icono", parte: "cabecera banda", pista: "Va en el logo y dentro de cada punto" },
  { id: "puntos", nombre: "Puntos", parte: "banda", pista: "Cómo ve el cliente lo que lleva" },
  { id: "premio", nombre: "Premio", parte: "campos", pista: "Lo que se lleva al completarla" },
];

export const INICIAL = {
  paleta: "crema",
  nombre: "",
  icono: "taza",
  modo: "casillas",
  forma: "circulo",
  fondo: "liso",
  premio: "café gratis",
  meta: 8,
  puntos: 5,
};

const de = (lista, id) => lista.find((x) => (x.id ?? x) === id) || lista[0];

/** Lo elegido, sin nada que no esté en las listas (llega del estado del navegador). */
export function limpiar(e = {}) {
  const metas = METAS.includes(e.meta) ? e.meta : INICIAL.meta;
  return {
    paleta: de(PALETAS, e.paleta).id,
    nombre: typeof e.nombre === "string" ? e.nombre.slice(0, MAX_NOMBRE) : "",
    icono: de(ICONOS, e.icono).id,
    modo: de(MODOS, e.modo).id,
    forma: de(FORMAS, e.forma).id,
    fondo: de(FONDOS, e.fondo).id,
    premio: PREMIOS.includes(e.premio) ? e.premio : INICIAL.premio,
    meta: metas,
    puntos: Number.isInteger(e.puntos) ? Math.max(0, Math.min(metas, e.puntos)) : Math.min(INICIAL.puntos, metas),
  };
}

/** El tema del pase que sale de lo elegido. */
export function temaDe(eleccion) {
  const e = limpiar(eleccion);
  const { cardBg, ink, accent, detalle } = de(PALETAS, e.paleta);
  return {
    estilo: "coffee",
    cardBg, ink, accent, ...(detalle ? { detalle } : {}),
    marca: e.icono,
    modo: e.modo,
    forma: e.forma,
    banda: e.fondo === "liso" ? "clara" : e.fondo,
  };
}

/** Tienda + cliente de ejemplo, como los ve el navegador (para CaraDelPase). */
export function tarjetaDe(eleccion) {
  const e = limpiar(eleccion);
  const nombre = e.nombre.trim() || NOMBRE_POR_DEFECTO;
  return ejemplo({ ...CAFETERIA, slug: "tu-tarjeta", nombre, premio: e.premio, tema: temaDe(e) }, e.puntos, { meta: e.meta });
}

/** El siguiente punto de «Sumar punto»: al completarla, vuelve a empezar. */
export const sumarPunto = (puntos, meta) => (puntos >= meta ? 0 : puntos + 1);

/** Lo que se nos escribe por WhatsApp desde «La quiero así»: lo elegido, dicho en palabras. */
export function mensajeDe(eleccion) {
  const e = limpiar(eleccion);
  const nombre = e.nombre.trim();
  const partes = [
    `colores ${de(PALETAS, e.paleta).nombre}`,
    `icono ${de(ICONOS, e.icono).nombre.toLowerCase()}`,
    `puntos: ${de(MODOS, e.modo).nombre.toLowerCase()}${e.modo === "casillas" ? ` (${de(FORMAS, e.forma).nombre.toLowerCase()})` : ""}`,
    `${e.premio} cada ${e.meta} puntos`,
  ];
  return `Hola, he diseñado mi tarjeta en vuestra web${nombre ? ` para ${nombre}` : ""}: ${partes.join(", ")}. ¿Me contáis cómo empezar?`;
}

// ----------------------------------------------------------------------------
// LA CÁMARA: cuánto se acerca y cuánto se mueve la tarjeta para encuadrar una parte
// ----------------------------------------------------------------------------

export const ZOOM_MAX = 1.75;
/** La tarjeta entera, como mucho así de grande: en una pantalla ancha, que tenga presencia. */
export const ENTERA_MAX = 1.25;

/**
 * El encuadre de una parte: escala y desplazamiento vertical (px de pantalla) de
 * la tarjeta para que esa parte quede en el centro de la escena y se lea bien.
 * Con `region` null, la tarjeta entera cabe con aire alrededor.
 * @param {{top:number, height:number} | null} region  en px de la tarjeta, sin escalar
 * @param {{w:number, h:number}} tarjeta
 * @param {{w:number, h:number}} escena
 */
export function encuadre(region, tarjeta, escena) {
  if (!tarjeta.w || !tarjeta.h || !escena.w || !escena.h) return { s: 1, y: 0 };
  const entera = Math.min(ENTERA_MAX, (escena.h * 0.8) / tarjeta.h, (escena.w * 0.88) / tarjeta.w);
  if (!region || !region.height) return { s: redondo(entera), y: 0 };
  // De ancho la parte ocupa toda la tarjeta: que no se salga por los lados.
  const s = Math.max(entera, Math.min(ZOOM_MAX, (escena.w * 0.9) / tarjeta.w, (escena.h * 0.6) / region.height));
  const y = -(region.top + region.height / 2 - tarjeta.h / 2) * s;
  return { s: redondo(s), y: redondo(y) };
}

const redondo = (x) => Math.round(x * 1000) / 1000;

/** La región que cubre varias partes (`"cabecera banda"`), o null si es `todo` o no están. */
export function regionDe(parte, medidas) {
  if (parte === "todo") return null;
  const trozos = parte.split(" ").map((p) => medidas[p]).filter(Boolean);
  if (!trozos.length) return null;
  const top = Math.min(...trozos.map((t) => t.top));
  const fin = Math.max(...trozos.map((t) => t.top + t.height));
  return { top, height: fin - top };
}
