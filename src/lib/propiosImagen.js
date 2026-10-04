import sharp from "sharp";
import { createHash } from "crypto";
import { TAM } from "./apple/dibujo";

// ============================================================================
// LO QUE SUBE LA TIENDA, PREPARADO (servidor, sharp)
// ----------------------------------------------------------------------------
// ICONO  un dibujo suyo (su galleta, su taza, su mascota) que va en el logo y
//        dentro de los sellos. Los dibujos de la tarjeta son de UN color, el
//        que toque en cada sitio; así que de la imagen solo se guarda la
//        SILUETA: blanca sobre transparente, recortada y centrada en un
//        cuadrado con su margen, pequeña (va dentro del tema, ver propios.js).
//          - con transparencias (un PNG de logo): la silueta es lo opaco
//          - sin ellas (una foto, un JPG): lo que se aparta del color del borde
// FOTO   el fondo de la banda de los sellos: recortada a la proporción de la
//        banda (a sangre, sin deformar) y en JPG.
// ============================================================================

const MAX_PIXELES = 40_000_000; // una foto de 40 Mpx; más es un intento de reventar la memoria
const LADO_ICONO = 160;         // se pinta como mucho a ~120 px (logo @3x): sobra
const LIENZO = 512;             // como los de dibujo.js: la tinta dentro, con margen
const TINTA = 448;
export const MIN_ICONO = 64;
export const MIN_FOTO = 600;    // de ancho: por debajo, en un iPhone se ve borrosa

const huella = (b) => createHash("sha256").update(b).digest("hex").slice(0, 24);

async function abrir(entrada) {
  try {
    const img = sharp(entrada, { limitInputPixels: MAX_PIXELES, failOn: "error" }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return { error: "No es una imagen que se pueda leer" };
    return { img, meta };
  } catch {
    return { error: "No es una imagen que se pueda leer (vale PNG, JPG o WebP)" };
  }
}

/**
 * De lo que suba la tienda a su icono: la silueta, blanca sobre transparente.
 * @returns {Promise<{png:Buffer, id:string} | {error:string}>}
 */
export async function procesarIcono(entrada) {
  const a = await abrir(entrada);
  if (a.error) return a;
  if (Math.max(a.meta.width, a.meta.height) < MIN_ICONO) {
    return { error: `La imagen es muy pequeña. Hace falta al menos ${MIN_ICONO}×${MIN_ICONO} píxeles.` };
  }
  const { data, info } = await a.img.ensureAlpha()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;

  let transparente = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) { transparente = true; break; }

  const mascara = Buffer.alloc(n);
  if (transparente) {
    for (let p = 0; p < n; p += 1) mascara[p] = data[p * 4 + 3];
  } else {
    // El fondo es el color del borde; la tinta, lo que se aparta de él (sirve
    // igual para un dibujo oscuro sobre blanco que para uno claro sobre negro).
    const luz = (p) => 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];
    let suma = 0;
    let cuenta = 0;
    for (let x = 0; x < info.width; x += 1) { suma += luz(x) + luz((info.height - 1) * info.width + x); cuenta += 2; }
    for (let y = 0; y < info.height; y += 1) { suma += luz(y * info.width) + luz(y * info.width + info.width - 1); cuenta += 2; }
    const fondo = suma / cuenta;
    for (let p = 0; p < n; p += 1) mascara[p] = Math.max(0, Math.min(255, (Math.abs(luz(p) - fondo) - 24) * 3));
  }

  let tinta = 0;
  for (let p = 0; p < n; p += 1) if (mascara[p] > 128) tinta += 1;
  if (tinta < n * 0.01) return { error: "No se distingue ningún dibujo. Prueba con un PNG con el fondo transparente o un dibujo oscuro sobre blanco." };
  if (tinta > n * 0.97) return { error: "La imagen es toda «dibujo»: haría un cuadrado. Prueba con un PNG con el fondo transparente." };

  // Sin márgenes, encajada en el lienzo de 512 con su aire, como los de dibujo.js.
  let silueta = sharp(mascara, { raw: { width: info.width, height: info.height, channels: 1 } });
  try {
    silueta = sharp(await silueta.trim({ background: "#000000", threshold: 10 }).png().toBuffer());
  } catch {
    silueta = sharp(await silueta.png().toBuffer());
  }
  // Un solo canal y de LADO_ICONO exacto: si no, joinChannel lee el búfer torcido (rayas).
  const reencuadrada = await silueta
    .resize(TINTA, TINTA, { fit: "contain", background: "#000000" })
    .extend({ top: (LIENZO - TINTA) / 2, bottom: (LIENZO - TINTA) / 2, left: (LIENZO - TINTA) / 2, right: (LIENZO - TINTA) / 2, background: "#000000" })
    .png().toBuffer();
  const encajada = await sharp(reencuadrada).resize(LADO_ICONO, LADO_ICONO).removeAlpha().extractChannel(0).raw().toBuffer();

  const png = await sharp({ create: { width: LADO_ICONO, height: LADO_ICONO, channels: 3, background: "#ffffff" } })
    .joinChannel(encajada, { raw: { width: LADO_ICONO, height: LADO_ICONO, channels: 1 } })
    .png({ compressionLevel: 9, palette: true, colours: 32 })
    .toBuffer();
  return { png, id: huella(png) };
}

/**
 * De lo que suba la tienda a la foto de su banda: a la proporción de la banda
 * de Apple (@3x), recortada por el centro.
 * @returns {Promise<{jpg:Buffer, id:string} | {error:string}>}
 */
export async function procesarFoto(entrada) {
  const a = await abrir(entrada);
  if (a.error) return a;
  if (a.meta.width < MIN_FOTO) return { error: `La foto es muy pequeña (${a.meta.width} píxeles de ancho). Hace falta al menos ${MIN_FOTO}.` };
  const [w, h] = TAM.strip.storeCard;
  const jpg = await a.img
    .resize(w * 3, h * 3, { fit: "cover", position: "attention" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { jpg, id: huella(jpg) };
}
