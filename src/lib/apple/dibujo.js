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
// El aspecto no sale de un "estilo" monolítico, sino de cinco mandos que se
// combinan como se quiera. Cada tienda mezcla los suyos:
//
//   tema.marca   qué se dibuja           taza · vaso · tijeras · pizza · texto…
//   tema.texto   si marca=texto, qué letras/números ("68", "NC")
//   tema.forma   la casilla del sello    circulo · cuadrado · rombo · hexagono…
//   tema.banda   el fondo de la banda    clara · oscura · blanca · degradado…
//   tema.modo    casillas (una por sello) o relleno (se llena la marca entera)
//
// Así una cafetería con casillas cuadradas y un "68" de logo no necesita código
// nuevo: son cinco valores distintos sobre las mismas piezas.
//
// AÑADIR UNA MARCA son tres líneas: una entrada en DIBUJOS con su SVG y su
// nombre en la lista. Sale sola en el logo, en el icono, dentro de los sellos,
// en el modo relleno y en el selector del admin.
//
// Sin <text> en los SVG: en serverless no hay fuentes fiables, las letras se
// dibujan (glifos.js).
// ============================================================================

import { svgTextoCuadrado, anchoDeTexto, ALTO as ALTO_GLIFO, GROSOR } from "./glifos";

export const TAM = {
  icon: 29, // + @2x 58, @3x 87 (obligatorio)
  logo: 50, // cuadrado; Apple permite hasta 160x50
  strip: { storeCard: [375, 123], coupon: [375, 144] },
};

