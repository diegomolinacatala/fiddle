import sharp from "sharp";
import { PKPass } from "passkit-generator";
import { configApple } from "../apple/config";
import "../apple/firmar";
import { appUrl } from "../url";
import { construirPassJsonDueno } from "./pase";
import { svgStripDueno, svgIconoDueno, svgLogoDueno } from "./dibujo";

// Tamaños en puntos: icono 29, logo 50 de alto, banda 375x123.
const LADO_ICONO = 29;
const ALTO_LOGO = 50;

const png = (svg, ancho, alto) => sharp(Buffer.from(svg)).resize(ancho, alto).png().toBuffer();

// @1x, @2x y @3x de un mismo dibujo.
async function escalas(nombre, svg, ancho, alto) {
  const [a, b, c] = await Promise.all([1, 2, 3].map((k) => png(svg, ancho * k, alto * k)));
  return { [`${nombre}.png`]: a, [`${nombre}@2x.png`]: b, [`${nombre}@3x.png`]: c };
}

async function imagenesDelDueno(informe) {
  const banda = svgStripDueno(informe);
  const partes = await Promise.all([
    escalas("icon", svgIconoDueno(), LADO_ICONO, LADO_ICONO),
    escalas("logo", svgLogoDueno(), ALTO_LOGO, ALTO_LOGO),
    escalas("strip", banda.svg, banda.ancho, banda.alto),
  ]);
  return Object.assign({}, ...partes);
}

/**
 * El .pkpass firmado de la tarjeta del dueño. Con el Pass Type ID general, no el
 * de la tienda: es una tarjeta de fiddle y no debe apilarse con las de sus clientes.
 * @param {{ informe: object, aviso: ({texto: string, enlace?: string}|null) }} estado
 * @returns {Promise<Buffer>}
 */
export async function generarPkpassDueno({ informe, aviso }, negocio, config = configApple()) {
  if (!config) throw new Error("Apple Wallet no está configurado (faltan variables APPLE_*)");
  const passJson = construirPassJsonDueno({ informe, aviso }, negocio, {
    passTypeId: config.passTypeId,
    teamId: config.teamId,
    appUrl: appUrl(),
  });
  const imagenes = await imagenesDelDueno(informe);
  const pase = new PKPass(
    { ...imagenes, "pass.json": Buffer.from(JSON.stringify(passJson)) },
    {
      wwdr: config.wwdr,
      signerCert: config.cert,
      signerKey: config.key,
      signerKeyPassphrase: config.passphrase,
    },
  );
  return pase.getAsBuffer();
}
