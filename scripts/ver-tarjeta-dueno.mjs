// ============================================================================
// Para MIRAR la tarjeta del dueño antes de firmarla. Con un informe de ejemplo
// escribe en la carpeta que se le diga:
//
//   strip.png    la banda, a 3x
//   icono.png    el icono de los avisos
//   logo.png     el logo de la cabecera
//   maqueta.png  la tarjeta entera, a 3x (una maqueta: no clava la tipografía de iOS)
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ver-tarjeta-dueno.mjs <carpeta>
//
// Los módulos de src/lib importan sin extensión (los resuelve Next), así que
// se registra un resolvedor que prueba con «.js».
// ============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { resolve as rutaAbsoluta, join } from "node:path";
import sharp from "sharp";

const resolvedor = `export async function resolve(esp, ctx, siguiente) {
  try { return await siguiente(esp, ctx); }
  catch (e) {
    if (esp.startsWith(".") && !esp.endsWith(".js")) return siguiente(esp + ".js", ctx);
    throw e;
  }
}`;
register(`data:text/javascript,${encodeURIComponent(resolvedor)}`, import.meta.url);

const { svgStripDueno, svgIconoDueno, svgLogoDueno, COLORES_DUENO } = await import("../src/lib/dueno/dibujo.js");
const { camposDelDueno } = await import("../src/lib/dueno/pase.js");
const { svgTexto, anchoTexto } = await import("../src/lib/apple/texto.js");
const { PALETA } = await import("../src/app/home/paleta.js");

const salida = rutaAbsoluta(process.argv[2] || "vista-dueno");
mkdirSync(salida, { recursive: true });

const informe = {
  desde: "2026-11-09", hasta: "2026-11-15", etiqueta: "9 al 15 nov",
  visitas: 142, visitasAntes: 130, nuevos: 9, nuevosAntes: 7, premios: 6, premiosAntes: 6,
  porDia: [21, 24, 26, 22, 31, 8, 0].map((n, d) => ({ fecha: `2026-11-${9 + d}`, d, n, cerrado: d === 6 })),
  mejorDia: { d: 4, n: 31 },
};
const aviso = {
  texto: "Las tardes de martes viene menos gente. Te hemos preparado un aviso para hoy a las 16:00.",
  enlace: "https://fiddle-zeta.vercel.app/delicanteria/avisos?grupo=momento",
};
const negocio = { slug: "delicanteria", nombre: "La Delicantería" };

// La tarjeta se pinta COMO la pinta el iPhone (WALLET, lib/vistaWallet.js): 360 de ancho,
// la banda a 139 de alto, centrada y recortada por los lados, y la fila de campos
// repartida con colocarFila (encoge entera hasta el 40 % y el largo pasa a dos líneas).
const { WALLET: W, colocarFila } = await import("../src/lib/vistaWallet.js");

const ANCHO = W.ancho;
const Y_BANDA = W.cabecera;
const Y_CAMPOS = Y_BANDA + W.banda + W.arribaCampos;
const INTERLINEA = 1.18;

function campos(lista) {
  const fila = colocarFila(lista, {
    total: ANCHO - W.margen * 2, hueco: W.hueco, max: W.valor, min: W.valorMin,
    medir: anchoTexto, etiquetas: lista.map((f) => anchoTexto(f.label, W.etiqueta * 0.7)),
  });
  let x = W.margen;
  const piezas = lista.map((f, i) => {
    const { ancho, tam, lineas } = fila[i];
    // Como "space-between": el último campo acaba pegado al margen derecho.
    const xc = i === lista.length - 1 && i > 0 ? ANCHO - W.margen - ancho : x;
    x += ancho + W.hueco;
    const y0 = Y_CAMPOS + 11;
    return svgTexto(f.label, { x: xc, y: y0, tam: 8.5, color: COLORES_DUENO.etiqueta })
      + lineas.map((l, j) => svgTexto(l, { x: xc, y: y0 + 8 + tam + j * tam * INTERLINEA, tam, color: COLORES_DUENO.texto })).join("");
  });
  const lineasMax = Math.max(...fila.map((c) => c.lineas.length));
  const tamMax = Math.max(...fila.map((c) => c.tam));
  return { svg: piezas.join(""), alto: 19 + tamMax * (1 + (lineasMax - 1) * INTERLINEA) };
}

function maqueta(lista, cabecera) {
  const banda = svgStripDueno(informe);
  const abajo = campos(lista);
  const alto = Math.ceil(Y_CAMPOS + abajo.alto + W.margen);
  const logo = Buffer.from(svgLogoDueno()).toString("base64");
  const tamSemana = W.valorCabecera * 0.62;
  const centro = W.cabecera / 2;
  const interior = banda.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}">`
    + `<defs><clipPath id="c"><rect width="${ANCHO}" height="${alto}" rx="${W.radio}"/></clipPath></defs>`
    + `<g clip-path="url(#c)"><rect width="${ANCHO}" height="${alto}" fill="${PALETA.verde}"/>`
    + `<image x="${W.margen}" y="${centro - W.logo / 2}" width="${W.logo}" height="${W.logo}" href="data:image/svg+xml;base64,${logo}"/>`
    + svgTexto("La Delicantería", { x: W.margen + W.logo + 12, y: centro + 6, tam: W.nombre * 0.75, color: COLORES_DUENO.texto })
    + svgTexto(cabecera.label, { x: ANCHO - W.margen - anchoTexto(cabecera.label, 8.5), y: centro - 6, tam: 8.5, color: COLORES_DUENO.etiqueta })
    + svgTexto(cabecera.value, { x: ANCHO - W.margen - anchoTexto(cabecera.value, tamSemana), y: centro + 10, tam: tamSemana, color: COLORES_DUENO.texto })
    // Alto de Wallet y "slice": la banda sale más alta que su PNG y pierde los lados.
    + `<svg x="0" y="${Y_BANDA}" width="${ANCHO}" height="${W.banda}" viewBox="0 0 ${banda.ancho} ${banda.alto}" preserveAspectRatio="xMidYMid slice">${interior}</svg>`
    + abajo.svg + `</g></svg>`;
}

const raster = (svg, w, h) => sharp(Buffer.from(svg), { density: 72 }).resize(w, h).png().toBuffer();

const banda = svgStripDueno(informe);
const campos_ = camposDelDueno({ informe, aviso }, negocio, { base: "https://fiddle-zeta.vercel.app" });
const svgMaqueta = maqueta([...campos_.secondaryFields, ...campos_.auxiliaryFields], campos_.headerFields[0]);
const alto = Number(/height="(\d+)"/.exec(svgMaqueta)[1]);

writeFileSync(join(salida, "strip.png"), await raster(banda.svg, banda.ancho * 3, banda.alto * 3));
writeFileSync(join(salida, "icono.png"), await raster(svgIconoDueno(), 180, 180));
writeFileSync(join(salida, "logo.png"), await raster(svgLogoDueno(), 300, 300));
writeFileSync(join(salida, "maqueta.png"), await raster(svgMaqueta, ANCHO * 3, alto * 3));
process.stdout.write(`Escrito en ${salida}\n`);
