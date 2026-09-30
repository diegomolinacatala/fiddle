// ============================================================================
// Genera src/lib/apple/letras.js: el contorno de cada letra de Inter (Medium)
// como trazo SVG, para escribir texto de verdad en la banda del pase sin <text>.
//
// En serverless no hay fuentes fiables, así que la fuente no se carga al firmar:
// se convierte UNA vez en datos. Solo las letras de CARACTERES; si una frase nueva
// necesita otra, se añade ahí y se vuelve a ejecutar:
//
//   node scripts/gen-letras.mjs
//
// Inter es de The Inter Project Authors, con licencia SIL Open Font License 1.1
// (se permite incrustarla; la nota va en la cabecera del fichero generado).
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import opentype from "opentype.js";

const require = createRequire(import.meta.url);
const FUENTE = require.resolve("@fontsource/inter/files/inter-latin-500-normal.woff");
const SALIDA = new URL("../src/lib/apple/letras.js", import.meta.url);

const CARACTERES = [
  "abcdefghijklmnopqrstuvwxyz",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "áéíóúüñÁÉÍÓÚÑ",
  "0123456789",
  " :·/.,-–",
].join("");

const buf = readFileSync(FUENTE);
const fuente = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const em = fuente.unitsPerEm;

const glifos = {};
for (const c of CARACTERES) {
  const g = fuente.charToGlyph(c);
  if (!g || g.index === 0) throw new Error(`Inter no tiene «${c}»`);
  // Línea base en y=0 y la y hacia abajo, como en SVG.
  const d = g.getPath(0, 0, em).toPathData(0);
  glifos[c] = [Math.round(g.advanceWidth), d];
}

const kern = {};
for (const a of CARACTERES) {
  for (const b of CARACTERES) {
    const v = fuente.getKerningValue(fuente.charToGlyph(a), fuente.charToGlyph(b));
    if (v) kern[a + b] = v;
  }
}

const js = `// ============================================================================
// GENERADO por scripts/gen-letras.mjs — no editar a mano.
//
// Contornos de Inter Medium (© The Inter Project Authors, SIL Open Font License
// 1.1, https://github.com/rsms/inter) para escribir en la banda del pase sin
// depender de las fuentes del servidor. Unidades de la fuente: ${em} por em,
// línea base en y=0.
// ============================================================================

export const EM = ${em};
export const ALTO_MAYUSCULA = ${Math.round(fuente.tables.os2.sCapHeight || 0.727 * em)};

/** carácter -> [avance, trazo SVG] */
export const GLIFOS = ${JSON.stringify(glifos)};

/** par de caracteres -> ajuste de espaciado (kerning) */
export const KERN = ${JSON.stringify(kern)};
`;
writeFileSync(SALIDA, js);
console.log(`letras.js: ${Object.keys(glifos).length} glifos, ${Object.keys(kern).length} pares de kerning, ${(js.length / 1024).toFixed(1)} KB`);
