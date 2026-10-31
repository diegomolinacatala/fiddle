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
// en el modo relleno y en el selector del admin. El logo de verdad de UNA tienda
// (sacado de su manual) va aparte, en marcasPropias.js, y solo lo ve ella.
//
// EL COLOR DEL PASE. Lo que se dibuja (logo, sellos, etiquetas) va en el color
// de la tienda (`accent`), salvo que el tema traiga `detalle`: la tarjeta verde
// con todo en blanco. `accent` no puede ser blanco porque también pinta los
// botones de la caja y de las pantallas, con su texto blanco encima.
//
// Sin <text> en los SVG: en serverless no hay fuentes fiables, las letras se
// dibujan (glifos.js).
// ============================================================================

import { svgTextoCuadrado, anchoDeTexto, ALTO as ALTO_GLIFO, GROSOR } from "./glifos";
import { cartillasDe } from "../cartillas";
import { svgTexto, anchoTexto } from "./texto";
import { EM, ALTO_MAYUSCULA } from "./letras";
import { DIBUJOS_PROPIOS, CAJA_PROPIA } from "./marcasPropias";
import { esMarcaPropia, idDeMarca, fotoDe } from "../propios";

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
  // Mordida arriba a la derecha y pepitas huecas (evenodd): con un solo color, sin
  // el mordisco sería un círculo con puntos y no se leería como galleta.
  galleta: (c) => `
    <path fill-rule="evenodd" fill="${c}" d="M444 236 A190 190 0 1 1 249 72 A50 50 0 0 0 339 91 A50 50 0 0 0 410 150 A50 50 0 0 0 444 236 z
      ${[[178, 196, 26], [290, 206, 22], [212, 300, 25], [328, 296, 28], [146, 318, 18], [262, 384, 23], [352, 372, 18]]
        .map(([x, y, r]) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 z`).join(" ")}"/>`,
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

// Hasta dónde llega la TINTA de cada marca dentro del lienzo de 512: de arriba
// abajo y de izquierda a derecha ([y0, y1, x0, x1]). Solo hace falta en el modo
// relleno, para que "la mitad" sea la mitad de la taza y no la mitad del cuadrado
// que la contiene, y para poner en fila los premios guardados sin huecos raros.
// Las que no estén aquí usan el margen de siempre. Los anchos salen de rasterizar
// cada marca; una marca nueva de relleno los necesita igual.
const CAJA = {
  taza: [100, 378, 132, 416], vaso: [40, 478, 146, 369], jarra: [134, 434, 134, 444], copa: [98, 418, 148, 364],
  helado: [140, 470, 152, 360], galleta: [72, 452, 65, 446], corazon: [110, 436, 92, 420], burger: [126, 400, 104, 408],
  grano: [90, 422, 112, 400], bote: [86, 455, 127, 385], shaker: [62, 455, 135, 377], manzana: [56, 452, 119, 393],
  rayo: [52, 460, 132, 380],
};
const CAJA_POR_DEFECTO = [40, 472, 40, 472];

/** Marcas que se saben dibujar, en el orden en que salen en el selector. */
export const MARCAS = Object.keys(DIBUJOS);
/** Las de una tienda concreta (su logo de verdad): solo salen en su editor (lib/kits.js). */
export const MARCAS_PROPIAS = Object.keys(DIBUJOS_PROPIOS);
const TODAS = { ...DIBUJOS, ...DIBUJOS_PROPIOS };
/** Formas de la casilla de un sello. */
export const FORMAS = ["circulo", "redondeado", "cuadrado", "rombo", "hexagono"];
/** Fondos de la banda. */
export const BANDAS = ["clara", "oscura", "blanca", "degradado", "rayas"];
/**
 * Cómo se REPARTEN dos cartillas en la misma banda: una encima de otra (filas)
 * o una al lado de otra (lados). Cómo cuenta cada una es cosa suya
 * (`cartilla.modo`, cualquiera de MODOS), igual que una tienda de una cartilla.
 * "llenar" es el nombre viejo de "lados con las dos llenándose".
 */
export const MODOS_DOBLES = ["filas", "lados"];
/**
 * Cómo se cuentan los sellos en la banda. Lo básico, a propósito (31-10-2026):
 * las fases de la luna, la constelación, la planta y compañía se quitaron por
 * recargadas. Lo que alguien tuviera guardado con ellos se pinta con el básico
 * que más se le parece (MODOS_RETIRADOS).
 */
export const MODOS = ["casillas", "relleno", "porciones", "pizza", "barra", "anillos", "cifra"];

/** Los modos que ya no se ofrecen, y cuál se pinta en su lugar. */
export const MODOS_RETIRADOS = {
  luna: "anillos", constelacion: "casillas", camino: "casillas", planta: "relleno", mosaico: "relleno",
  torre: "barra", pesas: "barra", pulso: "barra", escalera: "barra", aguja: "cifra",
};

/** El modo que se pinta para un valor guardado: el mismo, su sustituto si se retiró, o null. */
export const resolverModo = (modo) => (MODOS.includes(modo) ? modo : MODOS_RETIRADOS[modo] || null);

/**
 * Los modos, agrupados por LO QUE HACEN. Muchas opciones de golpe no se
 * eligen, se sufren: primero se escoge la idea (se llena, se cierra, es un
 * camino…) y dentro de ella la variante. El orden de cada familia importa: el
 * primero es el que representa a la familia en el selector.
 *
 * Lo que se guarda en el tema sigue siendo SOLO `modo`. La familia se deduce,
 * así que las tiendas de antes no tienen que cambiar nada.
 */
export const FAMILIAS = {
  casillas: ["casillas"],
  llenar: ["relleno"],
  cerrar: ["anillos", "porciones", "pizza"],
  fila: ["barra"],
  marcador: ["cifra"],
};

/** Nombres de familia, en el orden del selector. */
export const NOMBRES_FAMILIA = Object.keys(FAMILIAS);

/** A qué familia pertenece un modo (los desconocidos caen en casillas). */
export const familiaDeModo = (modo) =>
  NOMBRES_FAMILIA.find((f) => FAMILIAS[f].includes(modo)) || "casillas";

/** Las variantes de una familia, o las de casillas si no existe. */
export const modosDeFamilia = (familia) => FAMILIAS[familia] || FAMILIAS.casillas;

// Nombres viejos: antes la marca se llamaba como el estilo que la usaba.
const ALIAS = { coffee: "taza", barber: "tijeras" };

/**
 * Nombre bueno de una marca, o null si no existe. Traduce los nombres viejos,
 * que siguen guardados en los temas de las tiendas de siempre.
 */
