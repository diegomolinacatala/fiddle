// Segunda ronda: solo el sello de la «f», casi en su sitio, con sellos distintos
// (borde, aro, tinta) y casillas distintas debajo.
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(RAIZ + "package.json");
const sharp = require("sharp");
const { PALETA: P } = await import(pathToFileURL(RAIZ + "src/app/home/paleta.js"));

// Dónde dejar lo generado (SVG y PNG de prueba): fuera del repo, que pesa.
const SALIDA = process.argv[2];
if (!SALIDA) throw new Error("Falta la carpeta de salida: node gen-rondaN.mjs <carpeta>");
mkdirSync(SALIDA, { recursive: true });

function azar(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ---------- el borde: un radio que depende del ángulo ----------
const FORMAS = {
  redondo: () => 0,
  // festón: el borde de un sello de lacre fino o de una chapa
  ondas: (t, r) => r * 0.035 * Math.cos(18 * t),
  // dentado: los dientes de un sello de correos, en círculo
  dientes: (t, r) => -r * 0.075 * Math.max(0, Math.cos(26 * t)) ** 1.5,
  // lacre: una gota gorda que se ha desparramado
  lacre: (t, r) => r * (0.045 * Math.sin(3 * t + 1) + 0.03 * Math.sin(5 * t + 2.2) + 0.02 * Math.sin(8 * t + 0.4)),
};

function borde(cx, cy, r, { forma = "redondo", semilla = 1, amp = 2 } = {}) {
  const a = azar(semilla);
  const ondas = [3, 5, 9, 17].map((f) => ({ f, fase: a() * 6.28, amp: amp * (a() * 0.6 + 0.4) / Math.sqrt(f / 3) }));
  const n = 480;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = r + FORMAS[forma](t, r) + ondas.reduce((s, o) => s + o.amp * Math.sin(o.f * t + o.fase), 0);
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`;
  }
  return d + "Z";
}

// ---------- calvas de tinta ----------
// `lado`: ángulo por donde el sello apoyó menos (ahí más calvas y más grandes).
function calvas(cx, cy, r, { semilla = 7, cuantas = 60, max = 4, lado = null } = {}) {
  const a = azar(semilla);
  let s = "";
  for (let i = 0; i < cuantas; i++) {
    let ang = a() * Math.PI * 2;
    let rad = 0.8 + a() ** 2.2 * max;
    if (lado != null) {
      // se agolpan hacia `lado` y crecen allí
      ang = lado + (a() - 0.5) * Math.PI * 1.3 * a();
      rad *= 1 + 1.2 * a();
    }
    const dist = r * Math.sqrt(0.2 + 0.8 * a() ** 0.6);
    s += `<circle cx="${(cx + dist * Math.cos(ang)).toFixed(1)}" cy="${(cy + dist * Math.sin(ang)).toFixed(1)}" r="${rad.toFixed(2)}"/>`;
  }
  return s;
}

// ---------- la «f»: gancho arriba a la derecha, abajo a la izquierda, ojos de violín ----------
function efe({ cx, cy, alto, color, grueso = 1 }) {
  const k = alto / 100;
  return `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(3)}) translate(-50 -50)" fill="${color}" stroke="${color}">`
    + `<path d="M72 13 C66 1 52 2 50 17 C48 33 52 62 47 80 C44 93 33 97 26 88" fill="none" stroke-width="${10.5 * grueso}" stroke-linecap="round"/>`
    + `<circle cx="72" cy="14" r="${8.2 * grueso}" stroke="none"/><circle cx="26" cy="87" r="${8.2 * grueso}" stroke="none"/>`
    + `<path d="M35 41 H65" fill="none" stroke-width="${8.5 * grueso}" stroke-linecap="round"/></g>`;
}

