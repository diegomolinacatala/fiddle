// Propuestas de logo «sello sellado»: la casilla vacía de la cartilla (círculo
// discontinuo) y, encima y algo torcido, el sello de goma ya estampado.
// Todo en trazos (sin <text>, sin filtros): se ve igual en sharp y en el navegador.
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(RAIZ + "package.json");
const sharp = require("sharp");
const opentype = require("opentype.js");
const { VIOLIN } = await import(pathToFileURL(RAIZ + "src/lib/violin.js"));
const { PALETA: P } = await import(pathToFileURL(RAIZ + "src/app/home/paleta.js"));

// Dónde dejar lo generado (SVG y PNG de prueba): fuera del repo, que pesa.
const SALIDA = process.argv[2];
if (!SALIDA) throw new Error("Falta la carpeta de salida: node gen-rondaN.mjs <carpeta>");
mkdirSync(SALIDA, { recursive: true });

// ---------- azar con semilla: el mismo sello cada vez ----------
function azar(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ---------- el borde del sello: un círculo que no es perfecto ----------
function bordeTorcido(cx, cy, r, { semilla = 1, amp = 2.2 } = {}) {
  const a = azar(semilla);
  const ondas = [3, 5, 9, 17].map((f) => ({ f, fase: a() * 6.28, amp: amp * (a() * 0.6 + 0.4) / Math.sqrt(f / 3) }));
  const n = 200;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = r + ondas.reduce((s, o) => s + o.amp * Math.sin(o.f * t + o.fase), 0);
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`;
  }
  return d + "Z";
}

// ---------- calvas de tinta: más hacia el borde, como en un sello de goma ----------
function calvas(cx, cy, r, { semilla = 7, cuantas = 70, max = 4.2 } = {}) {
  const a = azar(semilla);
  let s = "";
  for (let i = 0; i < cuantas; i++) {
    const ang = a() * Math.PI * 2;
    const dist = r * Math.sqrt(0.35 + 0.65 * a() ** 0.5);
    const rad = 0.8 + a() ** 2.2 * max;
    s += `<circle cx="${(cx + dist * Math.cos(ang)).toFixed(1)}" cy="${(cy + dist * Math.sin(ang)).toFixed(1)}" r="${rad.toFixed(2)}"/>`;
  }
  // un arco donde el sello apoyó menos (le falta tinta de un lado)
  return s;
}

// ---------- el violín, centrado y escalado a una altura ----------
function violin({ cx, cy, alto, cuerpo, efe }) {
  const B = VIOLIN.encuadre, M = VIOLIN.mastil, E = VIOLIN.efe;
  const k = alto / B.alto;
  const tx = cx - (B.x + B.ancho / 2) * k, ty = cy - (B.y + B.alto / 2) * k;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})">`
    + `<g fill="${cuerpo}"><path d="${VIOLIN.caja}"/><rect x="${M.x}" y="${M.y}" width="${M.ancho}" height="${M.alto}" rx="${M.radio}"/></g>`
    + `<g fill="${efe}" stroke="${efe}"><path d="${E.trazo}" fill="none" stroke-width="${E.grosor}" stroke-linecap="round"/>`
    + E.ojos.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" stroke="none"/>`).join("")
    + `<path d="${E.muesca}" fill="none" stroke-width="${E.grosorMuesca}" stroke-linecap="round"/></g></g>`;
}

// ---------- la efe sola, grande: la «f» de fiddle ----------
// Ampliada tal cual, la efe del violín parece un hueso: aquí se le dan los
// ganchos de una «f» cursiva (arriba a la derecha, abajo a la izquierda), con
// los ojos redondos de los agujeros del violín en las puntas.
function efeGrande({ cx, cy, alto, color }) {
  const k = alto / 100;
  return `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(3)}) translate(-50 -50)" fill="${color}" stroke="${color}">`
    + `<path d="M72 13 C66 1 52 2 50 17 C48 33 52 62 47 80 C44 93 33 97 26 88" fill="none" stroke-width="10.5" stroke-linecap="round"/>`
    + `<circle cx="72" cy="14" r="8.2" stroke="none"/><circle cx="26" cy="87" r="8.2" stroke="none"/>`
    + `<path d="M35 41 H65" fill="none" stroke-width="8.5" stroke-linecap="round"/></g>`;
}

// ---------- la casilla vacía de la cartilla ----------
const casilla = ({ r = 200, color, grosor = 9, raya = 22, hueco = 14 }) =>
  `<circle cx="256" cy="256" r="${r}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-dasharray="${raya} ${hueco}" stroke-linecap="round"/>`;

// ---------- un sello: tinta (disco o anillo) + lo de dentro, con calvas ----------
// contenido(tinta, papel): lo que va dentro, pintado en blanco/negro para la máscara.
function sello({ id, cx, cy, r, gira, tinta, semilla, modo, dentro }) {
  const borde = bordeTorcido(cx, cy, r, { semilla });
  let mascara;
  if (modo === "lleno") {
    // disco de tinta; lo de dentro sale en papel (recortado)
    mascara = `<path d="${borde}" fill="#fff"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="none" stroke="#000" stroke-width="${r * 0.035}"/>`
      + dentro("#000", "#fff");
  } else {
    // anillo de tinta y lo de dentro en tinta (el sello de goma de contorno)
    mascara = `<path d="${borde}" fill="none" stroke="#fff" stroke-width="${r * 0.075}"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="none" stroke="#fff" stroke-width="${r * 0.03}"/>`
      + dentro("#fff", "#000");
  }
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">${mascara}`
    + `<g fill="#000">${calvas(cx, cy, r, { semilla: semilla + 11 })}</g></mask></defs>`
    + `<g transform="rotate(${gira} ${cx} ${cy})"><rect width="512" height="512" fill="${tinta}" mask="url(#${id})"/></g>`;
}

// ---------- las propuestas ----------
// Cada una: (colores) => contenido de un svg 512x512.
const PROPUESTAS = {
  violin: {
    nombre: "Sello del violín",
    dice: "Disco de tinta verde con el violín en hueco, algo movido sobre su casilla.",
    dibujo: ({ tinta, linea, id }) =>
      casilla({ color: linea })
      + sello({ id, cx: 284, cy: 236, r: 160, gira: -11, tinta, semilla: 4, modo: "lleno",
        dentro: (hueco, lleno) => violin({ cx: 284, cy: 242, alto: 210, cuerpo: hueco, efe: lleno }) }),
  },
  efe: {
    nombre: "Sello de la efe",
    dice: "Solo la efe del violín, grande: la «f» de fiddle. La que mejor aguanta a 16 px.",
    dibujo: ({ tinta, linea, id }) =>
      casilla({ color: linea })
      + sello({ id, cx: 282, cy: 236, r: 160, gira: 9, tinta, semilla: 9, modo: "lleno",
        dentro: (hueco) => efeGrande({ cx: 282, cy: 236, alto: 178, color: hueco }) }),
  },
  goma: {
    nombre: "Sello de goma",
    dice: "El sello de contorno, como el de una tienda: doble aro y el violín en tinta.",
    dibujo: ({ tinta, linea, id }) =>
      casilla({ color: linea })
      + sello({ id, cx: 282, cy: 238, r: 164, gira: -14, tinta, semilla: 21, modo: "aro",
        dentro: (lleno, hueco) => violin({ cx: 282, cy: 244, alto: 214, cuerpo: lleno, efe: hueco }) }),
  },
  salido: {
    nombre: "Sello con prisa",
    dice: "El de la efe, pero estampado deprisa: medio fuera de su casilla. Más gesto, menos orden.",
    dibujo: ({ tinta, linea, id }) =>
      casilla({ r: 168, color: linea, grosor: 8, raya: 19, hueco: 12 }).replace('cx="256" cy="256"', 'cx="206" cy="300"')
      + sello({ id, cx: 300, cy: 214, r: 160, gira: 16, tinta, semilla: 33, modo: "lleno",
        dentro: (hueco) => efeGrande({ cx: 300, cy: 214, alto: 170, color: hueco }) }),
  },
};

const FONDOS = {
  claro: { fondo: P.papel, tinta: P.verde, linea: P.camel },
  oscuro: { fondo: P.verde, tinta: P.avena, linea: P.camel },
  espresso: { fondo: P.espresso, tinta: P.papel, linea: P.camel },
};

const svg = (clave, f, { conFondo = true, radio = 0 } = {}) => {
  const p = PROPUESTAS[clave];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">`
    + (conFondo ? `<rect width="512" height="512" rx="${radio}" fill="${f.fondo}"/>` : "")
    + p.dibujo({ ...f, id: `m-${clave}-${f.tinta.slice(1)}` }) + `</svg>`;
};

// ---------- la palabra, en trazos de Inter ----------
const inter = opentype.loadSync(require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff"));
function palabra(texto, { x, y, tam, color }) {
  const ruta = inter.getPath(texto, x, y, tam);
  ruta.fill = color;
  return ruta.toSVG(2);
}
const anchoPalabra = (t, tam) => inter.getAdvanceWidth(t, tam);

// Logo con nombre: sello + «fiddle», en una tira 1400x512
function conNombre(clave, f) {
  const tam = 260;
  const ancho = 512 + 40 + anchoPalabra("fiddle", tam) + 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho.toFixed(0)} 512">`
    + `<rect width="100%" height="100%" fill="${f.fondo}"/>`
    + PROPUESTAS[clave].dibujo({ ...f, id: `n-${clave}-${f.tinta.slice(1)}` })
    + palabra("fiddle", { x: 552, y: 345, tam, color: f.tinta === P.verde ? P.espresso : f.tinta })
    + `</svg>`;
}

// ---------- escribir y rasterizar ----------
const salida = {};
for (const clave of Object.keys(PROPUESTAS)) {
  for (const [nf, f] of Object.entries(FONDOS)) {
    const s = svg(clave, f);
    writeFileSync(`${SALIDA}/${clave}-${nf}.svg`, s);
    await sharp(Buffer.from(s)).resize(512, 512).png().toFile(`${SALIDA}/${clave}-${nf}.png`);
    for (const t of [64, 32, 16]) await sharp(Buffer.from(s)).resize(t, t).png().toFile(`${SALIDA}/${clave}-${nf}-${t}.png`);
  }
  const n = conNombre(clave, FONDOS.claro);
  writeFileSync(`${SALIDA}/${clave}-nombre.svg`, n);
  await sharp(Buffer.from(n)).png().toFile(`${SALIDA}/${clave}-nombre.png`);
  salida[clave] = { nombre: PROPUESTAS[clave].nombre, dice: PROPUESTAS[clave].dice };
}

// Una hoja con todo para mirarlo de un vistazo
const cols = Object.keys(PROPUESTAS);
const celda = 300, alto = celda * 3 + 260;
let hoja = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${celda * cols.length} ${alto}"><rect width="100%" height="100%" fill="#ffffff"/>`;
cols.forEach((c, i) => {
  Object.entries(FONDOS).forEach(([nf, f], j) => {
    hoja += `<g transform="translate(${i * celda + 10} ${j * celda + 10}) scale(${(celda - 20) / 512})">${svg(c, f).replace(/^<svg[^>]*>|<\/svg>$/g, "").replaceAll('id="m-', `id="h${j}-m-`).replaceAll("url(#m-", `url(#h${j}-m-`)}</g>`;
  });
});
hoja += `</svg>`;
await sharp(Buffer.from(hoja)).png().toFile(`${SALIDA}/_hoja.png`);
console.log(JSON.stringify(salida, null, 1));
