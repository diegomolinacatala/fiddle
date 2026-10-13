// ============================================================================
// EL VIOLÍN DE FIDDLE
// ----------------------------------------------------------------------------
// La marca: la caja de un violín, de frente, con el arranque del mástil y UNA
// efe recortada. Los agujeros del violín se llaman efes: la «f» de fiddle sale
// del propio instrumento. Una sola pieza de un color, sin detalles que se
// pierdan en pequeño (a 16 px queda la silueta, que ya se lee).
//
// Lo usan LogoFiddle (web y login) y scripts/gen-marca-web.mjs (iconos y vista
// previa de WhatsApp). Si cambia el dibujo, se cambia aquí y se vuelven a
// generar las imágenes.
// ============================================================================

// Coordenadas propias: la caja va de y=0 (hombros) a y=364 (abajo), centrada en
// x=0. Las cuatro puntas de la cintura son lo que la separa de una guitarra.
export const VIOLIN = {
  caja:
    "M0 0 C40 0 84 18 86 66 C88 104 80 132 70 150 C55 150 49 164 49 182 C49 200 55 214 72 214 "
    + "C84 232 108 244 108 284 C108 334 66 364 0 364 C-66 364 -108 334 -108 284 C-108 244 -84 232 -72 214 "
    + "C-55 214 -49 200 -49 182 C-49 164 -55 150 -70 150 C-80 132 -88 104 -86 66 C-84 18 -40 0 0 0 Z",
  mastil: { x: -17, y: -46, ancho: 34, alto: 64, radio: 11 },
  // La efe: el trazo en ese, sus dos ojos y la muesca del medio (lo que la hace «f»).
  efe: {
    trazo: "M28 160 C42 184 24 214 41 242",
    grosor: 11,
    ojos: [[28, 160, 10.5], [41, 242, 11.5]],
    muesca: "M24 201 H41",
    grosorMuesca: 8.5,
  },
  // Lo que ocupa todo junto, para encuadrarlo.
  encuadre: { x: -108, y: -46, ancho: 216, alto: 410 },
};

const { mastil: M, efe: E, encuadre: B } = VIOLIN;

/** La efe en negro, para la máscara que la recorta. */
const efeEnMascara = () =>
  `<path d="${E.trazo}" fill="none" stroke="#000" stroke-width="${E.grosor}" stroke-linecap="round"/>`
  + E.ojos.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#000"/>`).join("")
  + `<path d="${E.muesca}" stroke="#000" stroke-width="${E.grosorMuesca}" stroke-linecap="round"/>`;

/**
 * El violín como trozo de SVG (sin la etiqueta <svg>), en sus coordenadas.
 * `id`: el de la máscara; tiene que ser único en el documento.
 */
export function svgViolin({ color, id = "efe" }) {
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${B.x - 20}" y="${B.y - 20}" width="${B.ancho + 40}" height="${B.alto + 40}">`
    + `<rect x="${B.x - 20}" y="${B.y - 20}" width="${B.ancho + 40}" height="${B.alto + 40}" fill="#fff"/>${efeEnMascara()}</mask></defs>`
    + `<g mask="url(#${id})" fill="${color}"><path d="${VIOLIN.caja}"/>`
    + `<rect x="${M.x}" y="${M.y}" width="${M.ancho}" height="${M.alto}" rx="${M.radio}"/></g>`;
}

/**
 * Icono cuadrado: el violín centrado sobre un fondo (con esquinas `radio`, de
 * 1024). Para la pestaña, el iPhone y Google Wallet.
 */
export function svgIconoViolin({ color, fondo, radio = 0, alto = 0.66 }) {
  const lado = 1024;
  const escala = (lado * alto) / B.alto;
  const x = lado / 2 - (B.x + B.ancho / 2) * escala;
  const y = lado / 2 - (B.y + B.alto / 2) * escala;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}">`
    + `<rect width="${lado}" height="${lado}" rx="${radio}" fill="${fondo}"/>`
    + `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${escala.toFixed(4)})">${svgViolin({ color, id: "efe-icono" })}</g></svg>`;
}
