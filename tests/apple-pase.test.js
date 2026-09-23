import { describe, it, expect } from "vitest";
import { construirPassJson, hexARgb, nivelDe, ubicacionesApple } from "@/lib/apple/pase";
import { SEMILLAS } from "@/lib/negocios";

const opciones = { passTypeId: "pass.dev.sellos", teamId: "ABCDE12345", appUrl: "https://sellos.app" };
const negocio = (slug, extra = {}) => ({ ...SEMILLAS[slug], promo: null, ubicaciones: [], ...extra });
const cliente = (extra = {}) => ({
  serial: "3f1c2b1a-1111-4222-8333-444455556666", sellos: 3, premios: 0, nombre: null,
  auth_token: "a".repeat(48), ...extra,
});

describe("construirPassJson", () => {
  it("tarjeta de sellos: storeCard con identidad, colores y web service", () => {
    const p = construirPassJson(cliente(), negocio("nube"), opciones);
    expect(p).toMatchObject({
      formatVersion: 1,
      passTypeIdentifier: "pass.dev.sellos",
      teamIdentifier: "ABCDE12345",
      serialNumber: cliente().serial,
      organizationName: "Nube Café",
      webServiceURL: "https://sellos.app/api/wallet",
      authenticationToken: "a".repeat(48),
      sharingProhibited: true,
      backgroundColor: "rgb(255, 247, 242)",
    });
    expect(p.barcodes[0]).toMatchObject({ format: "PKBarcodeFormatQR", message: `https://sellos.app/w/${cliente().serial}` });
    // Sin campo "SELLOS": los círculos de la banda ya lo cuentan. El aviso de
    // cada sello lo dispara PREMIO, que cambia con cada uno.
    expect(p.storeCard.secondaryFields).toHaveLength(1);
    expect(p.storeCard.secondaryFields[0]).toMatchObject({ key: "premio", value: "Faltan 5 · café gratis", changeMessage: "%@" });
    expect(p.coupon).toBeUndefined();
    expect(p.voided).toBeUndefined();
  });

  it("cartilla llena anuncia el premio", () => {
    const p = construirPassJson(cliente({ sellos: 9 }), negocio("nube"), opciones);
    expect(p.storeCard.secondaryFields[0]).toMatchObject({ label: "PREMIO LISTO", value: "¡café gratis!" });
  });

  it("el premio cambia con cada sello (es lo que avisa en la pantalla de bloqueo)", () => {
    const valor = (sellos) => construirPassJson(cliente({ sellos }), negocio("nube"), opciones).storeCard.secondaryFields[0].value;
    expect(valor(3)).not.toBe(valor(4));
    expect(valor(4)).not.toBe(valor(5));
  });

  it("barbería muestra nivel en la cabecera", () => {
    const p = construirPassJson(cliente({ premios: 3 }), negocio("fade"), opciones);
    expect(p.storeCard.headerFields[0]).toMatchObject({ key: "nivel", value: "Oro" });
  });

  it("como mucho dos campos bajo la banda (iOS los junta en una fila)", () => {
    const con = (extra, slug = "nube") => {
      const p = construirPassJson(cliente(extra), negocio(slug, { promo: "2x1 hoy" }), opciones);
      const c = p.storeCard || p.coupon;
      return c.secondaryFields.length + c.auxiliaryFields.length;
    };
    expect(con({ nombre: "Marta" })).toBeLessThanOrEqual(2);
    expect(con({ nombre: "Marta", premios: 2 }, "fade")).toBeLessThanOrEqual(2);
    expect(con({ nombre: "Marta", premios: 1 }, "forno")).toBeLessThanOrEqual(2);
  });

  it("cupón: coupon y se anula al usarse", () => {
    const nuevo = construirPassJson(cliente({ premios: 0 }), negocio("forno"), opciones);
    expect(nuevo.coupon.primaryFields[0]).toMatchObject({ key: "descuento", value: "20% en la Diavola" });
    expect(nuevo.voided).toBeUndefined();
    const usado = construirPassJson(cliente({ premios: 1 }), negocio("forno"), opciones);
    expect(usado.voided).toBe(true);
    expect(usado.coupon.secondaryFields[0].value).toBe("Usado");
  });

  it("nombre, promo y ubicaciones", () => {
    const p = construirPassJson(
      cliente({ nombre: "Marta" }),
      negocio("nube", { promo: "2x1 hoy", ubicaciones: [{ lat: 40.4, lng: -3.7 }] }),
      opciones,
    );
    // La promo va en la cara (auxiliaryFields): es lo único que hace que iOS
    // muestre notificación en la pantalla de bloqueo.
    expect(p.storeCard.auxiliaryFields).toEqual([
      { key: "promo", label: "PROMO", value: "2x1 hoy", changeMessage: "%@" },
    ]);
    // El nombre no aparece en la cara del pase, en ningún sitio.
    const cara = [...p.storeCard.headerFields, ...p.storeCard.primaryFields, ...p.storeCard.secondaryFields, ...p.storeCard.auxiliaryFields];
    expect(cara.some((f) => String(f.value).includes("Marta"))).toBe(false);
    expect(p.storeCard.backFields.map((f) => f.key)).toEqual(["como", "codigo", "privacidad"]);
    expect(p.storeCard.backFields.at(-1).value).toMatch(/\/privacidad\?b=nube$/);
    expect(p.locations).toEqual([{ latitude: 40.4, longitude: -3.7, relevantText: expect.stringContaining("Nube Café") }]);
  });

  it("claves de campo únicas en todo el pase", () => {
    const p = construirPassJson(cliente({ nombre: "M" }), negocio("fade", { promo: "x" }), opciones);
    const s = p.storeCard;
    const claves = [...s.headerFields, ...s.primaryFields, ...s.secondaryFields, ...s.auxiliaryFields, ...s.backFields].map((f) => f.key);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("exige authenticationToken de al menos 16 caracteres", () => {
    expect(() => construirPassJson(cliente({ auth_token: "corto" }), negocio("nube"), opciones)).toThrow(/authenticationToken/);
    expect(() => construirPassJson(cliente({ auth_token: null }), negocio("nube"), opciones)).toThrow();
  });
});

describe("utilidades", () => {
  it("hexARgb", () => {
    expect(hexARgb("#c9a24b")).toBe("rgb(201, 162, 75)");
    expect(() => hexARgb("rojo")).toThrow();
  });

  it("nivelDe", () => {
    expect([0, 1, 2, 3, 9].map(nivelDe)).toEqual(["Bronce", "Plata", "Plata", "Oro", "Oro"]);
  });

  it("ubicacionesApple descarta inválidas y limita a 10", () => {
    const muchas = Array.from({ length: 12 }, (_, i) => ({ lat: i, lng: i, texto: "hola" }));
    const n = { nombre: "X", ubicaciones: [{ lat: "a", lng: 1 }, ...muchas] };
    const r = ubicacionesApple(n);
    expect(r).toHaveLength(10);
    expect(r[0]).toEqual({ latitude: 0, longitude: 0, relevantText: "hola" });
  });
});