// ------------------------------- marcas -------------------------------
// Dibujos vectoriales en un lienzo de 512x512 (los mismos que los iconos PWA).
// Todos usan UN SOLO color (el que se les pasa), menos `pizza`, que es de
// siempre y va a todo color: así cualquier marca vale sobre cualquier fondo,
// en blanco dentro de un sello o en el color de la tienda sobre la banda.
const DIBUJOS = {
  // ---- cafetería
  taza: (c) => `
    <g stroke="${c}" stroke-width="20" fill="none" stroke-linecap="round">
      <path d="M212 150 q-16 -24 0 -48"/><path d="M256 150 q-16 -24 0 -48"/><path d="M300 150 q-16 -24 0 -48"/>
    </g>
    <path d="M152 200 h184 v84 a92 92 0 0 1 -184 0 z" fill="${c}"/>
    <path d="M336 216 h22 a46 46 0 0 1 0 92 h-22" fill="none" stroke="${c}" stroke-width="24"/>
    <rect x="132" y="356" width="248" height="20" rx="10" fill="${c}"/>`,
  vaso: (c) => `
    <path d="M164 148 h184 l-26 306 q-2 22 -24 22 h-84 q-22 0 -24 -22 z" fill="${c}"/>
    <rect x="146" y="116" width="220" height="32" rx="15" fill="${c}"/>
    <path d="M296 126 L356 40" stroke="${c}" stroke-width="26" stroke-linecap="round" fill="none"/>`,
  grano: (c) => `
    <g transform="rotate(-24 256 256)">
      <ellipse cx="256" cy="256" rx="122" ry="166" fill="none" stroke="${c}" stroke-width="26"/>
      <path d="M256 104 q-54 76 0 152 q54 76 0 152" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round"/>
    </g>`,
  // ---- barbería / peluquería
  tijeras: (c) => `
    <g stroke="${c}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="176" cy="346" r="40"/><circle cx="336" cy="346" r="40"/>
      <path d="M205 322 L372 150"/><path d="M307 322 L140 150"/>
    </g>
    <circle cx="256" cy="252" r="11" fill="${c}"/>`,
  peine: (c) => `
    <rect x="86" y="146" width="340" height="66" rx="22" fill="${c}"/>
    <g fill="${c}">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${104 + i * 36}" y="212" width="20" height="132" rx="10"/>`).join("")}</g>`,
  poste: (c) => `
    <rect x="196" y="126" width="120" height="262" rx="18" fill="none" stroke="${c}" stroke-width="22"/>
    <g stroke="${c}" stroke-width="20" stroke-linecap="round">
      <path d="M206 202 L306 148"/><path d="M206 272 L306 218"/><path d="M206 342 L306 288"/>
    </g>
    <rect x="170" y="76" width="172" height="40" rx="18" fill="${c}"/>
    <rect x="170" y="396" width="172" height="40" rx="18" fill="${c}"/>`,
  // ---- comida
  pizza: (c) => `
    <path d="M256 118 L398 384 Q256 436 114 384 Z" fill="#ffd54a"/>
    <path d="M114 384 Q256 436 398 384" fill="none" stroke="#e8a44a" stroke-width="22" stroke-linecap="round"/>
    <path d="M256 118 L398 384 Q256 436 114 384 Z" fill="none" stroke="${c}" stroke-width="12"/>
    <circle cx="228" cy="300" r="19" fill="#c1121f"/><circle cx="300" cy="256" r="16" fill="#c1121f"/><circle cx="272" cy="362" r="15" fill="#c1121f"/>`,
  burger: (c) => `
    <path d="M112 232 a144 106 0 0 1 288 0 z" fill="${c}"/>
    <rect x="104" y="252" width="304" height="40" rx="20" fill="${c}"/>
    <path d="M104 312 h304 v26 a62 62 0 0 1 -62 62 h-180 a62 62 0 0 1 -62 -62 z" fill="${c}"/>`,
  croissant: (c) => `
    <path d="M92 344 A164 164 0 0 1 420 344 Q404 404 356 352 A100 100 0 0 0 156 352 Q108 404 92 344 z" fill="${c}"/>`,
  helado: (c) => `
    <path d="M152 244 a104 104 0 0 1 208 0 z" fill="${c}"/>
    <path d="M168 268 L256 470 L344 268 z" fill="${c}"/>`,
  // ---- bar
  copa: (c) => `
    <path d="M148 100 h216 q-4 128 -92 172 v108 h74 a18 18 0 0 1 0 36 h-180 a18 18 0 0 1 0 -36 h74 V272 q-88 -44 -92 -172 z" fill="${c}"/>`,
  jarra: (c) => `
    <path d="M134 158 q6 -62 64 -50 q36 -46 92 -20 q58 -16 64 70 z" fill="${c}"/>
    <rect x="138" y="170" width="200" height="262" rx="26" fill="${c}"/>
    <path d="M348 214 h30 a52 52 0 0 1 0 104 h-30" fill="none" stroke="${c}" stroke-width="28"/>`,
  // ---- genéricas
  corazon: (c) => `
    <path d="M256 434 C 96 332 62 232 116 168 C 164 110 234 124 256 180 C 278 124 348 110 396 168 C 450 232 416 332 256 434 z" fill="${c}"/>`,
  estrella: (c) => `
    <polygon points="256,92 297,205 418,210 323,284 357,400 256,332 156,400 189,284 94,210 215,205" fill="${c}"/>`,
  huella: (c) => `
    <g fill="${c}">
      <ellipse cx="256" cy="332" rx="112" ry="92"/>
      <ellipse cx="146" cy="218" rx="46" ry="58"/><ellipse cx="216" cy="158" rx="44" ry="58"/>
      <ellipse cx="296" cy="158" rx="44" ry="58"/><ellipse cx="366" cy="218" rx="46" ry="58"/>
    </g>`,
  pesa: (c) => `
    <g fill="${c}">
      <rect x="120" y="236" width="272" height="40" rx="20"/>
      <rect x="74" y="184" width="58" height="144" rx="20"/><rect x="380" y="184" width="58" height="144" rx="20"/>
      <rect x="36" y="214" width="40" height="84" rx="16"/><rect x="436" y="214" width="40" height="84" rx="16"/>
    </g>`,
  flor: (c) => `
    <g fill="${c}">
      <ellipse cx="256" cy="118" rx="52" ry="78"/><ellipse cx="394" cy="256" rx="78" ry="52"/>
      <ellipse cx="256" cy="394" rx="52" ry="78"/><ellipse cx="118" cy="256" rx="78" ry="52"/>
      <circle cx="256" cy="256" r="46"/>
    </g>`,
  libro: (c) => `
    <path d="M92 124 q78 -32 154 10 v296 q-76 -40 -154 -10 z" fill="${c}"/>
    <path d="M420 124 q-78 -32 -154 10 v296 q76 -40 154 -10 z" fill="${c}"/>`,
  // ---- nutrición / suplementos
  bote: (c) => `
    <rect x="150" y="86" width="212" height="62" rx="20" fill="${c}"/>
    <rect x="186" y="148" width="140" height="26" fill="${c}"/>
    <rect x="140" y="174" width="232" height="268" rx="38" fill="none" stroke="${c}" stroke-width="26"/>
    <rect x="168" y="250" width="176" height="92" rx="12" fill="${c}"/>`,
  shaker: (c) => `
    <rect x="200" y="62" width="112" height="30" rx="14" fill="${c}"/>
    <rect x="176" y="92" width="160" height="56" rx="18" fill="${c}"/>
    <path d="M170 158 h172 l22 232 a46 46 0 0 1 -46 50 h-124 a46 46 0 0 1 -46 -50 z" fill="none" stroke="${c}" stroke-width="26"/>
    <g fill="${c}">
      <rect x="208" y="252" width="94" height="18" rx="9"/>
      <rect x="208" y="306" width="64" height="18" rx="9"/>
      <rect x="208" y="360" width="94" height="18" rx="9"/>
    </g>`,
  manzana: (c) => `
    <path d="M256 104 q-10 -42 -74 -48 q6 52 62 64" fill="${c}"/>
    <path d="M258 164 q-4 -48 24 -72" fill="none" stroke="${c}" stroke-width="20" stroke-linecap="round"/>
    <path d="M256 198 C 214 152 130 166 120 252 C 110 338 166 452 224 452 C 242 452 244 442 256 442
             C 268 442 270 452 288 452 C 346 452 402 338 392 252 C 382 166 298 152 256 198 Z" fill="${c}"/>`,
  rayo: (c) => `
    <polygon points="296,52 132,286 232,286 200,460 380,214 274,214" fill="${c}"/>`,
  // ---- letras (glifos.js)
  texto: (c, texto) => svgTextoCuadrado(texto, { cx: 256, cy: 256, alto: 300, color: c }),
};

