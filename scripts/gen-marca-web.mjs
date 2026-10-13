// ============================================================================
// Genera las imágenes de la marca, todas del violín de src/lib/violin.js y con
// los colores de src/app/home/paleta.js:
//
//   public/marcas/fiddle.svg        icono de la pestaña
//   public/marcas/fiddle-180.png    icono al guardar la web en el iPhone
//   public/marcas/fiddle-og.png     la vista previa al mandar el enlace por WhatsApp
//   docs/marca/fiddle-violin.svg    el logo para subir donde haga falta (Google
//   docs/marca/fiddle-violin-1024.png  Wallet lo enseña recortado en círculo)
//
// Las letras de la vista previa se convierten en trazos con Inter: sharp no tiene
// por qué tener la fuente. public/marcas/ no pasa por el middleware (si no,
// pedirían sesión).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/gen-marca-web.mjs
// ============================================================================

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";
import { svgViolin, svgIconoViolin, VIOLIN } from "../src/lib/violin.js";
import { PALETA as P } from "../src/app/home/paleta.js";

const require = createRequire(import.meta.url);
const ruta = (rel) => fileURLToPath(new URL(rel, import.meta.url));

// Icono: el violín de nogal sobre la salvia (5,7:1), con esquinas para la pestaña.
const pestana = svgIconoViolin({ color: P.nogal, fondo: P.salvia, radio: 230 });
writeFileSync(ruta("../public/marcas/fiddle.svg"), `${pestana}\n`);
// El iPhone y Google redondean ellos: aquí, cuadrado entero.
const cuadrado = svgIconoViolin({ color: P.nogal, fondo: P.salvia });
await sharp(Buffer.from(cuadrado)).resize(180, 180).png().toFile(ruta("../public/marcas/fiddle-180.png"));
writeFileSync(ruta("../docs/marca/fiddle-violin.svg"), `${cuadrado}\n`);
await sharp(Buffer.from(cuadrado)).resize(1024, 1024).png().toFile(ruta("../docs/marca/fiddle-violin-1024.png"));

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
const BASE = 410;
const titular = texto(seminegrita, "Clientes que no se pierden", { cx: W / 2 - 10, y: BASE, tam: 80, color: P.papel, tracking: -0.04 });
const punto = `<circle cx="${titular.x + titular.ancho + 10}" cy="${BASE - 8.5}" r="8.5" fill="${P.salvia}"/>`;
const sub = texto(media, "Tarjetas de fidelización en Apple Wallet y Android", { cx: W / 2, y: BASE + 70, tam: 30, color: P.papel, opacidad: 0.72, tracking: -0.01 });
const { x, y, ancho, alto } = VIOLIN.encuadre;
const altoViolin = 168;
const anchoViolin = (altoViolin * ancho) / alto;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${P.carbon}"/>
  <svg x="${(W - anchoViolin) / 2}" y="104" width="${anchoViolin}" height="${altoViolin}" viewBox="${x} ${y} ${ancho} ${alto}">${svgViolin({ color: P.salvia })}</svg>
  ${titular.svg}${punto}${sub.svg}
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(ruta("../public/marcas/fiddle-og.png"));

console.log("Hecho: iconos y vista previa en public/marcas/, logo en docs/marca/");