// ---------- la casilla vacía ----------
const CASILLAS = {
  raya: (c) => `<circle cx="256" cy="256" r="196" fill="none" stroke="${c.linea}" stroke-width="9" stroke-dasharray="22 14" stroke-linecap="round"/>`,
  puntos: (c) => `<circle cx="256" cy="256" r="196" fill="none" stroke="${c.linea}" stroke-width="11" stroke-dasharray="0 23.1" stroke-linecap="round"/>`,
  tinte: (c) => `<circle cx="256" cy="256" r="198" fill="${c.linea}" fill-opacity="0.22"/>`,
  aro: (c) => `<circle cx="256" cy="256" r="196" fill="none" stroke="${c.linea}" stroke-width="6"/>`,
};

// ---------- un sello ----------
// relleno: "lleno" (disco de tinta, la f en hueco) o "goma" (aros de tinta, la f en tinta)
// aro: dibujo entre el borde y el centro: null, "linea", "doble", "puntos"
function sello(o) {
  const { id, cx = 262, cy = 250, r = 168, gira = 6, tinta, semilla = 3, forma, relleno = "lleno",
    aro = null, f = 0.56, grueso = 1, calvasDe = {} } = o;
  const b = borde(cx, cy, r, { forma, semilla });
  const ink = relleno === "lleno" ? "#000" : "#fff"; // color del dibujo de dentro en la máscara
  let m = relleno === "lleno"
    ? `<path d="${b}" fill="#fff"/>`
    : `<path d="${b}" fill="none" stroke="#fff" stroke-width="${r * 0.07}"/>`;
  const ri = r * 0.84;
  if (aro === "linea") m += `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="${ink}" stroke-width="${r * 0.035}"/>`;
  if (aro === "doble") m += `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="${ink}" stroke-width="${r * 0.03}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${ri - r * 0.08}" fill="none" stroke="${ink}" stroke-width="${r * 0.015}"/>`;
  if (aro === "puntos") {
    let p = "";
    const n = 30, rp = r * 0.86;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      p += `<circle cx="${(cx + rp * Math.cos(t)).toFixed(1)}" cy="${(cy + rp * Math.sin(t)).toFixed(1)}" r="${(r * 0.026).toFixed(1)}"/>`;
    }
    m += `<g fill="${ink}">${p}</g><circle cx="${cx}" cy="${cy}" r="${r * 0.76}" fill="none" stroke="${ink}" stroke-width="${r * 0.025}"/>`;
  }
  m += efe({ cx, cy, alto: r * 2 * f, color: ink, grueso });
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">${m}`
    + `<g fill="#000">${calvas(cx, cy, r, { semilla: semilla + 11, ...calvasDe })}</g></mask></defs>`
    + `<g transform="rotate(${gira} ${cx} ${cy})"><rect width="512" height="512" fill="${tinta}" mask="url(#${id})"/></g>`;
}

