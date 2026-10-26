import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { createPublicKey, publicDecrypt, constants } from "node:crypto";
import forge from "node-forge";
import { PKPass } from "passkit-generator";
import { instalarFirmaNativa } from "@/lib/apple/firmaNativa";
import { cadenaDePrueba } from "../scripts/lib/certs.mjs";

// La firma del .pkpass con el RSA de Node (lib/apple/firmaNativa.js). Lo que
// importa: que sea la MISMA firma que la de forge (Wallet no nota nada) y que
// passkit de verdad la use (si no, el ahorro de CPU no existe).

let cadena;
let descifrarOriginal;
beforeAll(() => {
  cadena = cadenaDePrueba();
  descifrarOriginal = forge.pki.decryptRsaPrivateKey;
  instalarFirmaNativa();
});

const resumen = (texto) => {
  const md = forge.md.sha1.create();
  md.update(texto);
  return md;
};

describe("firma nativa del pase", () => {
  it("firma byte a byte igual que forge", () => {
    const deForge = descifrarOriginal(cadena.keyPem);
    const nativa = forge.pki.decryptRsaPrivateKey(cadena.keyPem);
    expect(nativa).not.toBe(deForge);
    for (const texto of ["", "manifest", "x".repeat(5000)]) {
      expect(nativa.sign(resumen(texto))).toBe(deForge.sign(resumen(texto)));
      expect(nativa.sign(resumen(texto), "RSASSA-PKCS1-V1_5")).toBe(deForge.sign(resumen(texto), "RSASSA-PKCS1-V1_5"));
    }
  });

  it("recuerda la clave: no la vuelve a descifrar en cada pase", () => {
    expect(forge.pki.decryptRsaPrivateKey(cadena.keyPem)).toBe(forge.pki.decryptRsaPrivateKey(cadena.keyPem));
  });

  it("con clave cifrada y su frase, igual; con la frase mala, null como siempre", () => {
    const cifrada = forge.pki.encryptRsaPrivateKey(forge.pki.privateKeyFromPem(cadena.keyPem), "un café por favor");
    const k = forge.pki.decryptRsaPrivateKey(cifrada, "un café por favor");
    expect(k.sign(resumen("hola"))).toBe(descifrarOriginal(cadena.keyPem).sign(resumen("hola")));
    expect(forge.pki.decryptRsaPrivateKey(cifrada, "otra")).toBeNull();
  });

  it("passkit firma con ella y la firma vale con el certificado", () => {
    // Contamos las firmas nativas: la clave que devuelve la función envuelta.
    const clave = forge.pki.decryptRsaPrivateKey(cadena.keyPem);
    const sign = clave.sign;
    let nativas = 0;
    clave.sign = (...a) => { nativas += 1; return sign(...a); };
    try {
      const pase = new PKPass(
        {
          "pass.json": Buffer.from(JSON.stringify({
            formatVersion: 1, passTypeIdentifier: cadena.passTypeId, teamIdentifier: cadena.teamId,
            serialNumber: "s1", organizationName: "fiddle", description: "Prueba", storeCard: {},
          })),
          "icon.png": Buffer.from("png"),
        },
        { wwdr: cadena.wwdrPem, signerCert: cadena.certPem, signerKey: cadena.keyPem },
      );
      const ficheros = pase.getAsRaw();
      expect(nativas).toBe(1);

      // La firma RSA del SignerInfo, comprobada con OpenSSL y la clave pública del certificado.
      const p7 = forge.asn1.fromDer(forge.util.createBuffer(ficheros.signature.toString("binary")));
      const msg = forge.pkcs7.messageFromAsn1(p7);
      const signerInfo = p7.value[1].value[0].value[4].value[0];
      const firma = Buffer.from(signerInfo.value[5].value, "binary");
      const atributos = signerInfo.value[3];
      const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, atributos.value);
      const md = forge.md.sha1.create();
      md.update(forge.asn1.toDer(set).getBytes());
      const publica = createPublicKey(cadena.certPem);
      const digestInfo = publicDecrypt({ key: publica, padding: constants.RSA_PKCS1_PADDING }, firma);
      expect(digestInfo.subarray(-20).toString("hex")).toBe(md.digest().toHex());
      expect(msg.certificates.length).toBe(2);
    } finally {
      clave.sign = sign;
    }
  });

  it("es el mismo forge que usa passkit (si no, no se aplicaría)", () => {
    const require = createRequire(import.meta.url);
    const dePasskit = require(require.resolve("node-forge", { paths: [require.resolve("passkit-generator")] }));
    expect(dePasskit.pki.decryptRsaPrivateKey).toBe(forge.pki.decryptRsaPrivateKey);
  });
});
