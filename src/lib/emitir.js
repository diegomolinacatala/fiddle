import { crearCliente, getNegocio } from "./store";
import { createPass, buildPassBody, isDemoWallet, nuevoSerial, appUrl } from "./walletwallet";

// Emite un pase nuevo para un negocio (el "tap NFC").
// Usamos NUESTRO serial como identidad, así el barcode ya va correcto en el POST
// y el .pkpass devuelto es instalable directamente (menos fricción).
export async function emitirPase(slug) {
  const negocio = await getNegocio(slug);
  if (!negocio) throw new Error(`Negocio desconocido: ${slug}`);

  const serial = nuevoSerial();
  const cliente = { serial, negocio: slug, sellos: 0, premios: 0 };
  const created = await createPass(buildPassBody(cliente, negocio));

  await crearCliente(serial, slug, created.wwSerial);

  return {
    serial,
    negocio: slug,
    wwSerial: created.wwSerial,
    shareUrl: created.shareUrl || `${appUrl()}/p/${serial}`, // demo: vista previa propia
    applePass: created.applePass, // base64 .pkpass (real) o null (demo)
    demo: isDemoWallet(),
  };
}
