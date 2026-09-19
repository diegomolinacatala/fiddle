// ============================================================================
// APPLE WALLET — dibujo del pase (SVG puro)
// ----------------------------------------------------------------------------
// Aquí vive el ASPECTO del pase: la marca del negocio, el logo y la banda
// (strip) con los sellos. Solo genera texto SVG: no toca sharp ni el disco, así
// que lo puede usar tanto el generador del .pkpass (`imagenes.js`, que lo
// rasteriza en el servidor) como la vista previa del manager, que lo pinta tal
// cual en el navegador.
//
// Esa es la gracia de tenerlo separado: lo que el manager ve y lo que acaba
// dentro del .pkpass salen del MISMO dibujo, no de dos maquetas parecidas.
//
// PIEZAS SUELTAS, NO PLANTILLAS CERRADAS
// El aspecto no sale de un "estilo" monolítico, sino de tres mandos que se
// combinan como se quiera. Cada tienda mezcla los suyos:
//
//   tema.marca   qué se dibuja    coffee · barber · pizza · texto
//   tema.texto   si marca=texto, qué letras/números ("68", "NC"…)
//   tema.forma   la casilla del sello   circulo · redondeado · cuadrado
//   tema.banda   el fondo de la banda   clara · oscura
//
// Así una cafetería con casillas cuadradas y un "68" de logo no necesita código
// nuevo: son cuatro valores distintos sobre las mismas piezas.
//
// Sin <text> en los SVG: en serverless no hay fuentes fiables, las letras se
// dibujan (glifos.js).
// ============================================================================

import { svgTextoCuadrado } from "./glifos";

export const TAM = {
  icon: 29, // + @2x 58, @3x 87 (obligatorio)
  logo: 50, // cuadrado; Apple permite hasta 160x50
  strip: { storeCard: [375, 123], coupon: [375, 144] },
};

/** Marcas que se saben dibujar. `texto` usa `tema.texto`. */
export const MARCAS = ["coffee", "barber", "pizza", "texto"];
/** Formas de la casilla de un sello. */
export const FORMAS = ["circulo", "redondeado", "cuadrado"];
/** Fondos de la banda. */
export const BANDAS = ["clara", "oscura"];

// ------------------------------- marcas -------------------------------
// Marcas vectoriales en un lienzo de 512x512 (mismas que los iconos PWA).
const DIBUJOS = {
  coffee: (c) => `
    <g stroke="${c}" stroke-width="20" fill="none" stroke-linecap="round">
      <path d="M212 150 q-16 -24 0 -48"/><path d="M256 150 q-16 -24 0 -48"/><path d="M300 150 q-16 -24 0 -48"/>
    </g>
    <path d="M152 200 h184 v84 a92 92 0 0 1 -184 0 z" fill="${c}"/>
    <path d="M336 216 h22 a46 46 0 0 1 0 92 h-22" fill="none" stroke="${c}" stroke-width="24"/>
    <rect x="132" y="356" width="248" height="20" rx="10" fill="${c}"/>`,
  barber: (c) => `
    <g stroke="${c}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="176" cy="346" r="40"/><circle cx="336" cy="346" r="40"/>
      <path d="M205 322 L372 150"/><path d="M307 322 L140 150"/>
    </g>
    <circle cx="256" cy="252" r="11" fill="${c}"/>`,
  pizza: (c) => `
    <path d="M256 118 L398 384 Q256 436 114 384 Z" fill="#ffd54a"/>
    <path d="M114 384 Q256 436 398 384" fill="none" stroke="#e8a44a" stroke-width="22" stroke-linecap="round"/>
    <path d="M256 118 L398 384 Q256 436 114 384 Z" fill="none" stroke="${c}" stroke-width="12"/>
    <circle cx="228" cy="300" r="19" fill="#c1121f"/><circle cx="300" cy="256" r="16" fill="#c1121f"/><circle cx="272" cy="362" r="15" fill="#c1121f"/>`,
  texto: (c, texto) => svgTextoCuadrado(texto, { cx: 256, cy: 256, alto: 300, color: c }),
};

/** Qué marca toca y con qué texto, con los valores viejos aún válidos. */
function marcaDe(tema = {}) {
  const nombre = MARCAS.includes(tema.marca) ? tema.marca : (MARCAS.includes(tema.estilo) ? tema.estilo : "coffee");
  return { nombre, texto: tema.texto || "" };
}

const forma = (tema = {}) => (FORMAS.includes(tema.forma) ? tema.forma : "circulo");
const esOscura = (tema = {}) => (BANDAS.includes(tema.banda) ? tema.banda === "oscura" : tema.estilo === "barber");

/**
 * Coloca la marca del tema, centrada en (cx, cy) y con lado `lado`.
 * @returns {string} puede ser "" (p. ej. un texto que no se sabe dibujar)
 */
function colocar(tema, color, cx, cy, lado) {
  const { nombre, texto } = marcaDe(tema);
  const cuerpo = (DIBUJOS[nombre] || DIBUJOS.coffee)(color, texto);
  if (!cuerpo) return "";
  return `<g transform="translate(${cx - lado / 2} ${cy - lado / 2}) scale(${lado / 512})">${cuerpo}</g>`;
}

