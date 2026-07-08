import { crearCliente, getPrograma } from "./store";
import { createPass, updatePass, buildPassBody, isDemoWallet } from "./walletwallet";

// Emite un pase nuevo (el "tap NFC" de la tienda).
// El serial lo genera WalletWallet, así que: POST (placeholder) -> guardar ->
// PUT con el barcode real que apunta a /w/<serial>.
export async function emitirPase() {
  const prog = await getPrograma();

  const created = await createPass(buildPassBody({ serial: null, sellos: 0, premios: 0 }, prog));
  const serial = created.serialNumber;

  await crearCliente(serial);
  await updatePass(serial, buildPassBody({ serial, sellos: 0, premios: 0 }, prog));

  return { serial, shareUrl: created.shareUrl, demo: isDemoWallet() };
}
