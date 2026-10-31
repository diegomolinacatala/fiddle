import forge from "node-forge";
import { createPrivateKey, privateEncrypt, constants } from "node:crypto";

// ============================================================================
// APPLE WALLET — el RSA de la firma, con el crypto de Node
// ----------------------------------------------------------------------------
// passkit-generator firma cada .pkpass con node-forge, que hace el RSA en
// JavaScript (~40 ms de CPU) y además vuelve a descifrar la clave en cada pase
// (~10 ms). Cuando el reloj empuja «Abierto / Cerrado» a todos los iPhone son
// cientos de firmas seguidas, y en Vercel se paga la CPU activa.
//
// passkit no deja pasarle una clave ya preparada: lo único que llama es
// `forge.pki.decryptRsaPrivateKey`. Por eso se envuelve esa función para que
// (1) recuerde la clave ya descifrada y (2) su `sign` haga el RSA con OpenSSL.
// PKCS#1 v1.5 es determinista: la firma sale byte a byte igual que la de forge
// (lo fija tests/apple-firma-nativa.test.js). Si algo falla, firma forge.
//
// Funciona porque forge es UNO para todos: `node-forge` va en
// serverExternalPackages, como passkit-generator. Si un día passkit trajera su
// propia copia, esto dejaría de aplicarse sin romper nada (solo volvería a ir
// lento); el test lo vigila.
// ============================================================================

const ESQUEMA = "RSASSA-PKCS1-V1_5";
const MAX_CLAVES = 8; // la general y, como mucho, alguna de tienda (suelen ser la misma)

/** DigestInfo DER del resumen (lo mismo que emsaPkcs1v15encode de forge). */
function digestInfo(md) {
  const oid = forge.pki.oids[md.algorithm];
  if (!oid) throw new Error(`Resumen desconocido: ${md.algorithm}`);
  const { asn1 } = forge;
  const U = asn1.Class.UNIVERSAL;
  const der = asn1.toDer(asn1.create(U, asn1.Type.SEQUENCE, true, [
    asn1.create(U, asn1.Type.SEQUENCE, true, [
      asn1.create(U, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
      asn1.create(U, asn1.Type.NULL, false, ""),
    ]),
    asn1.create(U, asn1.Type.OCTETSTRING, false, md.digest().getBytes()),
  ])).getBytes();
  return Buffer.from(der, "binary");
}

/** La clave de forge, con su `sign` hecho por OpenSSL (y el de forge de reserva). */
function conFirmaNativa(clave) {
  const nativa = createPrivateKey(forge.pki.privateKeyToPem(clave));
  const firmaForge = clave.sign.bind(clave);
  clave.sign = (md, esquema) => {
    const pkcs1 = esquema === undefined || String(esquema).toUpperCase() === ESQUEMA;
    if (!pkcs1) return firmaForge(md, esquema);
    try {
      return privateEncrypt({ key: nativa, padding: constants.RSA_PKCS1_PADDING }, digestInfo(md)).toString("binary");
    } catch (e) {
      console.error("[apple] la firma nativa falló, firma forge:", e);
      return firmaForge(md, esquema);
    }
  };
  return clave;
}

let instalada = false;

/** Envuelve `forge.pki.decryptRsaPrivateKey` una sola vez. Idempotente. */
export function instalarFirmaNativa() {
  if (instalada) return;
  instalada = true;
  const descifrar = forge.pki.decryptRsaPrivateKey;
  const claves = new Map(); // `${frase}\0${pem}` -> clave de forge ya preparada
  forge.pki.decryptRsaPrivateKey = (pem, frase) => {
    const id = `${frase ?? ""}\0${pem}`;
    if (claves.has(id)) return claves.get(id);
    const clave = descifrar(pem, frase);
    if (!clave) return clave; // frase mala: que passkit dé su error de siempre
    let lista = clave;
    try {
      lista = conFirmaNativa(clave);
    } catch (e) {
      console.error("[apple] sin firma nativa, firma forge:", e);
    }
    if (claves.size >= MAX_CLAVES) claves.delete(claves.keys().next().value);
    claves.set(id, lista);
    return lista;
  };
}
