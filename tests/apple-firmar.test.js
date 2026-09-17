import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import forge from "node-forge";
import { generarPkpass } from "@/lib/apple/firmar";
import { configApple, leerPem, hayApple, faltanVariablesApple } from "@/lib/apple/config";
import { imagenesDelPase, rejillaSellos } from "@/lib/apple/imagenes";
import { NEGOCIOS } from "@/lib/negocios";
import { cadenaDePrueba, aBase64 } from "../scripts/lib/certs.mjs";

// Lector mínimo de zip (entradas stored o deflate) para inspeccionar el .pkpass.
function leerZip(buffer) {
  const ficheros = {};
  let i = 0;
  while (buffer.readUInt32LE(i) === 0x04034b50) {
    const metodo = buffer.readUInt16LE(i + 8);
    const tamComprimido = buffer.readUInt32LE(i + 18);
    const largoNombre = buffer.readUInt16LE(i + 26);
    const largoExtra = buffer.readUInt16LE(i + 28);
    const nombre = buffer.toString("utf8", i + 30, i + 30 + largoNombre);
    const inicio = i + 30 + largoNombre + largoExtra;
    const datos = buffer.subarray(inicio, inicio + tamComprimido);
    ficheros[nombre] = metodo === 8 ? inflateRawSync(datos) : Buffer.from(datos);
    i = inicio + tamComprimido;
  }
  return ficheros;
}

const negocio = (slug) => ({ ...NEGOCIOS[slug], promo: null, ubicaciones: [] });
const cliente = { serial: "3f1c2b1a-1111-4222-8333-444455556666", negocio: "nube", sellos: 4, premios: 0, nombre: "Marta", auth_token: "b".repeat(48) };

let cadena;
beforeAll(() => { cadena = cadenaDePrueba(); });
afterEach(() => vi.unstubAllEnvs());

function stubApple() {
  vi.stubEnv("APPLE_PASS_TYPE_ID", cadena.passTypeId);
  vi.stubEnv("APPLE_TEAM_ID", cadena.teamId);
  vi.stubEnv("APPLE_PASS_CERT", aBase64(cadena.certPem));
  vi.stubEnv("APPLE_PASS_KEY", cadena.keyPem.replace(/\n/g, "\\n")); // PEM con \n escapados
  vi.stubEnv("APPLE_WWDR_CERT", aBase64(cadena.wwdrPem));
}

describe("config de Apple", () => {
  it("sin variables no hay Apple", () => {
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    expect(hayApple()).toBe(false);
    expect(configApple()).toBeNull();
    expect(faltanVariablesApple()).toContain("APPLE_PASS_TYPE_ID");
  });

  it("acepta PEM en base64 y con \\n escapados", () => {
    stubApple();
    const c = configApple();
    expect(c.cert).toBe(cadena.certPem);
    expect(c.key.trim()).toBe(cadena.keyPem.trim());
    expect(c.passTypeId).toBe(cadena.passTypeId);
  });

  it("rechaza valores ilegibles", () => {
    expect(() => leerPem("no-es-un-pem")).toThrow(/ilegible/);
    expect(leerPem("")).toBeNull();
  });
});

describe("generarPkpass", () => {
  it("sin configuración lanza un error claro", async () => {
    await expect(generarPkpass(cliente, negocio("nube"), null)).rejects.toThrow(/no está configurado/);
  });

  it("produce un .pkpass con pass.json, imágenes, manifest y firma válidos", async () => {
    stubApple();
    vi.stubEnv("APP_URL", "https://sellos.app");
    const zip = await generarPkpass(cliente, negocio("nube"));
    const f = leerZip(zip);

    for (const nombre of ["pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "logo.png", "strip@2x.png"]) {
      expect(f[nombre], nombre).toBeDefined();
    }

    const pase = JSON.parse(f["pass.json"].toString("utf8"));
    expect(pase.serialNumber).toBe(cliente.serial);
    expect(pase.webServiceURL).toBe("https://sellos.app/api/wallet");
    expect(pase.storeCard.auxiliaryFields[0].value).toBe("Marta");

    // El manifest tiene el SHA-1 correcto de cada fichero.
    const manifest = JSON.parse(f["manifest.json"].toString("utf8"));
    for (const [nombre, sha1] of Object.entries(manifest)) {
      expect(createHash("sha1").update(f[nombre]).digest("hex"), nombre).toBe(sha1);
    }

    // La firma es PKCS#7 e incluye nuestro certificado y el intermedio.
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(f.signature.toString("binary"))));
    const sujetos = p7.certificates.map((c) => c.subject.getField("CN")?.value);
    expect(sujetos).toContain(`Pass Type ID: ${cadena.passTypeId}`);
    expect(sujetos).toContain("WWDR de prueba (no es Apple)");
  });

  it("firma también cupones (coupon)", async () => {
    stubApple();
    const zip = await generarPkpass({ ...cliente, negocio: "forno", premios: 1 }, negocio("forno"));
    const pase = JSON.parse(leerZip(zip)["pass.json"].toString("utf8"));
    expect(pase.coupon).toBeDefined();
    expect(pase.voided).toBe(true);
  });
});

describe("imágenes", () => {
  it("genera PNG de las medidas de Apple", async () => {
    const img = await imagenesDelPase(negocio("fade"), { sellos: 2, premios: 0 });
    const medidas = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    expect(medidas(img["icon.png"])).toEqual([29, 29]);
    expect(medidas(img["icon@3x.png"])).toEqual([87, 87]);
    expect(medidas(img["strip@2x.png"])).toEqual([750, 246]);
    const cupon = await imagenesDelPase(negocio("forno"), { sellos: 0, premios: 0 });
    expect(medidas(cupon["strip.png"])).toEqual([375, 144]);
  });

  it("la strip cambia con los sellos (y se cachea igual para el mismo estado)", async () => {
    const a = await imagenesDelPase(negocio("nube"), { sellos: 1, premios: 0 });
    const b = await imagenesDelPase(negocio("nube"), { sellos: 2, premios: 0 });
    const c = await imagenesDelPase(negocio("nube"), { sellos: 1, premios: 0 });
    expect(a["strip.png"].equals(b["strip.png"])).toBe(false);
    expect(a["strip.png"]).toBe(c["strip.png"]);
  });

  it("rejillaSellos reparte en filas según la meta", () => {
    expect(new Set(rejillaSellos(6, 300, 100, 10).map((p) => p.cy)).size).toBe(1);
    expect(new Set(rejillaSellos(8, 300, 100, 10).map((p) => p.cy)).size).toBe(2);
    expect(new Set(rejillaSellos(30, 300, 100, 10).map((p) => p.cy)).size).toBe(3);
  });
});
