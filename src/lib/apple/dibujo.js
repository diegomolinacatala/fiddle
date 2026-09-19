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

import { svgTextoCuadrado } from "./glifos";

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
};
const CAJA_POR_DEFECTO = [40, 472];

/** Marcas que se saben dibujar, en el orden en que salen en el selector. */
export const MARCAS = Object.keys(DIBUJOS);
/** Formas de la casilla de un sello. */
export const FORMAS = ["circulo", "redondeado", "cuadrado", "rombo", "hexagono"];
/** Fondos de la banda. */
export const BANDAS = ["clara", "oscura", "blanca", "degradado", "rayas"];
/** Cómo se cuentan los sellos en la banda. */
export const MODOS = ["casillas", "relleno"];

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

export function svgStripSellos(tema, meta, sellos) {
  const [w, h] = TAM.strip.storeCard.map((v) => v * 3);
  const llenos = Math.min(Math.max(0, sellos), meta);
  const dentro = modo(tema) === "relleno"
    ? bandaRelleno(tema, meta, llenos, w, h)
    : bandaCasillas(tema, meta, llenos, w, h);
  return svg(w, h, fondoDeBanda(tema, w, h) + dentro);
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
