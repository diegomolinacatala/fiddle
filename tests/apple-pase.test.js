import { describe, it, expect } from "vitest";
import { construirPassJson, hexARgb, nivelDe, ubicacionesApple } from "@/lib/apple/pase";
import { NEGOCIOS } from "@/lib/negocios";

const opciones = { passTypeId: "pass.dev.sellos", teamId: "ABCDE12345", appUrl: "https://sellos.app" };
const negocio = (slug, extra = {}) => ({ ...NEGOCIOS[slug], promo: null, ubicaciones: [], ...extra });
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
    expect(p.storeCard.secondaryFields[0]).toMatchObject({ key: "sellos", value: "3 de 8", changeMessage: "Tienes %@ sellos" });
    expect(p.storeCard.secondaryFields[1].value).toBe("Faltan 5 · café gratis");
    expect(p.coupon).toBeUndefined();
    expect(p.voided).toBeUndefined();
  });

  it("cartilla llena anuncia el premio", () => {
    const p = construirPassJson(cliente({ sellos: 9 }), negocio("nube"), opciones);
    expect(p.storeCard.secondaryFields[0].value).toBe("8 de 8");
    expect(p.storeCard.secondaryFields[1]).toMatchObject({ label: "PREMIO LISTO", value: "¡café gratis!" });
  });

  it("barbería muestra nivel en la cabecera", () => {
    const p = construirPassJson(cliente({ premios: 3 }), negocio("fade"), opciones);
    expect(p.storeCard.headerFields[0]).toMatchObject({ key: "nivel", value: "Oro" });
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
    expect(p.storeCard.auxiliaryFields).toEqual([{ key: "cliente", label: "CLIENTE", value: "Marta" }]);
    expect(p.storeCard.backFields[0]).toMatchObject({ key: "promo", value: "2x1 hoy", changeMessage: "%@" });
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