// Hasta dónde llega la TINTA de cada marca dentro del lienzo de 512, de arriba
// abajo. Solo hace falta en el modo relleno, para que "la mitad" sea la mitad
// de la taza y no la mitad del cuadrado que la contiene. Las que no estén aquí
// usan el margen de siempre.
const CAJA = {
  taza: [100, 378], vaso: [40, 478], jarra: [134, 434], copa: [98, 418],
  helado: [140, 470], corazon: [110, 436], burger: [126, 400], grano: [90, 422],
  bote: [86, 455], shaker: [62, 455], manzana: [56, 452], rayo: [52, 460],
};
const CAJA_POR_DEFECTO = [40, 472];

/** Marcas que se saben dibujar, en el orden en que salen en el selector. */
export const MARCAS = Object.keys(DIBUJOS);
/** Formas de la casilla de un sello. */
export const FORMAS = ["circulo", "redondeado", "cuadrado", "rombo", "hexagono"];
/** Fondos de la banda. */
export const BANDAS = ["clara", "oscura", "blanca", "degradado", "rayas"];
/** Cómo se cuentan los sellos en la banda. */
export const MODOS = ["casillas", "relleno", "porciones", "pizza", "barra", "pesas", "anillos"];

// Nombres viejos: antes la marca se llamaba como el estilo que la usaba.
const ALIAS = { coffee: "taza", barber: "tijeras" };

/**
 * Nombre bueno de una marca, o null si no existe. Traduce los nombres viejos,
 * que siguen guardados en los temas de las tiendas de siempre.
 */
