"use client";

import { svgLogo, svgStripSellos, svgCasilla, comoDataUri, modosDeFamilia, stripDelPase, temaDelPase, svgBandaOpaca } from "@/lib/apple/dibujo";
import { ROTULOS_DE_KITS } from "@/lib/kits";
import { temaPorDefecto } from "@/lib/negocios";

// ============================================================================
// MINIATURAS DEL SELECTOR
// ----------------------------------------------------------------------------
// Cada opción del admin se enseña DIBUJADA, no por su nombre: la miniatura de
// "hexágono" es un hexágono de verdad, hecho con la misma función que pinta el
// pase. Así no hay que imaginarse nada, y una marca nueva en dibujo.js aparece
// aquí sola. Y sobre el fondo de la tarjeta: un logo blanco para la tarjeta
// verde no se vería sobre el gris del panel.
// ============================================================================

const svg = (w, h, cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cuerpo}</svg>`;

/** La miniatura sobre el fondo de la tarjeta, como se verá en el teléfono. */
const sobreTarjeta = (tema, dibujo) => svgBandaOpaca(dibujo, tema.cardBg);

/** La marca, tal cual va en el logo del pase. */
export const vistaMarca = (tema, marca) => sobreTarjeta(tema, svgLogo(temaDelPase({ ...tema, marca })));

/** La casilla: dos llenas y una por llenar, como en la banda. */
export const vistaForma = (temaGuardado, forma) => {
  const tema = temaDelPase(temaGuardado);
  const [w, h] = [168, 72];
  const celdas = [0, 1, 2].map((i) => {
    const cx = 36 + i * 48;
    return i < 2
      ? svgCasilla(forma, cx, h / 2, 40, `fill="${tema.accent}"`)
      : svgCasilla(forma, cx, h / 2, 34, `fill="none" stroke="${tema.accent}" stroke-opacity="0.5" stroke-width="4" stroke-dasharray="8 6"`);
  });
  return sobreTarjeta(tema, svg(w, h, celdas.join("")));
};

/** El fondo de la banda, con una cartilla corta encima. */
export const vistaBanda = (tema, banda) => sobreTarjeta(tema, svgStripSellos({ ...tema, banda, modo: "casillas" }, 4, 2));

/** Un modo suelto, con la cartilla de esta tienda a medias. */
export const vistaModo = (tema, modo, meta = 6) =>
  sobreTarjeta(tema, svgStripSellos({ ...tema, modo }, meta, Math.max(1, Math.round(meta * 0.6))));

/**
 * Una FAMILIA se enseña con su primera variante, que es la que mejor la
 * representa: "se cierra" sale como un aro y "un camino" como una senda.
 */
export const vistaFamilia = (tema, familia, meta = 6) => vistaModo(tema, modosDeFamilia(familia)[0], meta);

/**
 * Dos cartillas en la banda de verdad (stripDelPase): la primera más avanzada
 * que la segunda, para que se vea que cada una lleva su cuenta.
 */
export const vistaDoble = (tema, doble, cartillas) => sobreTarjeta(tema, stripDelPase(
  { tipo: "sellos", tema: { ...tema, doble }, meta: cartillas[0].meta, cartillas },
  { sellos: Math.round(cartillas[0].meta * 0.6), sellos2: Math.round(cartillas[1].meta * 0.3) },
).svg);

/** La plantilla entera: sus colores, su marca y sus casillas de una tacada. */
export const vistaPlantilla = (estilo) => {
  const tema = temaPorDefecto({ estilo, texto: "AB" });
  return sobreTarjeta(tema, svgStripSellos(tema, 5, 3));
};

export { comoDataUri };

// Los valores se guardan en inglés/técnico; en pantalla se leen en claro.
export const ROTULO = {
  // marcas
  taza: "Taza", vaso: "Vaso para llevar", grano: "Grano de café",
  tijeras: "Tijeras", peine: "Peine", poste: "Poste de barbero",
  pizza: "Porción de pizza", burger: "Hamburguesa", croissant: "Croissant", galleta: "Galleta", helado: "Helado",
  copa: "Copa", jarra: "Jarra de cerveza",
  corazon: "Corazón", estrella: "Estrella", huella: "Huella", pesa: "Pesa", flor: "Flor", libro: "Libro",
  bote: "Bote de proteína", shaker: "Shaker", manzana: "Manzana", rayo: "Rayo",
  texto: "Letras o números",
  // las de los kits de marca (lib/kits.js) y sus diseños
  ...ROTULOS_DE_KITS,
  // formas
  circulo: "Círculo", redondeado: "Cuadrado con esquinas", cuadrado: "Cuadrado",
  rombo: "Rombo", hexagono: "Hexágono",
  // bandas
  clara: "Clara", oscura: "Oscura", blanca: "Blanca", degradado: "Degradado", rayas: "Rayas",
};

/**
 * Los modos van APARTE del resto: `pizza` es una marca (la porción suelta) y
 * también un modo (la pizza entera), y en un mapa plano uno pisaría al otro.
 */
/** Las familias: la idea, en dos palabras. */
export const ROTULO_FAMILIA = {
  casillas: "Casillas",
  llenar: "Se llena",
  cerrar: "Se cierra",
  fila: "En fila",
  ruta: "Un camino",
  crecer: "Crece",
  marcador: "Marcador",
};

export const ROTULO_DOBLE = {
  filas: "Una encima de otra",
  lados: "Una al lado de otra",
};

export const ROTULO_MODO = {
  casillas: "Una casilla por sello", relleno: "Se va llenando",
  porciones: "Porciones de una tarta", pizza: "Pizza de verdad", barra: "Barra de progreso",
  pesas: "Discos en la barra", anillos: "Aro que se cierra",
  camino: "Camino con paradas", torre: "Torre que se apila", planta: "Planta que crece",
  luna: "Fases de la luna", aguja: "Marcador con aguja", constelacion: "Constelación",
  escalera: "Escalones que suben", mosaico: "Mosaico que se destapa", pulso: "Línea de pulso",
  cifra: "Solo la cifra, enorme",
};

/** Las plantillas se leen distinto que las marcas ("taza" vs "Cafetería"). */
export const ROTULO_PLANTILLA = {
  coffee: "Cafetería", barber: "Barbería", pizza: "Pizzería", moderno: "Neutra (moderna)",
  iced: "Vaso que se llena", panaderia: "Panadería", bar: "Bar", mascotas: "Mascotas",
  gym: "Gimnasio", belleza: "Belleza",
  nutricion: "Nutrición / suplementos", pizzeria: "Pizzería (porciones)", galletas: "Galletas / cookies", heladeria: "Heladería",
  estudio: "Estudio (yoga/pilates)", club: "Club de socios",
  floristeria: "Floristería", nocturno: "Bar de noche", taller: "Taller / lavadero",
  academia: "Academia", clinica: "Clínica / fisio",
  ...ROTULOS_DE_KITS,
};