export const resolverMarca = (valor) => {
  // Un icono subido por la tienda ("propia:<id>", lib/propios.js): si es suyo lo
  // decide el servidor al guardar; aquí basta con que tenga buena forma.
  if (esMarcaPropia(valor)) return valor;
  const v = ALIAS[valor] || valor;
  return typeof v === "string" && Object.hasOwn(TODAS, v) ? v : null;
};

/** El data URI de un icono propio que el tema lleva dentro (`tema.iconos`), o null. */
const iconoDe = (tema, marca) => {
  const uri = tema?.iconos?.[idDeMarca(marca)];
  return typeof uri === "string" && uri.startsWith("data:image/png;base64,") ? uri : null;
};

/** La marca si se puede dibujar CON ESTE TEMA: un icono propio sin su imagen dentro, no. */
const marcaDibujable = (tema, valor) => {
  const m = resolverMarca(valor);
  return m && esMarcaPropia(m) && !iconoDe(tema, m) ? null : m;
};

/**
 * Un icono propio, de un color como los de DIBUJOS: la imagen guardada es la
 * silueta en blanco sobre transparente y hace de MÁSCARA de un cuadrado del
 * color que toque. Así vale en el logo, dentro de un sello lleno o llenándose.
 * El id de la máscara es el del icono: repetido en varios sellos es el mismo.
 */
function dibujoPropio(tema, marca, color) {
  const uri = iconoDe(tema, marca);
  if (!uri) return "";
  const id = `pm-${idDeMarca(marca)}`;
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">`
    + `<image href="${uri}" x="0" y="0" width="512" height="512"/></mask></defs>`
    + `<rect width="512" height="512" fill="${color}" mask="url(#${id})"/>`;
}

/**
 * Las piezas con las que se va a dibujar este tema, con sus valores por defecto
 * ya puestos. Es LA regla: un tema guardado antes de que existieran las piezas
 * solo tiene `estilo`, y de ahí salen las que le tocaban entonces, para que se
 * siga pintando igual que el primer día.
 */
export function piezasDeTema(tema = {}) {
  return {
    marca: marcaDibujable(tema, tema.marca) || resolverMarca(tema.estilo) || "taza",
    texto: typeof tema.texto === "string" ? tema.texto : "",
    forma: FORMAS.includes(tema.forma) ? tema.forma : (tema.estilo === "barber" ? "redondeado" : "circulo"),
    banda: BANDAS.includes(tema.banda) || (tema.banda === "foto" && fotoDe(tema)) ? tema.banda : (tema.estilo === "barber" ? "oscura" : "clara"),
    modo: resolverModo(tema.modo) || "casillas",
    doble: tema.doble === "llenar" ? "lados" : MODOS_DOBLES.includes(tema.doble) ? tema.doble : "filas",
  };
}

/**
 * Cómo cuenta UNA de las dos cartillas. Las guardadas antes de que cada una
 * tuviera su modo no lo llevan: casillas, salvo las del viejo "llenar".
 */
export function modoDeCartilla(tema, cartilla) {
  const guardado = resolverModo(cartilla?.modo);
  if (guardado) return guardado;
  return tema?.doble === "llenar" ? "relleno" : "casillas";
}