export const resolverMarca = (valor) => {
  const v = ALIAS[valor] || valor;
  return MARCAS.includes(v) ? v : null;
};

/**
 * Las piezas con las que se va a dibujar este tema, con sus valores por defecto
 * ya puestos. Es LA regla: un tema guardado antes de que existieran las piezas
 * solo tiene `estilo`, y de ahí salen las que le tocaban entonces, para que se
 * siga pintando igual que el primer día.
 */
export function piezasDeTema(tema = {}) {
  return {
    marca: resolverMarca(tema.marca) || resolverMarca(tema.estilo) || "taza",
    texto: typeof tema.texto === "string" ? tema.texto : "",
    forma: FORMAS.includes(tema.forma) ? tema.forma : (tema.estilo === "barber" ? "redondeado" : "circulo"),
    banda: BANDAS.includes(tema.banda) ? tema.banda : (tema.estilo === "barber" ? "oscura" : "clara"),
    modo: MODOS.includes(tema.modo) ? tema.modo : "casillas",
  };
}

/** Qué marca toca y con qué texto. */
function marcaDe(tema = {}) {
  const { marca, texto } = piezasDeTema(tema);
  return { nombre: marca, texto };
}

const forma = (tema) => piezasDeTema(tema).forma;
const modo = (tema) => piezasDeTema(tema).modo;
const banda = (tema) => piezasDeTema(tema).banda;
const esOscura = (tema) => banda(tema) === "oscura";

/**
 * Coloca la marca del tema, centrada en (cx, cy) y con lado `lado`.
 * @returns {string} puede ser "" (p. ej. un texto que no se sabe dibujar)
 */
