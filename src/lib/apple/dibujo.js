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
// Sin texto en los SVG: en serverless no hay fuentes fiables.
// ============================================================================

export const TAM = {
  icon: 29, // + @2x 58, @3x 87 (obligatorio)
  logo: 50, // cuadrado; Apple permite hasta 160x50
  strip: { storeCard: [375, 123], coupon: [375, 144] },
};

// Marcas vectoriales en un lienzo de 512x512 (mismas que los iconos PWA).
const MARCAS = {
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
};

const marca = (estilo, color) => (MARCAS[estilo] || MARCAS.coffee)(color);

// Coloca una marca 512x512 centrada en (cx, cy) con lado `lado`.
const colocar = (estilo, color, cx, cy, lado) =>
  `<g transform="translate(${cx - lado / 2} ${cy - lado / 2}) scale(${lado / 512})">${marca(estilo, color)}</g>`;

const svg = (w, h, cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cuerpo}</svg>`;

// ---------------------------- icono y logo ----------------------------
export function svgIcono(tema) {
  const lado = TAM.icon * 3;
  const fondo = tema.estilo === "barber" ? "#17171c" : tema.accent;
  const trazo = tema.estilo === "barber" ? tema.accent : "#ffffff";
  return svg(lado, lado, `<rect width="${lado}" height="${lado}" rx="${lado * 0.22}" fill="${fondo}"/>${colocar(tema.estilo, trazo, lado / 2, lado / 2, lado * 0.9)}`);
}

export function svgLogo(tema) {
  const lado = TAM.logo * 3;
  return svg(lado, lado, colocar(tema.estilo, tema.accent, lado / 2, lado / 2, lado));
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

export function svgStripSellos(tema, meta, sellos) {
  const [w, h] = TAM.strip.storeCard.map((v) => v * 3);
  const oscuro = tema.estilo === "barber";
  const fondo = oscuro
    ? `<rect width="${w}" height="${h}" fill="#101013"/><rect width="18" height="${h}" fill="url(#poste)"/>`
    : `<rect width="${w}" height="${h}" fill="${tema.accent}" opacity="0.10"/>`;
  const defs = `<defs><pattern id="poste" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="36" fill="${tema.accent}"/></pattern></defs>`;

  const puntos = rejillaSellos(meta, w, h, 36).map(({ cx, cy, d }, i) => {
    const lleno = i < sellos;
    const r = d / 2;
    if (oscuro) {
      const x = cx - r, y = cy - r, radio = d * 0.18;
      return lleno
        ? `<rect x="${x}" y="${y}" width="${d}" height="${d}" rx="${radio}" fill="${tema.accent}" fill-opacity="0.18" stroke="${tema.accent}" stroke-width="4"/>${colocar(tema.estilo, tema.accent, cx, cy, d * 0.8)}`
        : `<rect x="${x}" y="${y}" width="${d}" height="${d}" rx="${radio}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="3"/>`;
    }
    return lleno
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${tema.accent}"/>${colocar(tema.estilo, "#ffffff", cx, cy, d * 0.78)}`
      : `<circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="none" stroke="${tema.accent}" stroke-opacity="0.45" stroke-width="5" stroke-dasharray="14 10"/>`;
  });

  return svg(w, h, defs + fondo + puntos.join(""));
}

export function svgStripCupon(tema, usado) {
  const [w, h] = TAM.strip.coupon.map((v) => v * 3);
  // Porciones solo a la derecha: a la izquierda Apple pinta el texto del descuento.
  const porciones = [0, 1, 2]
    .map((i) => colocar(tema.estilo, "#ffffff", 700 + i * 170, h / 2 + (i % 2 ? 50 : -50), 240))
    .join("");
  return svg(w, h, `
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd54a"/><stop offset="0.55" stop-color="#ff7a18"/><stop offset="1" stop-color="${tema.accent}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <g opacity="${usado ? 0.35 : 1}">${porciones}</g>`);
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