/** Qué marca toca y con qué texto. */
function marcaDe(tema = {}) {
  const { marca, texto } = piezasDeTema(tema);
  return { nombre: marca, texto };
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * El tema tal como se DIBUJA en el pase: con `detalle`, ese es el color del
 * logo, los sellos y las etiquetas (va en `accent` para que el dibujo no tenga
 * que saber nada). Sin él, el de la tienda. Aplicarlo dos veces no cambia nada.
 */
export function temaDelPase(tema = {}) {
  return HEX.test(String(tema.detalle || "")) ? { ...tema, accent: tema.detalle } : tema;
}

/** El color de las etiquetas del pase (Apple, la vista previa y la tarjeta web). */
export const colorDelPase = (tema) => temaDelPase(tema).accent;

/** Luminancia relativa (WCAG) de un #rrggbb; 0 si no se entiende. */
function luz(hex) {
  if (!HEX.test(String(hex || ""))) return 0;
  const [r, g, b] = hex.slice(1).match(/../g).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const esClaro = (hex) => luz(hex) > 0.6;

/** ¿Pide texto oscuro encima? (blanco, crema…). */
export const esColorClaro = esClaro;

/**
 * La tinta de lo que va ENCIMA del color del pase (la marca dentro de un sello
 * lleno): blanca, salvo que ese color sea claro. Entonces la del fondo de la
 * tarjeta: sello blanco con la galleta verde, sobre la tarjeta verde.
 */
function tintaSobre(tema) {
  if (!esClaro(tema.accent)) return "#ffffff";
  return !tema.cardBg || esClaro(tema.cardBg) ? "#1b1e23" : tema.cardBg;
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
  const cuerpo = esMarcaPropia(nombre) ? dibujoPropio(tema, nombre, color) : TODAS[nombre](color, texto);
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

/**
 * La marca sobre un fondo liso, para lo que no es el pase de Apple: el icono de
 * la tarjeta instalada en Android, el logo de Google Wallet (que lo recorta en
 * círculo) y la insignia de las notificaciones. Mismo dibujo, otro marco.
 *
 * @param {object} tema
 * @param {number} lado  lienzo cuadrado
 * @param {{fondo?:string|null, color?:string, escala?:number, radio?:number}} [opciones]
 *   `fondo` null = transparente; `escala` = qué parte del lado ocupa la marca
 *   (Android recorta los iconos adaptables y Google el logo: hay que dejar aire).
 */
export function svgMarca(tema, lado, { fondo, color, escala = 0.9, radio = 0 } = {}) {
  const oscura = esOscura(tema);
  const relleno = fondo === undefined ? (oscura ? "#17171c" : tema.accent) : fondo;
  const tinta = color || (oscura ? tema.accent : "#ffffff");
  const rect = relleno ? `<rect width="${lado}" height="${lado}" rx="${radio}" fill="${relleno}"/>` : "";
  return svg(lado, lado, rect + colocar(tema, tinta, lado / 2, lado / 2, lado * escala));
}

/**
 * Logo para Google Wallet: la marca en el color de la tienda sobre el fondo de
 * su tarjeta. Google lo recorta en círculo y lo pone ENCIMA de su color de
 * acento: con fondo de acento (como el icono) el círculo desaparecería.
 */
export const svgLogoGoogle = (tema, lado = 660) =>
  svgMarca(tema, lado, { fondo: tema.cardBg || "#ffffff", color: colorDelPase(tema), escala: 0.6 });

/**
 * La misma banda pero opaca, sobre el fondo de la tarjeta. En Apple la banda se
 * pinta sobre `cardBg`; en Google va sobre su color de acento, y una banda
 * "clara" (acento al 10 %) dejaría los sellos del mismo color que el fondo.
 */
export function svgBandaOpaca(svgTexto, fondo) {
  const fin = svgTexto.indexOf(">") + 1;
  return `${svgTexto.slice(0, fin)}<rect width="100%" height="100%" fill="${fondo || "#ffffff"}"/>${svgTexto.slice(fin)}`;
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

const n2 = (v) => Number(v.toFixed(1));

// ------------------------- ids y degradados -------------------------
/**
 * Prefijo de id propio de ESTE dibujo, para sus degradados y recortes. En el
 * .pkpass cada SVG es un fichero aparte y daría igual, pero el admin pinta
 * muchas bandas en la misma página: sin esto, el degradado de la primera se
 * quedaría con el id y las demás saldrían con su color.
 */
function idDe(tema, meta, sellos) {
  const p = piezasDeTema(tema);
  const color = String(tema.accent || "").replace(/[^0-9a-z]/gi, "");
  return `${p.modo}-${p.marca}-${p.forma}-${p.banda}-${meta}-${sellos}-${color}`;
}

/** Degradado vertical del mismo color: quita la sensación de recorte plano. */
const brillo = (id, color) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="${color}" stop-opacity="1"/>`
  + `<stop offset="1" stop-color="${color}" stop-opacity="0.74"/></linearGradient>`;

/** Resplandor que se apaga hacia fuera, para lo que tiene que "brillar". */
const halo = (id, color) =>
  `<radialGradient id="${id}">`
  + `<stop offset="0.5" stop-color="${color}" stop-opacity="0.38"/>`
  + `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/**
 * Luz que viene de arriba a la izquierda, en coordenadas del lienzo (no de cada
 * figura): así todas las porciones de una tarta comparten el mismo foco en vez
 * de tener cada una el suyo, que es lo que delata a un dibujo plano.
 */
const foco = (id, color, cx, cy, r) =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse"`
  + ` cx="${n2(cx - r * 0.3)}" cy="${n2(cy - r * 0.35)}" r="${n2(r * 1.7)}">`
  + `<stop offset="0" stop-color="${color}" stop-opacity="1"/>`
  + `<stop offset="1" stop-color="${color}" stop-opacity="0.7"/></radialGradient>`;

/** El fondo de la banda: lo de detrás de los sellos. */
function fondoDeBanda(tema, w, h, id) {
  const a = tema.accent;
  switch (banda(tema)) {
    case "oscura":
      return `<defs><pattern id="${id}-poste" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="18" height="36" fill="${a}"/></pattern></defs>
        <rect width="${w}" height="${h}" fill="#101013"/><rect width="18" height="${h}" fill="url(#${id}-poste)"/>`;
    case "blanca":
      return `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
    case "degradado":
      return `<defs><linearGradient id="${id}-fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}" stop-opacity="0.28"/><stop offset="1" stop-color="${a}" stop-opacity="0.06"/>
        </linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${id}-fondo)"/>`;
    case "foto": {
      // Una foto de la tienda (lib/propios.js), a sangre, con un velo del color de
      // la tarjeta para que los sellos se lean encima. `fotoBanda` (el data URI) no
      // se guarda: lo pone quien dibuja (el servidor la lee del almacén, el
      // navegador la pide). Mientras no está, la banda clara de siempre.
      const velo = `<rect width="${w}" height="${h}" fill="${tema.cardBg || "#ffffff"}" opacity="0.45"/>`;
      return typeof tema.fotoBanda === "string" && tema.fotoBanda.startsWith("data:image/")
        ? `<image href="${tema.fotoBanda}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>${velo}`
        : `<rect width="${w}" height="${h}" fill="${a}" opacity="0.10"/>`;
    }
    case "rayas":
      return `<defs><pattern id="${id}-rayas" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="44" height="44" fill="${a}" fill-opacity="0.07"/><rect width="22" height="44" fill="${a}" fill-opacity="0.16"/>
        </pattern></defs><rect width="${w}" height="${h}" fill="url(#${id}-rayas)"/>`;
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
        + (conMarca ? colocar(tema, tintaSobre(tema), cx, cy, d * 0.78) : "")
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
  const color = tema.accent;
  const cx = w * 0.32, cy = h / 2;
  // Un id por dibujo: en un <img> cada SVG es un documento aparte, pero la
  // vista previa los mete en la misma página y se pisarían entre ellos.
  const dibujo = queSeLlena(tema, cx, cy, h * 0.84, parte, idDe(tema, meta, sellos));

  // Cuánto llevas, en cifras: el nivel solo se ve "a ojo".
  const cuenta = svgTextoCuadrado(`${sellos}/${meta}`, { cx: w * 0.72, cy, alto: h * 0.34, color, max: 6 });
  return dibujo + cuenta;
}

/**
 * La marca del tema en grande, llenándose de abajo arriba hasta `parte` (0-1).
 * Se pinta dos veces: en fantasma y, encima, recortada por abajo.
 *
 * Se escala por la TINTA, no por el lienzo: así todas las marcas ocupan lo
 * mismo de alto (`altoTinta`), tengan más o menos aire alrededor. Y el corte va
 * también sobre la tinta: media taza es media taza.
 */
function queSeLlena(tema, cx, cy, altoTinta, parte, id) {
  const oscura = esOscura(tema);
  const color = tema.accent;
  const { nombre } = marcaDe(tema);
  const [y0, y1] = CAJA[nombre] || CAJA_PROPIA[nombre] || CAJA_POR_DEFECTO;
  const lado = (altoTinta * 512) / (y1 - y0);
  const escala = lado / 512;
  const techo = cy - lado / 2 + y0 * escala;
  const suelo = cy - lado / 2 + y1 * escala;
  const alto = (suelo - techo) * parte;

  const recorte = `<clipPath id="${id}"><rect x="${cx - lado / 2}" y="${suelo - alto}" width="${lado}" height="${alto}"/></clipPath>`;
  const fantasma = `<g opacity="${oscura ? 0.22 : 0.16}">${colocar(tema, color, cx, cy, lado)}</g>`;
  const lleno = alto > 0 ? `<g clip-path="url(#${id})">${colocar(tema, color, cx, cy, lado)}</g>` : "";
  return recorte + fantasma + lleno;
}

// --------------------------- geometría circular ---------------------------
// Ángulos en radianes, empezando ARRIBA (-90°) y girando como las agujas del
// reloj: así la primera porción y el primer tramo del anillo salen donde la
// gente espera que salgan.
const RAD = (i, n) => -Math.PI / 2 + (i / n) * Math.PI * 2;
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
  const id = idDe(tema, meta, sellos);
  // Separación angular entre porciones: los cortes de la tarta.
  const sep = n === 1 ? 0 : Math.min(((Math.PI * 2) / n) * 0.07, 0.05);

  const trozos = Array.from({ length: n }, (_, i) => {
    const d = n === 1 ? disco(cx, cy, r) : sector(cx, cy, r, RAD(i, n) + sep, RAD(i + 1, n) - sep);
    return i < sellos
      ? `<path d="${d}" fill="url(#${id}-tarta)"/>`
      : `<path d="${d}" fill="${color}" fill-opacity="${esOscura(tema) ? 0.1 : 0.12}"`
        + ` stroke="${tenue(tema)}" stroke-opacity="${opacoHueco(tema)}" stroke-width="4"/>`;
  }).join("");

  // El aro de fuera cierra la figura: sin él las porciones flotan sueltas.
  const aro = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 1.06)}" fill="none" stroke="${tenue(tema)}" stroke-opacity="0.22" stroke-width="3"/>`;
  return `<defs>${foco(`${id}-tarta`, color, cx, cy, r)}</defs>` + aro + trozos
    + cuenta(sellos, n, color, w * 0.74, cy, h * 0.32, w * 0.46);
}

// Una pizza de verdad no sale del color de la tienda: una pizza verde no es una
// pizza. Igual que la marca `pizza`, estos colores son fijos.
const PIZZA = {
  masaClara: "#f4bf6e", masa: "#dc903f", masaOscura: "#a65e20",
  tomate: "#d0552c", queso: "#ffdf86", quesoClaro: "#fff2bf", quesoBorde: "#f3b944",
  pepperoni: "#b9321f", pepperoniOscuro: "#861c12", albahaca: "#3d8b3d", albahacaClara: "#7cbf68",
  corte: "#6e3410",
};

// Dónde va cada ingrediente, en polares: [fracción del radio, grados desde arriba
// (en el sentido del reloj), y la albahaca su giro]. Fijos, nada de azar: el
// dibujo del manager y el del .pkpass tienen que salir idénticos. Repartidos por
// TODA la pizza y no por porción: así queda igual de bien con 6 trozos que con 12,
// y alguno cae encima de un corte, como en una de verdad.
const PEPPERONI = [[0.22, 35], [0.55, 8], [0.62, 70], [0.5, 130], [0.24, 200], [0.62, 185], [0.58, 252], [0.35, 300], [0.66, 322]];
const ALBAHACA = [[0.42, 100, 35], [0.44, 232, -40], [0.68, 290, 60], [0.12, 120, -10]];
const BURBUJAS = [[0.4, 60, 0.05], [0.72, 112, 0.035], [0.44, 165, 0.045], [0.74, 222, 0.04], [0.16, 300, 0.04], [0.7, 355, 0.035]];

/**
 * PIZZA — una pizza entera, redonda, partida en `meta` trozos: los ganados con
 * todo (masa, tomate, queso, pepperoni y albahaca) y los que faltan como la misma
 * pizza muy desvaída. Sin huecos entre trozos (31-10-2026): se lee como UNA pizza
 * a la que le faltan porciones, no como un abanico. Los cortes son rayas finas.
 */
function bandaPizza(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const cx = w * 0.33, cy = h / 2, r = h * 0.42;
  const id = idDe(tema, meta, sellos);
  const llenos = Math.min(Math.max(0, sellos), n);
  const en = (f, grados) => punto(cx, cy, r * f, ((grados - 90) * Math.PI) / 180);

  // Los trozos ganados van seguidos desde arriba: un solo sector para cada parte.
  const parte = (desde, hasta) =>
    hasta - desde >= n ? disco(cx, cy, r * 1.02) : sector(cx, cy, r * 1.02, RAD(desde, n), RAD(hasta, n));

  const pepperoni = PEPPERONI.map(([f, g]) => {
    const [x, y] = en(f, g);
    const rp = r * 0.1;
    return `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(rp)}" fill="${PIZZA.pepperoni}"`
      + ` stroke="${PIZZA.pepperoniOscuro}" stroke-width="${n2(rp * 0.14)}"/>`
      + `<circle cx="${n2(x + rp * 0.3)}" cy="${n2(y + rp * 0.25)}" r="${n2(rp * 0.13)}" fill="${PIZZA.pepperoniOscuro}" opacity="0.55"/>`
      + `<circle cx="${n2(x - rp * 0.25)}" cy="${n2(y + rp * 0.35)}" r="${n2(rp * 0.1)}" fill="${PIZZA.pepperoniOscuro}" opacity="0.45"/>`
      + `<ellipse cx="${n2(x - rp * 0.35)}" cy="${n2(y - rp * 0.4)}" rx="${n2(rp * 0.3)}" ry="${n2(rp * 0.16)}" fill="#ffffff" opacity="0.28"/>`;
  }).join("");

  const albahaca = ALBAHACA.map(([f, g, giro]) => {
    const [x, y] = en(f, g);
    const l = r * 0.11;
    return `<g transform="translate(${n2(x)} ${n2(y)}) rotate(${giro})">`
      + `<path d="M 0 ${n2(-l)} Q ${n2(l * 0.62)} 0 0 ${n2(l)} Q ${n2(-l * 0.62)} 0 0 ${n2(-l)} Z" fill="${PIZZA.albahaca}"/>`
      + `<path d="M 0 ${n2(-l * 0.8)} L 0 ${n2(l * 0.8)}" stroke="${PIZZA.albahacaClara}" stroke-width="${n2(l * 0.09)}" stroke-linecap="round"/></g>`;
  }).join("");

  const burbujas = BURBUJAS.map(([f, g, t]) => {
    const [x, y] = en(f, g);
    return `<ellipse cx="${n2(x)}" cy="${n2(y)}" rx="${n2(r * t * 1.4)}" ry="${n2(r * t)}" fill="${PIZZA.quesoClaro}" opacity="0.8"/>`;
  }).join("");

  // La pizza entera; luego se recorta en lo ganado y en lo que falta.
  const pizza = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="url(#${id}-masa)"/>`
    + `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.835)}" fill="${PIZZA.tomate}" opacity="0.85"/>`
    + `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.815)}" fill="url(#${id}-queso)"/>`
    + burbujas + pepperoni + albahaca;

  const defs = `<defs>`
    + `<radialGradient id="${id}-masa" cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" gradientUnits="userSpaceOnUse">`
    + `<stop offset="0.8" stop-color="${PIZZA.masaClara}"/><stop offset="0.92" stop-color="${PIZZA.masa}"/>`
    + `<stop offset="1" stop-color="${PIZZA.masaOscura}"/></radialGradient>`
    + `<radialGradient id="${id}-queso" cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.815)}" gradientUnits="userSpaceOnUse">`
    + `<stop offset="0" stop-color="${PIZZA.quesoClaro}"/><stop offset="0.65" stop-color="${PIZZA.queso}"/>`
    + `<stop offset="1" stop-color="${PIZZA.quesoBorde}"/></radialGradient>`
    + (llenos > 0 ? `<clipPath id="${id}-hecho"><path d="${parte(0, llenos)}"/></clipPath>` : "")
    + (llenos < n ? `<clipPath id="${id}-falta"><path d="${parte(llenos, n)}"/></clipPath>` : "")
    + `</defs>`;

  const hecho = llenos > 0 ? `<g clip-path="url(#${id}-hecho)">${pizza}</g>` : "";
  const falta = llenos < n
    ? `<g clip-path="url(#${id}-falta)" opacity="${esOscura(tema) ? 0.2 : 0.17}">${pizza}</g>`
    : "";
  // Los cortes, de punta a punta: finos, para que se vea UNA pizza partida.
  const cortes = n > 1
    ? Array.from({ length: n }, (_, i) => {
        const [x, y] = punto(cx, cy, r, RAD(i, n));
        return `<line x1="${n2(cx)}" y1="${n2(cy)}" x2="${n2(x)}" y2="${n2(y)}" stroke="${PIZZA.corte}"`
          + ` stroke-opacity="0.4" stroke-width="${n2(Math.max(2, r * 0.016))}" stroke-linecap="round"/>`;
      }).join("")
    : "";

  return defs + falta + hecho + cortes + cuenta(sellos, n, tema.accent, w * 0.74, cy, h * 0.32, w * 0.46);
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
  const id = idDe(tema, meta, sellos);

  const tramos = Array.from({ length: n }, (_, i) => {
    const pinta = i < sellos
      ? `fill="url(#${id}-br)"`
      : `fill="${tenue(tema)}" fill-opacity="${esOscura(tema) ? 0.16 : 0.14}"`;
    return `<rect x="${n2(x0 + i * (ancho + hueco))}" y="${n2(y)}" width="${n2(ancho)}"`
      + ` height="${n2(alto)}" rx="${n2(rx)}" ${pinta}/>`;
  }).join("");

  return `<defs>${brillo(`${id}-br`, color)}</defs>` + colocar(tema, color, w * 0.105, h / 2, h * 0.56)
    + tramos
    + cuenta(sellos, n, color, w * 0.855, h / 2, h * 0.3, w * 0.28);
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
  const id = idDe(tema, meta, sellos);

  const pista = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none"`
    + ` stroke="${tenue(tema)}" stroke-opacity="0.18" stroke-width="${n2(grosor)}"/>`;

  // Un arco de 360° empieza y acaba en el mismo punto, así que no se dibuja:
  // cerrado del todo es un círculo entero.
  const avance = parte >= 1
    ? `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none" stroke="url(#${id}-aro)" stroke-width="${n2(grosor)}"/>`
    : parte > 0
      ? `<path d="${arco(cx, cy, r, RAD(0, 1), RAD(0, 1) + parte * Math.PI * 2)}" fill="none"`
        + ` stroke="url(#${id}-aro)" stroke-width="${n2(grosor)}" stroke-linecap="round"/>`
      : "";

  const muescas = n <= 12
    ? Array.from({ length: n }, (_, i) => {
        const [x, y] = punto(cx, cy, r + grosor * 0.92, RAD(i, n));
        return `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(h * 0.022)}" fill="${tenue(tema)}"`
          + ` fill-opacity="${i < sellos ? 0.7 : 0.28}"/>`;
      }).join("")
    : "";

  const defs = `<defs>${halo(`${id}-luz`, color)}`
    + `<linearGradient id="${id}-aro" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${color}" stop-opacity="0.68"/>`
    + `<stop offset="1" stop-color="${color}" stop-opacity="1"/></linearGradient></defs>`;
  const brilla = parte > 0
    ? `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 1.85)}" fill="url(#${id}-luz)" opacity="${n2(0.25 + parte * 0.5)}"/>`
    : "";
  return defs + brilla + pista + avance + muescas
    + colocar(tema, color, cx, cy, r * 1.05)
    + cuenta(sellos, n, color, w * 0.74, cy, h * 0.32, w * 0.46);
}

