import { ejemplo, CAFETERIA } from "../demo";

// ============================================================================
// LO QUE SE PUEDE ELEGIR EN «DISEÑA TU TARJETA» (/home/tarjeta)
// ----------------------------------------------------------------------------
// Un probador para quien aún no es cliente: pocas opciones y todas buenas, y cada
// paso se contesta de un toque. No es el editor del manager (ahí está todo).
//
// La tarjeta se arma con `ejemplo()` de demo.js, que compone una tienda como una
// de verdad y la pinta con las funciones del pase: lo que se ve aquí es lo que
// saldría en el Wallet, no una maqueta. Puro y sin nada del servidor: lo usa el
// navegador en cada cambio y el servidor al guardar lo elegido.
// ============================================================================

/**
 * Las paletas, en el orden en que se deslizan: por tono, para que el rectángulo
 * se lea seguido. Colores con fuerza. Las reglas de demo.js valen aquí: `accent`
 * nunca es claro (pinta botones con texto blanco) y lo que destaca sobre la tarjeta
 * va en `detalle`. El nombre no sale en pantalla: es para el lector de pantalla.
 */
export const PALETAS = [
  { id: "verde", nombre: "Verde", cardBg: "#4c7d4f", ink: "#ffffff", accent: "#35603a", detalle: "#ffffff" },
  { id: "botella", nombre: "Botella", cardBg: "#17594a", ink: "#ffffff", accent: "#0f4538", detalle: "#ffffff" },
  { id: "esmeralda", nombre: "Esmeralda", cardBg: "#0b7d63", ink: "#ffffff", accent: "#07604c", detalle: "#ffffff" },
  { id: "petroleo", nombre: "Petróleo", cardBg: "#0e6a82", ink: "#ffffff", accent: "#0a5165", detalle: "#ffffff" },
  { id: "azul", nombre: "Azul", cardBg: "#1f5fc4", ink: "#ffffff", accent: "#174a9b", detalle: "#ffffff" },
  { id: "marino", nombre: "Marino", cardBg: "#1b2c66", ink: "#ffffff", accent: "#3350ad", detalle: "#ffffff" },
  { id: "violeta", nombre: "Violeta", cardBg: "#5a3fc4", ink: "#ffffff", accent: "#46309c", detalle: "#ffffff" },
  { id: "berenjena", nombre: "Berenjena", cardBg: "#5c2474", ink: "#ffffff", accent: "#7f3a9c", detalle: "#ffffff" },
  { id: "fucsia", nombre: "Fucsia", cardBg: "#c2246f", ink: "#ffffff", accent: "#991a57", detalle: "#ffffff" },
  { id: "rojo", nombre: "Rojo", cardBg: "#c4293a", ink: "#ffffff", accent: "#9b1f2d", detalle: "#ffffff" },
  { id: "teja", nombre: "Teja", cardBg: "#b8451f", ink: "#ffffff", accent: "#8c3415", detalle: "#ffffff" },
  { id: "naranja", nombre: "Naranja", cardBg: "#f28a1e", ink: "#2b1500", accent: "#a85a08", detalle: "#2b1500" },
  { id: "mostaza", nombre: "Mostaza", cardBg: "#f4bb19", ink: "#2e2200", accent: "#94690a", detalle: "#2e2200" },
  { id: "oliva", nombre: "Oliva", cardBg: "#68761d", ink: "#ffffff", accent: "#4d5814", detalle: "#ffffff" },
  { id: "cacao", nombre: "Cacao", cardBg: "#4f2e1c", ink: "#ffffff", accent: "#7a4a2d", detalle: "#ffffff" },
  { id: "carbon", nombre: "Carbón", cardBg: "#1d1c21", ink: "#ffffff", accent: "#55525e", detalle: "#ffffff" },
  { id: "crema", nombre: "Crema", cardBg: "#f6ece0", ink: "#3a2318", accent: "#b04a26" },
];

/**
 * Las marcas que salen: las de una cafetería. El premio va con el icono: quien
 * elige una cookie regala una cookie. `cartilla` es el nombre con dos cartillas.
 * El croissant no: en pequeño parece un arco.
 */
export const ICONOS = [
  { id: "taza", nombre: "Taza", premio: "café gratis", cartilla: "Cafés" },
  { id: "grano", nombre: "Grano", premio: "café gratis", cartilla: "Cafés" },
  { id: "vaso", nombre: "Vaso", premio: "bebida gratis", cartilla: "Bebidas" },
  { id: "jarra", nombre: "Jarra", premio: "caña gratis", cartilla: "Cañas" },
  { id: "galleta", nombre: "Cookie", premio: "cookie gratis", cartilla: "Cookies" },
  { id: "helado", nombre: "Helado", premio: "helado gratis", cartilla: "Helados" },
  { id: "corazon", nombre: "Corazón", premio: "regalo gratis", cartilla: "Regalos" },
  { id: "estrella", nombre: "Estrella", premio: "regalo gratis", cartilla: "Regalos" },
];

/** Cómo se cuentan los puntos con un premio (MODOS de dibujo.js, sin la pizza: es de pizzería). */
export const MODOS = [
  { id: "relleno", nombre: "Se llena" },
  { id: "casillas", nombre: "Casillas" },
  { id: "anillos", nombre: "Un aro" },
  { id: "porciones", nombre: "Porciones" },
  { id: "barra", nombre: "Una barra" },
  { id: "cifra", nombre: "La cifra" },
];

