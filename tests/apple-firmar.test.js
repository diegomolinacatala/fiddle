import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import forge from "node-forge";
import { generarPkpass } from "@/lib/apple/firmar";
import { configApple, configsDeTienda, faltanVariablesTienda, tiendasConPassTypePropio, variablesDe, leerPem, hayApple, faltanVariablesApple } from "@/lib/apple/config";
import { imagenesDelPase, rejillaSellos } from "@/lib/apple/imagenes";
import { SEMILLAS, componerNegocio } from "@/lib/negocios";
import { cadenaDePrueba, otroPassTypeDePrueba, aBase64 } from "../scripts/lib/certs.mjs";

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

const negocio = (slug) => ({ ...SEMILLAS[slug], promo: null, ubicaciones: [] });
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

// Wallet apila las tarjetas que comparten Pass Type ID: una tienda se separa
// con el suyo propio (dos variables más; clave, Team ID y WWDR se comparten).
describe("Pass Type ID propio de una tienda", () => {
  const stubTienda = (slug, passTypeId) => {
    const propio = otroPassTypeDePrueba(cadena, passTypeId);
    const vars = variablesDe(slug);
    vi.stubEnv(vars.passTypeId, passTypeId);
    vi.stubEnv(vars.cert, aBase64(propio.certPem));
    return propio;
  };

  it("las variables llevan el slug en mayúsculas y con _", () => {
    expect(variablesDe("la-deli")).toEqual({ passTypeId: "APPLE_PASS_TYPE_ID_LA_DELI", cert: "APPLE_PASS_CERT_LA_DELI" });
    expect(variablesDe()).toEqual({ passTypeId: "APPLE_PASS_TYPE_ID", cert: "APPLE_PASS_CERT" });
  });

  it("con las dos variables, la tienda firma con lo suyo y comparte el resto", () => {
    stubApple();
    const propio = stubTienda("la-deli", "pass.dev.deli");
    const c = configApple("la-deli");
    expect(c).toMatchObject({ passTypeId: "pass.dev.deli", cert: propio.certPem, tienda: "la-deli", teamId: cadena.teamId });
    expect(c.key).toBe(configApple().key);
    expect(configsDeTienda("la-deli").map((x) => x.passTypeId)).toEqual(["pass.dev.deli", cadena.passTypeId]);
  });

  it("sin ellas (u otra tienda), la general", () => {
    stubApple();
    stubTienda("la-deli", "pass.dev.deli");
    expect(configApple("nube")).toMatchObject({ passTypeId: cadena.passTypeId, tienda: null });
    expect(configsDeTienda("nube").map((x) => x.passTypeId)).toEqual([cadena.passTypeId]);
    expect(faltanVariablesTienda("nube")).toEqual([]);
  });

  it("con una sola, la general, y se sabe qué falta", () => {
    stubApple();
    vi.stubEnv("APPLE_PASS_TYPE_ID_LA_DELI", "pass.dev.deli");
    expect(configApple("la-deli").passTypeId).toBe(cadena.passTypeId);
    expect(faltanVariablesTienda("la-deli")).toEqual(["APPLE_PASS_CERT_LA_DELI"]);
  });

  it("el panel lista las tiendas con ID propio, también las que están a medias", () => {
    stubApple();
    stubTienda("la-deli", "pass.dev.deli");
    vi.stubEnv("APPLE_PASS_CERT_FADE", "x");
    vi.stubEnv("APPLE_PASS_TYPE_ID_NUBE", ""); // vacía = no está
    expect(tiendasConPassTypePropio()).toEqual(["fade", "la-deli"]);
  });

  it("sin Apple general no hay config de tienda", () => {
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    stubTienda("la-deli", "pass.dev.deli");
    expect(configApple("la-deli")).toBeNull();
    expect(configsDeTienda("la-deli")).toEqual([]);
  });

  it("el .pkpass de la tienda sale con su Pass Type ID y su certificado", async () => {
    stubApple();
    vi.stubEnv("APP_URL", "https://sellos.app");
    stubTienda("nube", "pass.dev.nube");
    const f = leerZip(await generarPkpass(cliente, negocio("nube")));
    expect(JSON.parse(f["pass.json"]).passTypeIdentifier).toBe("pass.dev.nube");
    // Firmado con SU certificado: si no, el iPhone lo rechaza.
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(f.signature.toString("binary"))));
    const sujetos = p7.certificates.map((c) => c.subject.getField("CN")?.value);
    expect(sujetos).toContain("Pass Type ID: pass.dev.nube");
    expect(sujetos).not.toContain(`Pass Type ID: ${cadena.passTypeId}`);
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
    expect(JSON.stringify(pase.storeCard)).not.toContain("Marta"); // el nombre no va en el pase

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

  it("con dos cartillas, la strip cambia también con la segunda", async () => {
    const cartillas = [
      { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
      { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
    ];
    const deli = componerNegocio("delicanteria", { nombre: "La Delicantería", tipo: "sellos", config: { cartillas, tema: { estilo: "galletas" } } });
    const a = await imagenesDelPase(deli, { sellos: 3, sellos2: 1, premios: 0 });
    const b = await imagenesDelPase(deli, { sellos: 3, sellos2: 2, premios: 0 });
    expect(a["strip.png"].equals(b["strip.png"])).toBe(false);
  });

  it("rejillaSellos reparte en filas según la meta", () => {
    expect(new Set(rejillaSellos(6, 300, 100, 10).map((p) => p.cy)).size).toBe(1);
    expect(new Set(rejillaSellos(8, 300, 100, 10).map((p) => p.cy)).size).toBe(2);
    expect(new Set(rejillaSellos(30, 300, 100, 10).map((p) => p.cy)).size).toBe(3);
  });
});