// ---------- las propuestas ----------
const PROPUESTAS = {
  limpio: { nombre: "Limpio", dice: "Disco liso, la f en hueco, sin aro. Lo mínimo.",
    d: (c) => CASILLAS.raya(c) + sello({ ...c, forma: "redondo", gira: 5, cx: 260, cy: 252 }) },
  aro: { nombre: "Con aro", dice: "Como el de antes, pero casi encajado en su casilla.",
    d: (c) => CASILLAS.raya(c) + sello({ ...c, forma: "redondo", aro: "linea", gira: 8, semilla: 9, f: 0.52 }) },
  goma: { nombre: "Goma de contorno", dice: "Doble aro y la f en tinta: el sello de tampón de toda la vida.",
    d: (c) => CASILLAS.raya(c) + sello({ ...c, forma: "redondo", relleno: "goma", aro: "doble", gira: -6, semilla: 21, f: 0.5, grueso: 1.1 }) },
  matasellos: { nombre: "Matasellos", dice: "Aro de puntos entre dos líneas, como un matasellos de correos.",
    d: (c) => CASILLAS.puntos(c) + sello({ ...c, forma: "redondo", relleno: "goma", aro: "puntos", gira: -9, semilla: 5, f: 0.46, grueso: 1.15 }) },
  ondas: { nombre: "Festón", dice: "Borde ondulado, como una chapa o un sello de lacre fino.",
    d: (c) => CASILLAS.tinte(c) + sello({ ...c, forma: "ondas", gira: 7, semilla: 14, f: 0.54, r: 166 }) },
  dientes: { nombre: "Dentado", dice: "Los dientes de un sello de correos, en redondo. Sello sobre sello.",
    d: (c) => CASILLAS.raya(c) + sello({ ...c, forma: "dientes", aro: "linea", gira: 4, semilla: 27, f: 0.5 }) },
  lacre: { nombre: "Lacre", dice: "Una gota de lacre aplastada, con la f hundida. Más artesano.",
    d: (c) => CASILLAS.aro(c) + sello({ ...c, forma: "lacre", aro: "linea", gira: -4, semilla: 40, f: 0.5, calvasDe: { cuantas: 18, max: 2.5 } }) },
  pocaTinta: { nombre: "Poca tinta", dice: "El tampón casi seco: un lado apoyó menos y se ve el papel.",
    d: (c) => CASILLAS.raya(c) + sello({ ...c, forma: "redondo", gira: 10, semilla: 51, calvasDe: { cuantas: 170, max: 4.5, lado: 2.4 } }) },
};

const FONDOS = {
  claro: { fondo: P.papel, tinta: P.verde, linea: P.camel },
  oscuro: { fondo: P.verde, tinta: P.avena, linea: P.camel },
  espresso: { fondo: P.espresso, tinta: P.papel, linea: P.camel },
};

const svg = (clave, f, prefijo = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">`
  + `<rect width="512" height="512" fill="${f.fondo}"/>`
  + PROPUESTAS[clave].d({ ...f, id: `${prefijo}m-${clave}-${f.tinta.slice(1)}` }) + `</svg>`;

const claves = Object.keys(PROPUESTAS);
for (const clave of claves) {
  for (const [nf, f] of Object.entries(FONDOS)) {
    const s = svg(clave, f);
    writeFileSync(`${SALIDA}/f-${clave}-${nf}.svg`, s);
    for (const t of [64, 32]) await sharp(Buffer.from(s)).resize(t, t).png().toFile(`${SALIDA}/f-${clave}-${nf}-${t}.png`);
  }
}

// Hoja: una columna por propuesta, una fila por fondo, y abajo a 64 y 32 px.
const celda = 250;
const ancho = celda * claves.length, alto = celda * 3 + 110;
let hoja = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}"><rect width="100%" height="100%" fill="#ffffff"/>`;
claves.forEach((c, i) => {
  Object.entries(FONDOS).forEach(([nf, f], j) => {
    hoja += `<g transform="translate(${i * celda + 8} ${j * celda + 8}) scale(${(celda - 16) / 512})">`
      + svg(c, f, `h${j}`).replace(/^<svg[^>]*>|<\/svg>$/g, "") + `</g>`;
  });
});
hoja += `</svg>`;
const base = await sharp(Buffer.from(hoja)).png().toBuffer();
const peq = [];
claves.forEach((c, i) => {
  peq.push({ input: `${SALIDA}/f-${c}-claro-64.png`, left: i * celda + 30, top: celda * 3 + 20 });
  peq.push({ input: `${SALIDA}/f-${c}-claro-32.png`, left: i * celda + 110, top: celda * 3 + 36 });
  peq.push({ input: `${SALIDA}/f-${c}-oscuro-32.png`, left: i * celda + 160, top: celda * 3 + 36 });
});
await sharp(base).composite(peq).png().toFile(`${SALIDA}/_hoja-f.png`);
console.log(claves.map((c) => `${c}: ${PROPUESTAS[c].nombre} — ${PROPUESTAS[c].dice}`).join("\n"));