/** Con dos premios: los que caben dos veces en la banda, y cómo se colocan. */
export const MODOS_DOS = [
  { id: "relleno", nombre: "Se llenan", doble: "lados" },
  { id: "casillas", nombre: "Casillas", doble: "filas" },
  { id: "anillos", nombre: "Dos aros", doble: "lados" },
  { id: "barra", nombre: "Dos barras", doble: "filas" },
];

/** El fondo de la banda. «Liso» es la banda «clara» de dibujo.js. */
export const FONDOS = [
  { id: "liso", nombre: "Liso" },
  { id: "degradado", nombre: "Degradado" },
  { id: "rayas", nombre: "Rayas" },
];

/** Cómo se escribe la cuenta ("5/8"), en las bandas que la llevan. */
export const NUMEROS = [
  { id: "gruesas", nombre: "Gruesos" },
  { id: "normales", nombre: "Normales" },
  { id: "cuadradas", nombre: "Cuadrados" },
];

// El resto de la cartilla no se elige: lo decide la tienda cuando empiece de verdad.
const META = 8;
const PUNTOS = 5;
const PUNTOS_2 = 3;

export const NOMBRE_POR_DEFECTO = CAFETERIA.nombre;
export const MAX_NOMBRE = 24;

/**
 * Los pasos, en orden. `parte` es lo que la cámara encuadra (el `data-parte` de
 * CaraDelPase); `todo` es la tarjeta entera. Elegir avanza solo; `boton` son los
 * dos que no se contestan de un toque (deslizar colores, escribir el nombre).
 */
export const SECCIONES = [
  { id: "cuantas", nombre: "Premios", titulo: "¿Uno o dos premios?", parte: "todo", pista: "Toca el que quieras" },
  { id: "puntos", nombre: "Puntos", titulo: "Los puntos", parte: "banda", pista: "Cómo ve el cliente lo que lleva" },
  { id: "color", nombre: "Color", titulo: "El color", parte: "todo", pista: "Desliza para probar", boton: true },
  { id: "icono", nombre: "Icono", titulo: "El icono", parte: "cabecera banda", pista: "Y con él, el premio que das" },
  { id: "nombre", nombre: "Nombre", titulo: "Tu cafetería", parte: "cabecera", pista: "Así sale arriba, junto al icono", boton: true },
  { id: "guardar", nombre: "Guardar", titulo: "Guárdala", parte: "todo", pista: "Déjanos un email o un teléfono y hablamos" },
];

export const INICIAL = {
  cartillas: 1,
  paleta: "verde",
  nombre: "",
  icono: "taza",
  icono2: "galleta",
  modo: "relleno",
  fondo: "liso",
  cifras: "gruesas",
};

const de = (lista, id) => lista.find((x) => x.id === id) || lista[0];

/** Lo elegido, sin nada que no esté en las listas (llega del navegador). */
export function limpiar(e = {}) {
  const cartillas = e.cartillas === 2 ? 2 : 1;
  const icono = de(ICONOS, e.icono).id;
  const pedido = ICONOS.some((i) => i.id === e.icono2) ? e.icono2 : INICIAL.icono2;
  // Dos cartillas iguales no se distinguirían.
  const icono2 = pedido !== icono ? pedido : icono === "galleta" ? "taza" : "galleta";
  const modos = cartillas === 2 ? MODOS_DOS : MODOS;
  return {
    cartillas,
    paleta: de(PALETAS, e.paleta).id,
    nombre: typeof e.nombre === "string" ? e.nombre.slice(0, MAX_NOMBRE) : "",
    icono,
    icono2,
    modo: modos.some((m) => m.id === e.modo) ? e.modo : INICIAL.modo,
    fondo: de(FONDOS, e.fondo).id,
    cifras: de(NUMEROS, e.cifras).id,
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
    forma: "circulo",
    banda: e.fondo === "liso" ? "clara" : e.fondo,
    cifras: e.cifras,
    ...(e.cartillas === 2 ? { doble: de(MODOS_DOS, e.modo).doble } : {}),
  };
}

function cartillasDe(e) {
  const hacer = (id) => {
    const { premio, cartilla } = de(ICONOS, id);
    return { nombre: cartilla, marca: id, modo: e.modo, forma: "circulo", meta: META, premio };
  };
  // Lado a lado, la taza siempre a la derecha: a la izquierda su asa pisa la cifra.
  const iconos = de(MODOS_DOS, e.modo).doble === "lados" && e.icono === "taza" ? [e.icono2, e.icono] : [e.icono, e.icono2];
  return iconos.map(hacer);
}

/** Tienda + cliente de ejemplo, como los ve el navegador (para CaraDelPase). */
export function tarjetaDe(eleccion) {
  const e = limpiar(eleccion);
  const nombre = e.nombre.trim() || NOMBRE_POR_DEFECTO;
  const cartillas = e.cartillas === 2 ? cartillasDe(e) : null;
  const premio = cartillas ? cartillas[0].premio : de(ICONOS, e.icono).premio;
  const tienda = { ...CAFETERIA, slug: "tu-tarjeta", nombre, premio, tema: temaDe(e), ...(cartillas ? { cartillas } : {}) };
  return ejemplo(tienda, PUNTOS, { meta: META, sellos2: cartillas ? PUNTOS_2 : 0 });
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