const svg = (w, h, cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cuerpo}</svg>`;

// ---------------------------- icono y logo ----------------------------
export function svgIcono(tema) {
  const lado = TAM.icon * 3;
  const oscura = esOscura(tema);
  const fondo = oscura ? "#17171c" : tema.accent;
  const trazo = oscura ? tema.accent : "#ffffff";
  const radio = forma(tema) === "cuadrado" ? 0 : lado * 0.22;
  return svg(lado, lado, `<rect width="${lado}" height="${lado}" rx="${radio}" fill="${fondo}"/>${colocar(tema, trazo, lado / 2, lado / 2, lado * 0.9)}`);
}

export function svgLogo(tema) {
  const lado = TAM.logo * 3;
  return svg(lado, lado, colocar(tema, tema.accent, lado / 2, lado / 2, lado));
}

// ------------------------------- strip -------------------------------
/** Posiciones de `n` sellos repartidos en filas dentro de w x h. Pura (testeada). */
export function rejillaSellos(n, w, h, margen) {
  const filas = n <= 7 ? 1 : n <= 16 ? 2 : 3;
  const columnas = Math.ceil(n / filas);
  const celdaW = (w - margen * 2) / columnas;
  const celdaH = (h - margen * 2) / filas;
  const diametro = Math.min(celdaW, celdaH) * 0.8;
  return Array.from({ length: n }, (_, i) => ({
    cx: margen + celdaW * ((i % columnas) + 0.5),
    cy: margen + celdaH * (Math.floor(i / columnas) + 0.5),
    d: diametro,
  }));
}

/**
 * La casilla de un sello: un círculo, un cuadrado o un cuadrado con las
 * esquinas suavizadas, del mismo tamaño y con los atributos que se le pasen.
 */
export function svgCasilla(nombre, cx, cy, lado, atributos) {
  const r = lado / 2;
  if (nombre === "circulo") return `<circle cx="${cx}" cy="${cy}" r="${r}" ${atributos}/>`;
  const rx = nombre === "cuadrado" ? 0 : lado * 0.22;
  return `<rect x="${cx - r}" y="${cy - r}" width="${lado}" height="${lado}" rx="${rx}" ${atributos}/>`;
}

export function svgStripSellos(tema, meta, sellos) {
  const [w, h] = TAM.strip.storeCard.map((v) => v * 3);
  const oscura = esOscura(tema);
  const casilla = forma(tema);
  // Con una marca de varias letras dentro, los sellos se emborronan: se dejan llenos a secas.
  const { nombre, texto } = marcaDe(tema);
  const conMarca = nombre !== "texto" || texto.length === 1;

  const fondo = oscura
    ? `<rect width="${w}" height="${h}" fill="#101013"/><rect width="18" height="${h}" fill="url(#poste)"/>`
    : `<rect width="${w}" height="${h}" fill="${tema.accent}" opacity="0.10"/>`;
  const defs = `<defs><pattern id="poste" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="36" fill="${tema.accent}"/></pattern></defs>`;

  const puntos = rejillaSellos(meta, w, h, 36).map(({ cx, cy, d }, i) => {
    const lleno = i < sellos;
    if (oscura) {
      return lleno
        ? svgCasilla(casilla, cx, cy, d, `fill="${tema.accent}" fill-opacity="0.18" stroke="${tema.accent}" stroke-width="4"`)
          + (conMarca ? colocar(tema, tema.accent, cx, cy, d * 0.8) : "")
        : svgCasilla(casilla, cx, cy, d, `fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="3"`);
    }
    return lleno
      ? svgCasilla(casilla, cx, cy, d, `fill="${tema.accent}"`)
        + (conMarca ? colocar(tema, "#ffffff", cx, cy, d * 0.78) : "")
      : svgCasilla(casilla, cx, cy, d - 6, `fill="none" stroke="${tema.accent}" stroke-opacity="0.45" stroke-width="5" stroke-dasharray="14 10"`);
  });

  return svg(w, h, defs + fondo + puntos.join(""));
}

export function svgStripCupon(tema, usado) {
  const [w, h] = TAM.strip.coupon.map((v) => v * 3);
  // Marcas solo a la derecha: a la izquierda Apple pinta el texto del descuento.
  const adornos = [0, 1, 2]
    .map((i) => colocar(tema, "#ffffff", 700 + i * 170, h / 2 + (i % 2 ? 50 : -50), 240))
    .join("");
  return svg(w, h, `
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd54a"/><stop offset="0.55" stop-color="#ff7a18"/><stop offset="1" stop-color="${tema.accent}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <g opacity="${usado ? 0.35 : 1}">${adornos}</g>`);
}

/** La banda que le toca a este cliente, con su tamaño en puntos. */
export function stripDelPase(negocio, cliente) {
  const esCupon = negocio.tipo === "descuento";
  const [ancho, alto] = esCupon ? TAM.strip.coupon : TAM.strip.storeCard;
  const svgTexto = esCupon
    ? svgStripCupon(negocio.tema, (cliente.premios || 0) > 0)
    : svgStripSellos(negocio.tema, negocio.meta, Math.min(cliente.sellos ?? 0, negocio.meta));
  return { svg: svgTexto, ancho, alto };
}

/** SVG -> data URI, para pintarlo en un <img>. */
export const comoDataUri = (svgTexto) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svgTexto)}`;