/**
 * CIFRA — sin dibujo ninguno: el número, enorme, y una raya fina debajo. Para
 * marcas que no quieren monerías y para cartillas largas, donde cualquier
 * figura se convierte en confeti.
 */
function bandaCifra(tema, meta, sellos, w, h) {
  const n = Math.max(1, meta);
  const color = tema.accent;
  const parte = Math.min(1, Math.max(0, sellos / n));
  const unidad = (alto) => alto / (ALTO_GLIFO + GROSOR);

  const grande = `${sellos}`, resto = `/${n}`;
  const altoG = h * 0.54, altoR = h * 0.24;
  const anchoG = anchoDeTexto(grande.length) * unidad(altoG);
  const anchoR = anchoDeTexto(resto.length) * unidad(altoR);
  const hueco = h * 0.08;
  const izq = w * 0.5 - (anchoG + hueco + anchoR) / 2;
  const cy = h * 0.42;

  const raya = `<rect x="${n2(w * 0.12)}" y="${n2(h * 0.8)}" width="${n2(w * 0.76)}" height="${n2(h * 0.055)}"`
    + ` rx="${n2(h * 0.028)}" fill="${tenue(tema)}" fill-opacity="0.16"/>`
    + (parte > 0
      ? `<rect x="${n2(w * 0.12)}" y="${n2(h * 0.8)}" width="${n2(w * 0.76 * parte)}" height="${n2(h * 0.055)}"`
        + ` rx="${n2(h * 0.028)}" fill="${color}"/>`
      : "");

  return raya
    + svgTextoCuadrado(grande, { cx: izq + anchoG / 2, cy, alto: altoG, color, max: 3 })
    + svgTextoCuadrado(resto, { cx: izq + anchoG + hueco + anchoR / 2, cy: cy + h * 0.12, alto: altoR, color, max: 4 });
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
  anillos: bandaAnillos,
  cifra: bandaCifra,
};

