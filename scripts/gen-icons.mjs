// Genera los iconos PWA (PNG) de cada negocio. Regenerar:
//   npm i -D sharp && node scripts/gen-icons.mjs
// Los PNG se commitean, así que el `npm install` normal NO necesita sharp.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

const frame = (bg, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${bg}"/>${inner}</svg>`;

const mug = `
  <g stroke="#fff" stroke-width="20" fill="none" stroke-linecap="round">
    <path d="M212 150 q-16 -24 0 -48"/><path d="M256 150 q-16 -24 0 -48"/><path d="M300 150 q-16 -24 0 -48"/>
  </g>
  <path d="M152 200 h184 v84 a92 92 0 0 1 -184 0 z" fill="#fff"/>
  <path d="M336 216 h22 a46 46 0 0 1 0 92 h-22" fill="none" stroke="#fff" stroke-width="24"/>
  <rect x="132" y="356" width="248" height="20" rx="10" fill="#fff"/>`;

const scissors = `
  <g stroke="#c9a24b" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="176" cy="346" r="40"/><circle cx="336" cy="346" r="40"/>
    <path d="M205 322 L372 150"/><path d="M307 322 L140 150"/>
  </g>
  <circle cx="256" cy="252" r="11" fill="#c9a24b"/>`;

const pizza = `
  <path d="M256 118 L398 384 Q256 436 114 384 Z" fill="#ffd54a"/>
  <path d="M114 384 Q256 436 398 384" fill="none" stroke="#e8a44a" stroke-width="22" stroke-linecap="round"/>
  <path d="M256 118 L398 384 Q256 436 114 384 Z" fill="none" stroke="#fff" stroke-width="12"/>
  <circle cx="228" cy="300" r="19" fill="#c1121f"/><circle cx="300" cy="256" r="16" fill="#c1121f"/><circle cx="272" cy="362" r="15" fill="#c1121f"/>`;

const sets = [
  { name: "nube", svg: frame("#ff5c8a", mug) },
  { name: "fade", svg: frame("#17171c", scissors) },
  { name: "forno", svg: frame("#c1121f", pizza) },
];

for (const s of sets) {
  for (const size of [180, 192, 512]) {
    await sharp(Buffer.from(s.svg)).resize(size, size).png().toFile(`public/icons/${s.name}-${size}.png`);
  }
}
console.log("iconos generados:", sets.map((s) => s.name).join(", "));
