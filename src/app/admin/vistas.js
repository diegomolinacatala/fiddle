"use client";

import { svgLogo, svgStripSellos, svgCasilla, comoDataUri } from "@/lib/apple/dibujo";
import { temaPorDefecto } from "@/lib/negocios";

// ============================================================================
// MINIATURAS DEL SELECTOR
// ----------------------------------------------------------------------------
// Cada opción del admin se enseña DIBUJADA, no por su nombre: la miniatura de
// "hexágono" es un hexágono de verdad, hecho con la misma función que pinta el
// pase. Así no hay que imaginarse nada, y una marca nueva en dibujo.js aparece
// aquí sola.
// ============================================================================

const svg = (w, h, cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cuerpo}</svg>`;

/** La marca, tal cual va en el logo del pase. */
export const vistaMarca = (tema, marca) => svgLogo({ ...tema, marca });

/** La casilla: dos llenas y una por llenar, como en la banda. */
export const vistaForma = (tema, forma) => {
  const [w, h] = [168, 72];
  const celdas = [0, 1, 2].map((i) => {
    const cx = 36 + i * 48;
    return i < 2
      ? svgCasilla(forma, cx, h / 2, 40, `fill="${tema.accent}"`)
      : svgCasilla(forma, cx, h / 2, 34, `fill="none" stroke="${tema.accent}" stroke-opacity="0.5" stroke-width="4" stroke-dasharray="8 6"`);
  });
  return svg(w, h, celdas.join(""));
};

/** El fondo de la banda, con una cartilla corta encima. */
export const vistaBanda = (tema, banda) => svgStripSellos({ ...tema, banda, modo: "casillas" }, 4, 2);

/** Casillas o relleno, con la cartilla de esta tienda a medias. */
export const vistaModo = (tema, modo, meta = 6) =>
  svgStripSellos({ ...tema, modo }, meta, Math.max(1, Math.round(meta * 0.6)));

/** La plantilla entera: sus colores, su marca y sus casillas de una tacada. */
export const vistaPlantilla = (estilo) => {
  const tema = temaPorDefecto({ estilo, texto: "AB" });
  return svgStripSellos(tema, 5, 3);
};

export { comoDataUri };

// Los valores se guardan en inglés/técnico; en pantalla se leen en claro.
export const ROTULO = {
  // marcas
  taza: "Taza", vaso: "Vaso para llevar", grano: "Grano de café",
  tijeras: "Tijeras", peine: "Peine", poste: "Poste de barbero",
  pizza: "Porción de pizza", burger: "Hamburguesa", croissant: "Croissant", helado: "Helado",
  copa: "Copa", jarra: "Jarra de cerveza",
  corazon: "Corazón", estrella: "Estrella", huella: "Huella", pesa: "Pesa", flor: "Flor", libro: "Libro",
  texto: "Letras o números",
  // formas
  circulo: "Círculo", redondeado: "Cuadrado con esquinas", cuadrado: "Cuadrado",
  rombo: "Rombo", hexagono: "Hexágono",
  // bandas
  clara: "Clara", oscura: "Oscura", blanca: "Blanca", degradado: "Degradado", rayas: "Rayas",
  // modos
  casillas: "Una casilla por sello", relleno: "Se va llenando",
};

/** Las plantillas se leen distinto que las marcas ("taza" vs "Cafetería"). */
export const ROTULO_PLANTILLA = {
  coffee: "Cafetería", barber: "Barbería", pizza: "Pizzería", moderno: "Neutra (moderna)",
  iced: "Vaso que se llena", panaderia: "Panadería", bar: "Bar", mascotas: "Mascotas",
  gym: "Gimnasio", belleza: "Belleza",
};