export function svgStripSellos(temaGuardado, meta, sellos, estado = null) {
  const tema = temaDelPase(temaGuardado);
  const [w, alto] = TAM.strip.storeCard.map((v) => v * 3);
  const arriba = estado ? ALTO_ESTADO * 3 : 0;
  const h = alto - arriba;
  const llenos = Math.min(Math.max(0, sellos), meta);
  const pintar = PINTAR_BANDA[modo(tema)] || bandaCasillas;
  const id = idDe(tema, meta, llenos);
  return svg(w, alto, lineaDeEstado(tema, estado, w)
    + `<g transform="translate(0 ${arriba})">${fondoDeBanda(tema, w, h, id) + pintar(tema, meta, llenos, w, h)}</g>`);
}

export function svgStripCupon(temaGuardado, usado) {
  const tema = temaDelPase(temaGuardado);
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

/**
 * Dos cartillas en la misma banda, una por fila y cada una con su marca: la
 * tarjeta de papel con ocho galletas arriba y ocho cafés abajo. Las casillas
 * vacías llevan la marca en fantasma, como la tarjeta impresa antes de sellar:
 * sin ella no se sabría qué fila es cuál hasta el primer sello.
 *
 * Siempre en casillas, sea cual sea el `modo` del tema: una taza que se llena
 * no cabe dos veces en 123 puntos de alto.
 *
 * Margen lateral ancho a propósito: en el iPhone la tarjeta es más estrecha que
 * los 375 puntos de la banda y Wallet recorta los lados. Con ocho casillas por
 * fila pegadas al borde, la primera y la última salían cortadas.
 *
 * @param {object} tema
 * @param {{marca:string, meta:number, sellos:number}[]} filas
 */
export function svgStripCartillas(temaGuardado, filas, estado = null) {
  const tema = temaDelPase(temaGuardado);
  const [w, alto] = TAM.strip.storeCard.map((v) => v * 3);
  const arriba = estado ? ALTO_ESTADO * 3 : 0;
  const h = alto - arriba;
  const margen = estado ? 16 : 24; // arriba y abajo; con la línea de estado, algo menos
  const lateral = w * 0.09; // ~34 pt por lado: lo que el iPhone puede recortar, y aire
  const altoFila = (h - margen * 2) / filas.length;
  const color = String(tema.accent || "").replace(/[^0-9a-z]/gi, "");
  const id = `cartillas-${banda(tema)}-${color}-${filas.map((f) => `${f.marca}${f.meta}-${f.sellos}`).join("-")}`;

  const cuerpo = filas.map((f, fila) =>
    filaCasillas({ ...tema, forma: f.forma || tema.forma }, f, lateral, margen + altoFila * fila, w - lateral * 2, altoFila)).join("");

  return svg(w, alto, lineaDeEstado(tema, estado, w) + `<g transform="translate(0 ${arriba})">${fondoDeBanda(tema, w, h, id) + cuerpo}</g>`);
}

/**
 * Una fila de casillas de una cartilla, en la caja (x, y, ancho, alto): llenas
 * con su marca y vacías con la marca en fantasma, como la tarjeta impresa.
 */
function filaCasillas(tema, f, x, y, ancho, alto) {
  const oscura = esOscura(tema);
  const casilla = forma(tema);
  const conMarca = { ...tema, marca: f.marca };
  const paso = ancho / f.meta;
  const d = Math.min(paso, alto) * 0.8;
  const cy = y + alto / 2;
  return Array.from({ length: f.meta }, (_, i) => {
    const cx = x + paso * (i + 0.5);
    if (i < Math.min(f.sellos, f.meta)) {
      return oscura
        ? svgCasilla(casilla, cx, cy, d, `fill="${tema.accent}" fill-opacity="0.18" stroke="${tema.accent}" stroke-width="4"`)
          + colocar(conMarca, tema.accent, cx, cy, d * 0.8)
        : svgCasilla(casilla, cx, cy, d, `fill="${tema.accent}"`) + colocar(conMarca, tintaSobre(tema), cx, cy, d * 0.78);
    }
    const trazo = oscura ? "#ffffff" : tema.accent;
    return svgCasilla(casilla, cx, cy, d - 6, `fill="none" stroke="${trazo}" stroke-opacity="${oscura ? 0.2 : 0.45}" stroke-width="4" stroke-dasharray="12 9"`)
      + `<g opacity="${oscura ? 0.16 : 0.2}">${colocar(conMarca, trazo, cx, cy, d * 0.62)}</g>`;
  }).join("");
}

/**
 * Un modo cualquiera dentro de un trozo de la banda: el mismo dibujo que en una
 * tienda de una cartilla, pero en su caja. Va en un <svg> anidado, que recorta
 * lo que se salga, y con los ids renombrados: dos cartillas con el mismo modo y
 * la misma marca no pueden compartir degradados ni recortes.
 */
// La forma de caja que aguanta cada modo (ancho ÷ alto). Más estrecha que el
// mínimo, el dibujo se come la cifra (la tarta mide lo que el alto); más ancha
// que el máximo, una figura redonda se queda sola en una punta. Lo medido en
// las hojas de prueba: las de dibujo redondo, entre 2,6 y 3,6; la barra lleva
// la marca a la izquierda y pide 3; las de fila se estiran lo que haga falta.
const ASPECTO = {
  relleno: [2.5, 3.6], porciones: [2.6, 3.6], pizza: [2.6, 3.6], anillos: [2.6, 3.6], cifra: [1, 4.5],
  barra: [3, Infinity],
};

function trozoDeBanda(tema, modo, f, x0, y0, anchoCaja, altoCaja, sufijo) {
  // La caja del modo, centrada en la que le toca: ni más estrecha ni más ancha de lo que aguanta.
  const [minimo, maximo] = ASPECTO[modo] || [1, Infinity];
  let ancho = anchoCaja;
  let alto = altoCaja;
  if (ancho / alto < minimo) alto = ancho / minimo;
  if (ancho / alto > maximo) ancho = alto * maximo;
  const x = x0 + (anchoCaja - ancho) / 2;
  const y = y0 + (altoCaja - alto) / 2;
  const pintar = PINTAR_BANDA[modo] || bandaCasillas;
  const temaTrozo = { ...tema, marca: f.marca, modo, forma: f.forma || tema.forma };
  const llenos = Math.min(Math.max(0, f.sellos), f.meta);
  const cuerpo = pintar(temaTrozo, f.meta, llenos, ancho, alto)
    .replace(/id="([^"]+)"/g, `id="$1-${sufijo}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${sufijo})`);
  return `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(ancho)}" height="${n2(alto)}" overflow="hidden">${cuerpo}</svg>`;
}

