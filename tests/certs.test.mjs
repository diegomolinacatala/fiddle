import { describe, it, expect } from "vitest";
import { generarCsr, cadenaDePrueba, aPem, leerCertificadoPase, claveCoincide, generarClave } from "../scripts/lib/certs.mjs";
import forge from "node-forge";

describe("scripts/lib/certs", () => {
  it("genera un CSR firmado con su clave", () => {
    const { keyPem, csrPem } = generarCsr({ nombre: "Sellos", email: "a@b.c" });
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    expect(csr.subject.getField("CN").value).toBe("Sellos");
    expect(keyPem).toContain("BEGIN PRIVATE KEY");
  });

  it("lee Pass Type ID y Team ID del certificado (PEM o DER)", () => {
    const c = cadenaDePrueba({ passTypeId: "pass.com.x.sellos", teamId: "TEAM000001" });
    const der = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(forge.pki.certificateFromPem(c.certPem))).getBytes(), "binary");
    const info = leerCertificadoPase(aPem(der));
    expect(info).toMatchObject({ passTypeId: "pass.com.x.sellos", teamId: "TEAM000001" });
    expect(info.caduca > new Date()).toBe(true);
    expect(aPem(Buffer.from(c.certPem))).toContain("BEGIN CERTIFICATE");
  });

  it("detecta si la clave no corresponde al certificado", () => {
    const c = cadenaDePrueba();
    expect(claveCoincide(c.certPem, c.keyPem)).toBe(true);
    expect(claveCoincide(c.certPem, generarClave().keyPem)).toBe(false);
  });
});
