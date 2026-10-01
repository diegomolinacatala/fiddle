import sharp from "sharp";
import { createHash } from "crypto";
import { LOGO_MIN, LOGO_LADO, logoImagenDe } from "./logo";
import { leerLogo } from "./store";

// ============================================================================
// LOGO PROPIO: PREPARARLO Y PONERLO EN CADA SITIO (servidor, sharp)
// ----------------------------------------------------------------------------
// Se sube cualquier foto o PNG y aquí se deja como hace falta:
//   1. se gira según su EXIF (las fotos del móvil vienen tumbadas)
//   2. se le quitan los márgenes vacíos (blanco o transparente alrededor)
//   3. se encaja en un cuadrado de 1024 sin deformarla y se guarda en PNG
//      (de paso se le van los metadatos: ubicación de la foto, cámara…)
// Y luego, en cada sitio, a su manera (`componerLogo`): a sangre si es opaca y
// el sitio la recorta (círculo de Google, icono), centrada con aire si tiene
// transparencias.
// ============================================================================

const MAX_PIXELES = 40_000_000; // una foto de 40 Mpx; más es un intento de reventar la memoria

/**
 * De lo que suba la tienda al logo que se guarda.
 * @returns {Promise<{png:Buffer, id:string, opaco:boolean} | {error:string}>}
 */
export async function procesarLogo(entrada) {
  let base;
  try {
    base = sharp(entrada, { limitInputPixels: MAX_PIXELES, failOn: "error" }).rotate();
    const meta = await base.metadata();
    if (!meta.width || !meta.height) return { error: "No es una imagen que se pueda leer" };
  } catch {
    return { error: "No es una imagen que se pueda leer (vale PNG, JPG o WebP)" };
  }

  // Sin márgenes vacíos: un logo con medio lienzo en blanco saldría diminuto.
  let recortada = await base.png().toBuffer();
  try {
    const sinBordes = await sharp(recortada).trim({ threshold: 18 }).png().toBuffer({ resolveWithObject: true });
    // Si "recortar" se come casi todo, era una imagen lisa: mejor la original.
    if (sinBordes.info.width >= 32 && sinBordes.info.height >= 32) recortada = sinBordes.data;
  } catch {
    // trim falla con imágenes de un solo color: se queda como estaba.
  }

  const { width, height } = await sharp(recortada).metadata();
  if (Math.max(width, height) < LOGO_MIN) {
    return { error: `La imagen es muy pequeña (${width}×${height}). Hace falta al menos ${LOGO_MIN}×${LOGO_MIN} píxeles.` };
  }

  const png = await sharp(recortada)
    .resize(LOGO_LADO, LOGO_LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Opaca = cuadrada (o casi) y sin un solo píxel transparente: se puede recortar a sangre.
  const casiCuadrada = Math.abs(width / height - 1) < 0.08;
  const { channels } = await sharp(png).stats();
  const opaco = casiCuadrada && (channels[3] ? channels[3].min >= 250 : true);
  const id = createHash("sha256").update(png).digest("hex").slice(0, 24);
  return { png, id, opaco };
}

const cache = new Map(); // "<b>/<id>" -> Promise<Buffer|null>
const MAX_CACHE = 40;

/** La imagen guardada de este tema (1024×1024 PNG), o null. En memoria tras la primera vez. */
export function bufferDeLogo(tema) {
  const l = logoImagenDe(tema);
  if (!l) return Promise.resolve(null);
  const clave = `${l.b}/${l.id}`;
  if (!cache.has(clave)) {
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    const p = leerLogo(l.b, l.id).catch((e) => {
      console.error(`[logo] no se pudo leer ${clave}:`, e);
      return null;
    });
    p.then((b) => { if (!b) cache.delete(clave); });
    cache.set(clave, p);
  }
  return cache.get(clave);
}

const hexARgba = (hex, alpha = 1) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), alpha } : { r: 255, g: 255, b: 255, alpha };
};

/**
 * La imagen en un cuadrado de `lado`, lista para un sitio concreto.
 * @param {Buffer} buffer  la guardada (1024×1024)
 * @param {object} o
 * @param {boolean} o.opaco
 * @param {string|null} [o.fondo]  color de fondo (#rrggbb) o null = transparente
 * @param {number} [o.escala]      qué parte del lado ocupa si NO va a sangre
 * @param {boolean} [o.sangre]     si es opaca, que llene todo el cuadrado
 * @param {number} [o.radio]       esquinas redondeadas (en px del resultado)
 */
export async function componerLogo(buffer, lado, { opaco, fondo = null, escala = 0.8, sangre = false, radio = 0 }) {
  const aSangre = sangre && opaco;
  const interior = aSangre ? lado : Math.round(lado * escala);
  const dentro = await sharp(buffer).resize(interior, interior, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  let img = sharp({
    create: { width: lado, height: lado, channels: 4, background: fondo && !aSangre ? hexARgba(fondo) : { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: dentro, gravity: "center" }]);
  if (radio > 0) {
    const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${radio}" fill="#fff"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: mascara, blend: "dest-in" }]);
  }
  return img.png().toBuffer();
}