/**
 * DOS CARTILLAS, CADA UNA CON SU MODO. Arriba y abajo (`filas`) o una al lado de
 * otra (`lados`). Dos combinaciones tienen dibujo propio, el de siempre: dos
 * filas de casillas (svgStripCartillas) y dos dibujos que se llenan con las
 * cuentas en el centro (svgStripLlenar). El resto, cada cartilla pinta su modo
 * en su mitad, con una raya fina entre las dos.
 *
 * Margen lateral ancho: Wallet recorta los lados de la banda en el iPhone.
 */
export function svgStripDoble(temaGuardado, filas, estado = null) {
  const tema = temaDelPase(temaGuardado);
  const { doble } = piezasDeTema(tema);
  const modos = filas.map((f) => modoDeCartilla(tema, f));
  if (doble === "filas" && modos.every((m) => m === "casillas")) return svgStripCartillas(tema, filas, estado);
  if (doble === "lados" && modos.every((m) => m === "relleno")) return svgStripLlenar(tema, filas, estado);

  const [w, alto] = TAM.strip.storeCard.map((v) => v * 3);
  const arriba = estado ? ALTO_ESTADO * 3 : 0;
  const h = alto - arriba;
  const hex = String(tema.accent || "").replace(/[^0-9a-z]/gi, "");
  const id = `doble-${doble}-${banda(tema)}-${hex}-${filas.map((f, i) => `${modos[i]}${f.marca}${f.meta}-${f.sellos}`).join("-")}`;
  const lateral = w * 0.06;
  let cuerpo;
  let raya;
  if (doble === "filas") {
    const margen = estado ? 10 : 18;
    const altoFila = (h - margen * 2) / filas.length;
    cuerpo = filas.map((f, i) => (modos[i] === "casillas"
      ? filaCasillas({ ...tema, forma: f.forma || tema.forma }, f, w * 0.09, margen + altoFila * i, w * 0.82, altoFila)
      : trozoDeBanda(tema, modos[i], f, lateral, margen + altoFila * i, w - lateral * 2, altoFila, `${id}-${i}`))).join("");
    raya = `<rect x="${n2(w * 0.2)}" y="${n2(h / 2 - 1.5)}" width="${n2(w * 0.6)}" height="3" rx="1.5" fill="${tenue(tema)}" fill-opacity="0.16"/>`;
  } else {
    const mitad = (w - lateral * 2) / 2;
    cuerpo = filas.map((f, i) => trozoDeBanda(tema, modos[i], f, lateral + mitad * i, 0, mitad, h, `${id}-${i}`)).join("");
    raya = `<rect x="${n2(w / 2 - 3)}" y="${n2(h * 0.2)}" width="6" height="${n2(h * 0.6)}" rx="3" fill="${tenue(tema)}" fill-opacity="0.2"/>`;
  }
  return svg(w, alto, lineaDeEstado(tema, estado, w)
    + `<g transform="translate(0 ${arriba})">${fondoDeBanda(tema, w, h, id) + cuerpo + raya}</g>`);
}

