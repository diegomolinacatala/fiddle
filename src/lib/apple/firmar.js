import { PKPass } from "passkit-generator";
import { configApple } from "./config";
import { construirPassJson } from "./pase";
import { imagenesDelPase } from "./imagenes";
import { appUrl } from "../url";
import { estadoDeTienda } from "../horario";
import { relojVivo } from "../relojAvisos";

// ============================================================================
// APPLE WALLET — firma del .pkpass
// ----------------------------------------------------------------------------
// pass.json + imágenes -> manifest (SHA-1 de cada fichero) -> firma PKCS#7 con el
// certificado del Pass Type ID + intermedio WWDR -> zip. Lo hace passkit-generator.
// ============================================================================

export const MIME_PKPASS = "application/vnd.apple.pkpass";

/**
 * Genera el .pkpass firmado de un cliente.
 * @param {object} cliente  fila de clientes (con auth_token)
 * @param {object} negocio  negocio compuesto (getNegocio)
 * @param {ReturnType<typeof configApple>} [config]  por defecto, la de la tienda
 *   (su Pass Type ID propio o el general). El web service pasa la del pase ya
 *   instalado, que no puede cambiar.
 * @returns {Promise<Buffer>}
 */
export async function generarPkpass(cliente, negocio, config = configApple(negocio.slug)) {
  if (!config) throw new Error("Apple Wallet no está configurado (faltan variables APPLE_*)");

  // "● Abierto hasta las 14:00" en lo alto de la banda, con la hora de la tienda
  // al firmar. Solo con el reloj en marcha: es el que hace que el iPhone vuelva a
  // pedir el pase al abrir y al cerrar. Sin él, diría "Abierto" toda la noche.
  const estado = negocio.horario && (await relojVivo()) ? estadoDeTienda(negocio, Date.now()) : null;
  const passJson = construirPassJson(cliente, negocio, {
    passTypeId: config.passTypeId,
    teamId: config.teamId,
    appUrl: appUrl(),
  });
  const imagenes = await imagenesDelPase(negocio, cliente, { estado });

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
