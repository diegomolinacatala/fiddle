// Genera los iconos PWA (PNG) de las dos apps a partir de un SVG.
// Requiere sharp SOLO para regenerar: `npm i -D sharp && node scripts/gen-icons.mjs`.
// Los PNG resultantes se commitean, así que el `npm install` normal NO necesita sharp.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

const mug = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${bg}"/>
  <g stroke="#fff" stroke-width="20" fill="none" stroke-linecap="round">
    <path d="M212 150 q-16 -24 0 -48"/>
    <path d="M256 150 q-16 -24 0 -48"/>
    <path d="M300 150 q-16 -24 0 -48"/>
  </g>
  <path d="M152 200 h184 v84 a92 92 0 0 1 -184 0 z" fill="#fff"/>
  <path d="M336 216 h22 a46 46 0 0 1 0 92 h-22" fill="none" stroke="#fff" stroke-width="24"/>
  <rect x="132" y="356" width="248" height="20" rx="10" fill="#fff"/>
</svg>`;

const sets = [
  { name: "worker", bg: "#0f7a5a" }, // verde = caja
  { name: "manager", bg: "#26476e" }, // azul = manager
];

for (const s of sets) {
  for (const size of [180, 192, 512]) {
    await sharp(Buffer.from(mug(s.bg))).resize(size, size).png().toFile(`public/icons/${s.name}-${size}.png`);
  }
}
console.log("iconos generados en public/icons/");