/**
 * Dos cartillas que se LLENAN, una a cada lado: la galleta a la izquierda y la
 * taza a la derecha, en el mismo orden que sus campos bajo la banda (COOKIES |
 * CAFÉS). La cuenta de cada una va hacia el centro, pegada a SU dibujo, y una
 * raya fina las separa: "5/8 | 3/8" se lee como dos marcadores, no como una
 * fracción rara.
 *
 * Los dibujos no van al borde: Wallet recorta los lados de la banda en el iPhone.
 *
 * @param {object} tema
 * @param {{marca:string, meta:number, sellos:number}[]} filas  (dos)
 */
export function svgStripLlenar(temaGuardado, filas, estado = null) {
  const tema = temaDelPase(temaGuardado);
  const [w, alto] = TAM.strip.storeCard.map((v) => v * 3);
  const arriba = estado ? ALTO_ESTADO * 3 : 0;
  const h = alto - arriba;
  const color = tema.accent;
  const hex = String(color || "").replace(/[^0-9a-z]/gi, "");
  // Los premios guardados de cada una, dibujados bajo su cuenta (como mucho
  // GUARDADOS_A_LA_VISTA): solo los que tiene, sin huecos claros para los que no.
  const enBanda = filas.map((f) => Math.min(GUARDADOS_A_LA_VISTA, Math.max(0, f.guardados || 0)));
  const id = `llenar-${banda(tema)}-${hex}-${filas.map((f, i) => `${f.marca}${f.meta}-${f.sellos}g${enBanda[i]}`).join("-")}`;
  const cy = h / 2;
  const centro = w / 2;

  // Con la línea de estado arriba hay menos alto: los dibujos encogen con él.
  // Y no más grandes: una taza con asa es más ancha que alta y se comería la cifra.
  const altoTinta = h * 0.6;
  const lados = [w * 0.2, w * 0.8];
  const dibujos = filas.map((f, i) => {
    const parte = f.meta > 0 ? Math.min(1, Math.max(0, f.sellos / f.meta)) : 0;
    return queSeLlena({ ...tema, marca: f.marca }, lados[i], cy, altoTinta, parte, `${id}-${i}`);
  }).join("");

  const raya = `<rect x="${n2(centro - 3)}" y="${n2(h * 0.26)}" width="6" height="${n2(h * 0.48)}" rx="3"`
    + ` fill="${tenue(tema)}" fill-opacity="0.22"/>`;

  // La cifra grande y "/8" pequeño, apoyados en la misma línea base. Entre el
  // dibujo y la raya caben "5/8" a tamaño entero; "12/20" no: las dos cuentas
  // encogen lo mismo (si una fuera más grande, parecería que importa más).
  const hueco = w * 0.04;
  const sitio = w * 0.5 - hueco - w * 0.315;
  const textos = filas.map((f) => [String(Math.min(Math.max(0, f.sellos), f.meta)), `/${f.meta}`]);
  const anchoA = (tam, [hechos, total]) => anchoTexto(hechos, tam * 0.36) + tam * 0.36 * 0.04 + anchoTexto(total, tam * 0.2);
  const escala = Math.min(1, ...textos.map((t) => sitio / anchoA(h, t)));
  const grande = h * 0.36 * escala, pequeno = h * 0.2 * escala;
  // Con guardados, la cuenta sube para que cifra y dibujitos queden centrados juntos;
  // las dos a la misma altura aunque solo un lado tenga, como marcadores gemelos.
  const altoMini = h * 0.13, separa = h * 0.06;
  const sube = enBanda.some((g) => g > 0) ? (separa + altoMini) / 2 : 0;
  const base = cy + (grande * ALTO_MAYUSCULA) / EM / 2 - sube;
  const cuentas = textos.map(([hechos, total], i) => {
    const anchoG = anchoTexto(hechos, grande);
    const ancho = anchoG + grande * 0.04 + anchoTexto(total, pequeno);
    const x = i === 0 ? centro - hueco - ancho : centro + hueco;
    return svgTexto(hechos, { x, y: base, tam: grande, color })
      + svgTexto(total, { x: x + anchoG + grande * 0.04, y: base, tam: pequeno, color, opacidad: 0.6 });
  }).join("");
  // Pegados a la raya, como la cuenta (el de la izquierda, de la raya hacia fuera),
  // y colocados por su TINTA: una taza con asa no ocupa lo que su lienzo. Si tres
  // no caben en el hueco de la cuenta, encogen los dos lados lo mismo.
  const marcas = filas.map((f) => tintaDeMarca({ ...tema, marca: f.marca }));
  const separaMini = altoMini * 0.3;
  const anchoFila = (m, n) => n * altoMini * m.ancho + Math.max(0, n - 1) * separaMini;
  const encoge = Math.min(1, ...marcas.map((m, i) => (enBanda[i] ? sitio / anchoFila(m, enBanda[i]) : 1)));
  const alto1 = altoMini * encoge, separa1 = separaMini * encoge;
  const cyMini = base + separa + altoMini / 2;
  const guardados = filas.map((f, i) => {
    const { ancho, centroX, lado } = marcas[i];
    const tinta = alto1 * ancho;
    return Array.from({ length: enBanda[i] }, (_, k) => {
      const borde = i === 0 ? centro - hueco - k * (tinta + separa1) - tinta : centro + hueco + k * (tinta + separa1);
      const cx = borde + tinta / 2 - centroX * alto1;
      return colocar({ ...tema, marca: f.marca }, color, cx, cyMini, lado * alto1);
    }).join("");
  }).join("");

  return svg(w, alto, lineaDeEstado(tema, estado, w)
    + `<g transform="translate(0 ${arriba})">${fondoDeBanda(tema, w, h, id) + dibujos + raya + cuentas + guardados}</g>`);
}

