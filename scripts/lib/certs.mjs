// Utilidades de certificados para Apple Wallet (las usan scripts/apple-setup.mjs
// y los tests). Claves con node:crypto (rápido); certificados/CSR con node-forge.
import { generateKeyPairSync, createPublicKey, createPrivateKey } from "node:crypto";
import forge from "node-forge";

const pki = forge.pki;

/** Par RSA 2048 en PEM (PKCS#8 la privada). */
export function generarClave() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { keyPem: privateKey, publicPem: publicKey };
}

/**
 * CSR para subir a developer.apple.com (sustituye a "Acceso a Llaveros" de macOS).
 * @returns {{keyPem:string, csrPem:string}}
 */
export function generarCsr({ nombre = "Sellos Wallet", email } = {}) {
  const { keyPem, publicPem } = generarClave();
  const csr = pki.createCertificationRequest();
  csr.publicKey = pki.publicKeyFromPem(publicPem);
  csr.setSubject([
    { name: "commonName", value: nombre },
    ...(email ? [{ name: "emailAddress", value: email }] : []),
    { name: "countryName", value: "ES" },
  ]);
  csr.sign(pki.privateKeyFromPem(keyPem), forge.md.sha256.create());
  return { keyPem, csrPem: pki.certificationRequestToPem(csr) };
}

function certificado({ subject, issuer, publicPem, firmanteKeyPem, esCA, dias = 365 }) {
  const cert = pki.createCertificate();
  cert.publicKey = pki.publicKeyFromPem(publicPem);
  cert.serialNumber = `01${forge.util.bytesToHex(forge.random.getBytesSync(8))}`;
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + dias * 86_400_000);
  cert.setSubject(subject);
  cert.setIssuer(issuer);
  cert.setExtensions(esCA
    ? [{ name: "basicConstraints", cA: true }, { name: "keyUsage", keyCertSign: true, digitalSignature: true }]
    : [{ name: "basicConstraints", cA: false }, { name: "keyUsage", digitalSignature: true }]);
  cert.sign(pki.privateKeyFromPem(firmanteKeyPem), forge.md.sha256.create());
  return pki.certificateToPem(cert);
}

/**
 * Cadena FALSA (CA "WWDR de prueba" -> certificado de Pass Type ID) para probar
 * la firma y el web service en local. Un iPhone NO acepta estos pases.
 */
export function cadenaDePrueba({ passTypeId = "pass.dev.sellos.prueba", teamId = "ABCDE12345" } = {}) {
  const ca = generarClave();
  const firmante = generarClave();
  const sujetoCA = [{ name: "commonName", value: "WWDR de prueba (no es Apple)" }];
  const wwdrPem = certificado({ subject: sujetoCA, issuer: sujetoCA, publicPem: ca.publicPem, firmanteKeyPem: ca.keyPem, esCA: true });
  const certPem = certificado({
    subject: [
      { type: "0.9.2342.19200300.100.1.1", value: passTypeId }, // UID
      { name: "commonName", value: `Pass Type ID: ${passTypeId}` },
      { name: "organizationalUnitName", value: teamId },
    ],
    issuer: sujetoCA,
    publicPem: firmante.publicPem,
    firmanteKeyPem: ca.keyPem,
    esCA: false,
  });
  return { wwdrPem, certPem, keyPem: firmante.keyPem, caKeyPem: ca.keyPem, passTypeId, teamId };
}

/** Acepta .cer en DER (lo que descarga Apple) o PEM. */
export function aPem(buffer) {
  const texto = buffer.toString("utf8");
  if (texto.includes("-----BEGIN CERTIFICATE-----")) return texto.trim() + "\n";
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buffer.toString("binary")));
  return pki.certificateToPem(pki.certificateFromAsn1(asn1));
}

/**
 * Datos de un certificado de Pass Type ID de Apple.
 * @returns {{passTypeId:string|null, teamId:string|null, caduca:Date, emisor:string}}
 */
export function leerCertificadoPase(certPem) {
  const cert = pki.certificateFromPem(certPem);
  const campo = (nombreOTipo) =>
    cert.subject.attributes.find((a) => a.name === nombreOTipo || a.type === nombreOTipo)?.value ?? null;
  return {
    passTypeId: campo("0.9.2342.19200300.100.1.1"),
    teamId: campo("organizationalUnitName"),
    caduca: cert.validity.notAfter,
    emisor: cert.issuer.attributes.map((a) => a.value).join(", "),
  };
}

/** ¿La clave privada corresponde al certificado? */
export function claveCoincide(certPem, keyPem, passphrase) {
  const publicaCert = createPublicKey(certPem).export({ type: "spki", format: "der" });
  const publicaClave = createPublicKey(createPrivateKey({ key: keyPem, passphrase })).export({ type: "spki", format: "der" });
  return publicaCert.equals(publicaClave);
}

/** PEM -> base64 en una línea (cómodo para variables de entorno de Vercel). */
export const aBase64 = (pem) => Buffer.from(pem, "utf8").toString("base64");
