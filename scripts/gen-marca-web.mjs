// ============================================================================
// Genera las imágenes de la web de fiddle (/home), en public/marcas/:
//
//   fiddle.svg       icono de la pestaña (el logo con las esquinas redondeadas)
//   fiddle-180.png   icono al guardarla en la pantalla de inicio del iPhone
//   fiddle-og.png    la vista previa al mandar el enlace por WhatsApp
//
// Salen del logo (docs/marca/fiddle-logo.svg). Las letras de la vista previa se
// convierten en trazos con Inter: sharp no tiene por qué tener la fuente.
// public/marcas/ no pasa por el middleware (si no, pedirían sesión).
//
//   node scripts/gen-marca-web.mjs
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const DESTINO = new URL("../public/marcas/", import.meta.url);
const TINTA = "#1d1b2e";
const CREMA = "#fff7ea";
const ROSA = "#ff5c8a";

// El logo tal cual, sin su cuadrado de fondo.
const LETRA = `
  <g transform="translate(512 512) scale(1.15) translate(-526 -530)">
    <path d="M452 770 V430 Q452 290 592 290 H640" fill="none" stroke="FILL" stroke-width="118" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M330 475 H560" fill="none" stroke="FILL" stroke-width="118" stroke-linecap="round"/>
    <circle cx="672" cy="737" r="92" fill="${ROSA}"/>
  </g>`;
const marca = (fondo, letra, radio) =>
  `<rect width="1024" height="1024" rx="${radio}" fill="${fondo}"/>${LETRA.replaceAll("FILL", letra)}`;

const icono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${marca(TINTA, CREMA, 230)}</svg>\n`;
writeFileSync(new URL("fiddle.svg", DESTINO), icono);

// El iPhone redondea él solo las esquinas: aquí, cuadrado entero.
const cuadrado = readFileSync(new URL("../docs/marca/fiddle-logo.svg", import.meta.url));
await sharp(cuadrado).resize(180, 180).png().toFile(fileURLToPath(new URL("fiddle-180.png", DESTINO)));

// ---- vista previa del enlace (1200x630) ----
const fuente = (peso) => opentype.loadSync(require.resolve(`@fontsource/inter/files/inter-latin-${peso}-normal.woff`));
const seminegrita = fuente(600);
const media = fuente(500);

/** Texto como trazo, centrado en `cx`, con el espaciado apretado de los titulares. */
function texto(f, cadena, { cx, y, tam, color, tracking = 0, opacidad = 1 }) {
  const opciones = { kerning: true, letterSpacing: tracking };
  const ancho = f.getAdvanceWidth(cadena, tam, opciones);
  const d = f.getPath(cadena, cx - ancho / 2, y, tam, opciones).toPathData(2);
  return { svg: `<path d="${d}" fill="${color}" fill-opacity="${opacidad}"/>`, ancho, x: cx - ancho / 2 };
}

const W = 1200;
const H = 630;
const titular = texto(seminegrita, "Sellos que no se pierden", { cx: W / 2 - 10, y: 398, tam: 84, color: CREMA, tracking: -0.04 });
const punto = `<circle cx="${titular.x + titular.ancho + 10}" cy="${398 - 9}" r="9" fill="${ROSA}"/>`;
const sub = texto(media, "Tarjetas de fidelización en Apple Wallet y Android", { cx: W / 2, y: 470, tam: 30, color: CREMA, opacidad: 0.7, tracking: -0.01 });
const lado = 132;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${TINTA}"/>
  <svg x="${(W - lado) / 2}" y="132" width="${lado}" height="${lado}" viewBox="0 0 1024 1024">${marca(CREMA, TINTA, 230)}</svg>
  ${titular.svg}${punto}${sub.svg}
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL("fiddle-og.png", DESTINO)));

console.log("Hecho: public/marcas/fiddle.svg, fiddle-180.png y fiddle-og.png");