/** Cuántos premios guardados se dibujan bajo la cuenta; los demás los dice su campo («5 gratis»). */
export const GUARDADOS_A_LA_VISTA = 3;

/**
 * La tinta de una marca por cada punto de alto: `lado` (el lienzo de 512),
 * `ancho` y `centroX` (lo que se aparta del centro del lienzo), para colocarla
 * por lo que se ve y no por el cuadrado que la contiene.
 */
function tintaDeMarca(tema) {
  const { nombre } = marcaDe(tema);
  const [y0, y1, x0 = CAJA_POR_DEFECTO[2], x1 = CAJA_POR_DEFECTO[3]] = CAJA[nombre] || CAJA_PROPIA[nombre] || CAJA_POR_DEFECTO;
  const lado = 512 / (y1 - y0);
  return { lado, ancho: ((x1 - x0) / 512) * lado, centroX: (((x0 + x1) / 2 - 256) / 512) * lado };
}

// ------------------------------------------------------ abierto / cerrado
// Un pase no tiene sitio para una línea bajo el nombre de la tienda: la cabecera
// es logo + nombre + campos a la derecha. Así que se DIBUJA en lo alto de la
// banda, sobre el color de la tarjeta (el mismo `backgroundColor` del pase): se
// lee como parte de la cabecera y la "foto" de la banda siguen siendo los
// sellos, que bajan un poco para dejarle sitio.
//
// Un punto verde o rojo y la frase, como en Mapas. Las letras son las de Inter
// dibujadas (lib/apple/texto.js): nada de <text>, que en serverless no hay fuentes.

/** Alto de la línea, en puntos (de los 123 de la banda). */
export const ALTO_ESTADO = 22;
// Dónde empieza la frase: bajo el nombre de la tienda, que en el iPhone va a la
// derecha del logo; el punto queda colgando a su izquierda, como en Mapas.
// Wallet recorta algo los lados de la banda, así que no se pega al borde.
const X_ESTADO = 56;
const TAM_ESTADO = 12.5;
// Los de sistema de iOS: se ven en tarjetas claras y oscuras (como AbiertoAhora).
const PUNTO_ESTADO = { abierta: "#34c759", cerrada: "#ff453a" };

function lineaDeEstado(tema, estado, w) {
  if (!estado) return "";
  const alto = ALTO_ESTADO * 3;
  const tam = TAM_ESTADO * 3;
  const base = alto * 0.66;
  const r = 3.4 * 3;
  const x = X_ESTADO * 3;
  const tinta = tema.ink || "#111111";
  const cx = x - r - 5 * 3;
  const cy = n2(base - tam * 0.36);
  // Con un aro blanco: el verde y el rojo chocan con fondos de su mismo tono
  // (la tarjeta verde, la caramelo, una foto) y el aro los separa de cualquiera.
  return `<rect width="${w}" height="${alto}" fill="${tema.cardBg || "#ffffff"}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${n2(r + 1.5 * 3)}" fill="#ffffff"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${estado.abierta ? PUNTO_ESTADO.abierta : PUNTO_ESTADO.cerrada}"/>`
    + svgTexto(estado.texto, { x, y: base, tam, color: tinta, opacidad: 0.72 });
}

/** La banda que le toca a este cliente, con su tamaño en puntos. */
/**
 * `estado` ({abierta, texto} de estadoParaPase): la línea "● Abierto hasta las
 * 14:00" en lo alto. Solo en el pase de Wallet y su vista previa; la tarjeta web
 * lo dice sola (AbiertoAhora). Los cupones no la llevan: su banda va bajo el
 * descuento, no bajo el nombre.
 */
export function stripDelPase(negocio, cliente, { estado = null } = {}) {
  const esCupon = negocio.tipo === "descuento";
  const [ancho, alto] = esCupon ? TAM.strip.coupon : TAM.strip.storeCard;
  let dibujo;
  if (esCupon) dibujo = svgStripCupon(negocio.tema, (cliente.premios || 0) > 0);
  else if (negocio.cartillas) {
    dibujo = svgStripDoble(negocio.tema, cartillasDe(cliente, negocio), estado);
  }
  else dibujo = svgStripSellos(negocio.tema, negocio.meta, Math.min(cliente.sellos ?? 0, negocio.meta), estado);
  return { svg: dibujo, ancho, alto };
}

/** SVG -> data URI, para pintarlo en un <img>. */
export const comoDataUri = (svgTexto) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svgTexto)}`;
