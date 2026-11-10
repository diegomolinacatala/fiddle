// ============================================================================
// Genera las imágenes de la marca, todas del lacre de src/lib/lacre.js y con
// los colores de src/app/home/paleta.js:
//
//   public/marcas/fiddle.svg        icono de la pestaña
//   public/marcas/fiddle-180.png    icono al guardar la web en el iPhone
//   public/marcas/fiddle-192.png    y en Android (el manifest, lib/marcaFiddle.js),
//   public/marcas/fiddle-512.png    con su versión «adaptable», que lleva aire
//   public/marcas/fiddle-*-adaptable.png  porque Android la recorta en círculo
//   public/marcas/fiddle-og.png     la vista previa al mandar el enlace por WhatsApp
//   docs/marca/fiddle-lacre.svg     el logo para subir donde haga falta (Google
//   docs/marca/fiddle-lacre-1024.png  Wallet lo enseña recortado en círculo)
//   docs/marca/fiddle-lacre-nombre.svg  el sello con el nombre
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
import { svgLacre, svgIconoLacre, svgLogoLacre, LACRE, NOMBRE } from "../src/lib/lacre.js";
import { PALETA as P } from "../src/app/home/paleta.js";

const require = createRequire(import.meta.url);
const ruta = (rel) => fileURLToPath(new URL(rel, import.meta.url));

// Icono: el lacre avena sobre el verde (6,4:1), con esquinas para la pestaña.
const pestana = svgIconoLacre({ color: P.avena, fondo: P.verde, radio: 230 });
writeFileSync(ruta("../public/marcas/fiddle.svg"), `${pestana}\n`);
// El iPhone y Google redondean ellos: aquí, cuadrado entero.
const cuadrado = svgIconoLacre({ color: P.avena, fondo: P.verde });
for (const lado of [180, 192, 512]) {
  await sharp(Buffer.from(cuadrado)).resize(lado, lado).png().toFile(ruta(`../public/marcas/fiddle-${lado}.png`));
}
// Android enseña solo el círculo central (el 80 %): el sello, más pequeño.
const adaptable = svgIconoLacre({ color: P.avena, fondo: P.verde, alto: 0.6 });
for (const lado of [192, 512]) {
  await sharp(Buffer.from(adaptable)).resize(lado, lado).png().toFile(ruta(`../public/marcas/fiddle-${lado}-adaptable.png`));
}
// Google lo recorta en círculo: con aire, como el adaptable.
const paraSubir = svgIconoLacre({ color: P.avena, fondo: P.verde, alto: 0.66 });
writeFileSync(ruta("../docs/marca/fiddle-lacre.svg"), `${paraSubir}\n`);
await sharp(Buffer.from(paraSubir)).resize(1024, 1024).png().toFile(ruta("../docs/marca/fiddle-lacre-1024.png"));
const n = NOMBRE.encuadre;
writeFileSync(ruta("../docs/marca/fiddle-lacre-nombre.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n.x} ${n.y} ${n.ancho} ${n.alto}">${svgLogoLacre({ color: P.verde })}</svg>\n`);

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
const punto = `<circle cx="${titular.x + titular.ancho + 10}" cy="${BASE - 8.5}" r="8.5" fill="${P.avena}"/>`;
const sub = texto(media, "Tarjetas de fidelización en Apple Wallet y Android", { cx: W / 2, y: BASE + 70, tam: 30, color: P.papel, opacidad: 0.72, tracking: -0.01 });
const { x, y, ancho, alto } = LACRE.encuadre;
const altoSello = 168;
const anchoSello = (altoSello * ancho) / alto;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${P.verde}"/>
  <svg x="${(W - anchoSello) / 2}" y="104" width="${anchoSello}" height="${altoSello}" viewBox="${x} ${y} ${ancho} ${alto}">${svgLacre({ color: P.avena })}</svg>
  ${titular.svg}${punto}${sub.svg}
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(ruta("../public/marcas/fiddle-og.png"));

console.log("Hecho: iconos y vista previa en public/marcas/, logo en docs/marca/");