function colocar(tema, color, cx, cy, lado) {
  const { nombre, texto } = marcaDe(tema);
  const cuerpo = DIBUJOS[nombre](color, texto);
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

// ------------------------------- banda -------------------------------
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
 * La casilla de un sello, centrada y con los atributos que se le pasen. Es la
 * misma figura llena que vacía: solo cambian el relleno y el trazo.
 */
export function svgCasilla(nombre, cx, cy, lado, atributos) {
  const r = lado / 2;
  if (nombre === "circulo") return `<circle cx="${cx}" cy="${cy}" r="${r}" ${atributos}/>`;
  if (nombre === "rombo") {
    return `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" ${atributos}/>`;
  }
  if (nombre === "hexagono") {
    const q = r * 0.5, a = r * 0.866; // hexágono de pie
    const p = [[cx, cy - r], [cx + a, cy - q], [cx + a, cy + q], [cx, cy + r], [cx - a, cy + q], [cx - a, cy - q]];
    return `<polygon points="${p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" ${atributos}/>`;
  }
  const rx = nombre === "cuadrado" ? 0 : lado * 0.22;
  return `<rect x="${cx - r}" y="${cy - r}" width="${lado}" height="${lado}" rx="${rx}" ${atributos}/>`;
}

/** El fondo de la banda: lo de detrás de los sellos. */
function fondoDeBanda(tema, w, h) {
  const a = tema.accent;
  switch (banda(tema)) {
    case "oscura":
      return `<defs><pattern id="poste" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="18" height="36" fill="${a}"/></pattern></defs>
        <rect width="${w}" height="${h}" fill="#101013"/><rect width="18" height="${h}" fill="url(#poste)"/>`;
    case "blanca":
      return `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
    case "degradado":
      return `<defs><linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}" stop-opacity="0.28"/><stop offset="1" stop-color="${a}" stop-opacity="0.06"/>
        </linearGradient></defs><rect width="${w}" height="${h}" fill="url(#fondo)"/>`;
    case "rayas":
      return `<defs><pattern id="rayas" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="44" height="44" fill="${a}" fill-opacity="0.07"/><rect width="22" height="44" fill="${a}" fill-opacity="0.16"/>
        </pattern></defs><rect width="${w}" height="${h}" fill="url(#rayas)"/>`;
    default:
      return `<rect width="${w}" height="${h}" fill="${a}" opacity="0.10"/>`;
  }
}

/** Una casilla por sello: la cartilla de toda la vida. */
function bandaCasillas(tema, meta, sellos, w, h) {
  const oscura = esOscura(tema);
  const casilla = forma(tema);
  // Con una marca de varias letras dentro, los sellos se emborronan: se dejan llenos a secas.
  const { nombre, texto } = marcaDe(tema);
  const conMarca = nombre !== "texto" || texto.length === 1;

  return rejillaSellos(meta, w, h, 36).map(({ cx, cy, d }, i) => {
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
  }).join("");
}

/**
 * Un solo dibujo grande que se LLENA de abajo arriba, un cacho por sello: la
 * taza que se va llenando. No hace falta ninguna imagen a medida ni una marca
 * especial — se pinta la misma marca dos veces, en fantasma y recortada por
 * abajo, así que vale para cualquiera de ellas (hasta para las letras).
 */
function bandaRelleno(tema, meta, sellos, w, h) {
  const parte = meta > 0 ? Math.min(1, Math.max(0, sellos / meta)) : 0;
  const oscura = esOscura(tema);
  const color = tema.accent;
  const { nombre } = marcaDe(tema);
  const cx = w * 0.32, cy = h / 2;

  // Se escala por la TINTA, no por el lienzo: así todas las marcas ocupan lo
  // mismo de alto en la banda, tengan más o menos aire alrededor. Y el corte
  // va también sobre la tinta: media taza es media taza.
  const [y0, y1] = CAJA[nombre] || CAJA_POR_DEFECTO;
  const lado = (h * 0.84 * 512) / (y1 - y0);
  const escala = lado / 512;
  const techo = cy - lado / 2 + y0 * escala;
  const suelo = cy - lado / 2 + y1 * escala;
  const alto = (suelo - techo) * parte;

  // Un id por dibujo: en un <img> cada SVG es un documento aparte, pero la
  // vista previa los mete en la misma página y se pisarían entre ellos.
  const id = `${nombre}-${meta}-${sellos}`;
  const recorte = `<clipPath id="${id}"><rect x="${cx - lado / 2}" y="${suelo - alto}" width="${lado}" height="${alto}"/></clipPath>`;
  const fantasma = `<g opacity="${oscura ? 0.22 : 0.16}">${colocar(tema, color, cx, cy, lado)}</g>`;
  const lleno = alto > 0 ? `<g clip-path="url(#${id})">${colocar(tema, color, cx, cy, lado)}</g>` : "";

  // Cuánto llevas, en cifras: el nivel solo se ve "a ojo".
  const cuenta = svgTextoCuadrado(`${sellos}/${meta}`, { cx: w * 0.72, cy, alto: h * 0.34, color, max: 6 });
  return recorte + fantasma + lleno + cuenta;
}

// --------------------------- geometría circular ---------------------------
// Ángulos en radianes, empezando ARRIBA (-90°) y girando como las agujas del
// reloj: así la primera porción y el primer tramo del anillo salen donde la
// gente espera que salgan.
const RAD = (i, n) => -Math.PI / 2 + (i / n) * Math.PI * 2;
const n2 = (v) => Number(v.toFixed(1));
const punto = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

/** Un trozo de tarta, con el vértice en el centro. */
function sector(cx, cy, r, a0, a1) {
  const [x0, y0] = punto(cx, cy, r, a0).map(n2);
  const [x1, y1] = punto(cx, cy, r, a1).map(n2);
  return `M ${n2(cx)} ${n2(cy)} L ${x0} ${y0} A ${n2(r)} ${n2(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`;
}

/** Un arco suelto, sin cerrar (el avance del anillo). */
function arco(cx, cy, r, a0, a1) {
  const [x0, y0] = punto(cx, cy, r, a0).map(n2);
  const [x1, y1] = punto(cx, cy, r, a1).map(n2);
  return `M ${x0} ${y0} A ${n2(r)} ${n2(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Círculo entero como `path`: una tarta de una sola porción es la tarta. */
const disco = (cx, cy, r) =>
  `M ${n2(cx - r)} ${n2(cy)} a ${n2(r)} ${n2(r)} 0 1 0 ${n2(r * 2)} 0 a ${n2(r)} ${n2(r)} 0 1 0 ${n2(-r * 2)} 0 Z`;

// Lo que FALTA se pinta con el color del tema sobre banda clara y con blanco
// sobre banda oscura: es la misma regla que ya usaban las casillas.
const tenue = (tema) => (esOscura(tema) ? "#ffffff" : tema.accent);
const opacoHueco = (tema) => (esOscura(tema) ? 0.26 : 0.38);

/**
 * La cuenta ("3/8"), en la tipografía dibujada de siempre. La tipografía es de
 * ancho fijo, así que "12/30" ocupa casi el doble que "3/8": con `ancho` se le
 * da el hueco que tiene y se encoge sola hasta caber. Sin eso, una cartilla de
 * 20 se sale de la banda.
 */
const cuenta = (sellos, meta, color, cx, cy, alto, ancho) => {
  const texto = `${sellos}/${meta}`;
  const cabe = (ancho / anchoDeTexto(texto.length)) * (ALTO_GLIFO + GROSOR);
  return svgTextoCuadrado(texto, { cx, cy, alto: Math.min(alto, cabe), color, max: 6 });
};

/**
 * PORCIONES — una tarta partida en `meta` trozos que se van ganando.
 * A diferencia de las casillas, se ve de un vistazo cuánto falta para CERRAR la
 * figura, que es un gancho distinto: no cuentas sellos, completas algo. Vale
 * para pizza, tarta, helado o menús, y funciona con cualquier `meta`.
 */
function bandaPorciones(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const color = tema.accent;
  const cx = w * 0.33, cy = h / 2, r = h * 0.4;
  // Separación angular entre porciones: los cortes de la tarta.
  const sep = n === 1 ? 0 : Math.min(((Math.PI * 2) / n) * 0.07, 0.05);

  const trozos = Array.from({ length: n }, (_, i) => {
    const d = n === 1 ? disco(cx, cy, r) : sector(cx, cy, r, RAD(i, n) + sep, RAD(i + 1, n) - sep);
    return i < sellos
      ? `<path d="${d}" fill="${color}"/>`
      : `<path d="${d}" fill="${color}" fill-opacity="${esOscura(tema) ? 0.1 : 0.12}"`
        + ` stroke="${tenue(tema)}" stroke-opacity="${opacoHueco(tema)}" stroke-width="4"/>`;
  }).join("");

  return trozos + cuenta(sellos, n, color, w * 0.74, cy, h * 0.32, w * 0.46);
}

// Una pizza de verdad no sale del color de la tienda: una pizza verde no es una
// pizza. Igual que la marca `pizza`, estos colores son fijos.
const PIZZA = { masa: "#e8a44a", queso: "#ffd54a", pepperoni: "#c1121f" };

/**
 * PIZZA — lo mismo que `porciones` pero dibujado como una pizza de verdad:
 * masa, queso y pepperoni en las porciones ganadas, y la silueta punteada de
 * las que faltan. Lo que se ve es una pizza a la que le faltan trozos, que es
 * exactamente lo que le pasa a la cartilla.
 */
function bandaPizza(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const cx = w * 0.33, cy = h / 2, r = h * 0.42;
  const sep = n === 1 ? 0 : Math.min(((Math.PI * 2) / n) * 0.06, 0.045);
  const corte = (rr, i, extra = 0) =>
    n === 1 ? disco(cx, cy, rr) : sector(cx, cy, rr, RAD(i, n) + sep + extra, RAD(i + 1, n) - sep - extra);

  const porcion = (i) => {
    const am = (RAD(i, n) + RAD(i + 1, n)) / 2;
    // Los pepperonis van SIEMPRE en el mismo sitio: el dibujo del manager y el
    // del .pkpass tienen que salir idénticos, así que nada de aleatorio.
    const giro = Math.min(0.22, Math.PI / n / 2.4);
    const topping = [[0.46, -giro], [0.7, giro]]
      .map(([f, g]) => {
        const [x, y] = punto(cx, cy, r * f, am + g);
        return `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r * 0.085)}" fill="${PIZZA.pepperoni}"/>`;
      })
      .join("");
    return `<path d="${corte(r, i)}" fill="${PIZZA.masa}"/>`
      + `<path d="${corte(r * 0.84, i, sep * 0.4)}" fill="${PIZZA.queso}"/>`
      + topping;
  };

  const trozos = Array.from({ length: n }, (_, i) =>
    i < sellos
      ? porcion(i)
      : `<g opacity="${esOscura(tema) ? 0.13 : 0.15}">${porcion(i)}</g>`
        + `<path d="${corte(r, i)}" fill="none" stroke="${tenue(tema)}"`
        + ` stroke-opacity="${opacoHueco(tema)}" stroke-width="3" stroke-dasharray="14 10"/>`,
  ).join("");

  return trozos + cuenta(sellos, n, tema.accent, w * 0.74, cy, h * 0.32, w * 0.46);
}

/**
 * BARRA — un tramo por sello, en fila. Es el único modo que aguanta bien una
 * cartilla larga (20, 30 visitas): las casillas a esas alturas se convierten en
 * confeti y la barra se sigue leyendo. Lleva la marca de la tienda a la
 * izquierda para que no sea una barra de carga genérica.
 */
function bandaBarra(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const color = tema.accent;
  const x0 = w * 0.19, x1 = w * 0.7;
  const alto = h * 0.3, y = h / 2 - alto / 2;
  const hueco = Math.min(10, ((x1 - x0) / n) * 0.22);
  const ancho = (x1 - x0 - hueco * (n - 1)) / n;
  const rx = Math.min(ancho, alto) * 0.28;

  const tramos = Array.from({ length: n }, (_, i) => {
    const pinta = i < sellos
      ? `fill="${color}"`
      : `fill="${tenue(tema)}" fill-opacity="${esOscura(tema) ? 0.16 : 0.14}"`;
    return `<rect x="${n2(x0 + i * (ancho + hueco))}" y="${n2(y)}" width="${n2(ancho)}"`
      + ` height="${n2(alto)}" rx="${n2(rx)}" ${pinta}/>`;
  }).join("");

  return colocar(tema, color, w * 0.105, h / 2, h * 0.56)
    + tramos
    + cuenta(sellos, n, color, w * 0.855, h / 2, h * 0.3, w * 0.28);
}

/**
 * PESAS — la barra se va cargando de discos, uno por compra, alternando lado
 * para que no quede coja. Pensado para tiendas de NUTRICIÓN y gimnasios, donde
 * la cartilla es de pocas compras grandes (un bote al mes) y no de muchos
 * cafés: ocho círculos vacíos ahí dan sensación de no acabar nunca, y una
 * barra a medio cargar da justo la contraria.
 */
function bandaPesas(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const color = tema.accent;
  const cx = w / 2, cy = h / 2;
  const ranuras = Math.ceil(n / 2);
  const agarre = w * 0.075;                 // media barra central, sin discos
  const paso = (w * 0.42 - agarre) / ranuras;
  const ancho = Math.min(paso * 0.62, h * 0.15);

  const disco = (i) => {
    const j = Math.floor(i / 2);            // qué ranura, de dentro hacia fuera
    const x = cx + (i % 2 === 0 ? 1 : -1) * (agarre + paso * (j + 0.5));
    const alto = h * 0.56 * (1 - j * 0.07); // los de fuera, un poco menores
    const pinta = i < sellos
      ? `fill="${color}"`
      : `fill="none" stroke="${tenue(tema)}" stroke-opacity="${opacoHueco(tema)}" stroke-width="4" stroke-dasharray="12 9"`;
    return `<rect x="${n2(x - ancho / 2)}" y="${n2(cy - alto / 2)}" width="${n2(ancho)}"`
      + ` height="${n2(alto)}" rx="${n2(ancho * 0.3)}" ${pinta}/>`;
  };

  const barra = `<rect x="${n2(w * 0.06)}" y="${n2(cy - h * 0.033)}" width="${n2(w * 0.88)}"`
    + ` height="${n2(h * 0.066)}" rx="${n2(h * 0.033)}" fill="${tenue(tema)}" fill-opacity="${esOscura(tema) ? 0.4 : 0.42}"/>`;
  const topes = [-1, 1]
    .map((s) => `<rect x="${n2(cx + s * agarre - w * 0.007)}" y="${n2(cy - h * 0.12)}" width="${n2(w * 0.014)}"`
      + ` height="${n2(h * 0.24)}" rx="${n2(w * 0.007)}" fill="${tenue(tema)}" fill-opacity="0.55"/>`)
    .join("");

  return barra + topes
    + Array.from({ length: n }, (_, i) => disco(i)).join("")
    + cuenta(sellos, n, color, cx, h * 0.15, h * 0.17, w * 0.3);
}

/**
 * ANILLOS — un aro que se cierra. Es el modo que aguanta CUALQUIER meta (de 3 a
 * 50) sin cambiar de aspecto, y el único que enseña el progreso como proporción
 * y no como cuenta. Las muescas de fuera dejan contar los sellos cuando son
 * pocos; dentro va la marca de la tienda.
 */
function bandaAnillos(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const color = tema.accent;
  const cx = w * 0.32, cy = h / 2;
  const r = h * 0.34, grosor = h * 0.13;
  const parte = Math.min(1, Math.max(0, sellos / n));

  const pista = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none"`
    + ` stroke="${tenue(tema)}" stroke-opacity="0.18" stroke-width="${n2(grosor)}"/>`;

  // Un arco de 360° empieza y acaba en el mismo punto, así que no se dibuja:
  // cerrado del todo es un círculo entero.
  const avance = parte >= 1
    ? `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none" stroke="${color}" stroke-width="${n2(grosor)}"/>`
    : parte > 0
      ? `<path d="${arco(cx, cy, r, RAD(0, 1), RAD(0, 1) + parte * Math.PI * 2)}" fill="none"`
        + ` stroke="${color}" stroke-width="${n2(grosor)}" stroke-linecap="round"/>`
      : "";

  const muescas = n <= 12
    ? Array.from({ length: n }, (_, i) => {
        const [x, y] = punto(cx, cy, r + grosor * 0.92, RAD(i, n));
        return `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(h * 0.022)}" fill="${tenue(tema)}"`
          + ` fill-opacity="${i < sellos ? 0.7 : 0.28}"/>`;
      }).join("")
    : "";

  return pista + avance + muescas
    + colocar(tema, color, cx, cy, r * 1.05)
    + cuenta(sellos, n, color, w * 0.74, cy, h * 0.32, w * 0.46);
}

// Cada modo es una función con la MISMA firma. Añadir uno son dos líneas: una
// entrada aquí y su nombre en MODOS; sale solo en el selector del admin, en la
// vista previa del manager y en el .pkpass.
const PINTAR_BANDA = {
  casillas: bandaCasillas,
  relleno: bandaRelleno,
  porciones: bandaPorciones,
  pizza: bandaPizza,
  barra: bandaBarra,
  pesas: bandaPesas,
  anillos: bandaAnillos,
};

export function svgStripSellos(tema, meta, sellos) {
  const [w, h] = TAM.strip.storeCard.map((v) => v * 3);
  const llenos = Math.min(Math.max(0, sellos), meta);
  const pintar = PINTAR_BANDA[modo(tema)] || bandaCasillas;
  return svg(w, h, fondoDeBanda(tema, w, h) + pintar(tema, meta, llenos, w, h));
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
