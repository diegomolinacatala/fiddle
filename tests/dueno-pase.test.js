import { describe, it, expect } from "vitest";
import { camposDelDueno, construirPassJsonDueno, accionesDelDueno } from "../src/lib/dueno/pase";

const informe = {
  desde: "2026-11-09", hasta: "2026-11-15", etiqueta: "9 al 15 nov",
  visitas: 142, visitasAntes: 130, nuevos: 9, nuevosAntes: 7, premios: 6, premiosAntes: 6,
  porDia: [21, 24, 26, 22, 31, 8, 0].map((n, d) => ({ fecha: `2026-11-${9 + d}`, d, n, cerrado: d === 6 })),
  mejorDia: { d: 4, n: 31 },
};
const aviso = { texto: "Las tardes de martes viene menos gente.", enlace: "https://x.test/delicanteria/avisos?grupo=momento&dia=1" };
const negocio = {
  slug: "delicanteria", nombre: "La Delicantería",
  tarjetaDueno: { serial: "dueno-delicanteria-3f9c2a7b51d04e68", token: "a".repeat(48) },
};
const opciones = { passTypeId: "pass.test", teamId: "TEAM123456", appUrl: "https://fiddle.test" };

describe("campos de la tarjeta del dueño", () => {
  it("con aviso, el campo de abajo dice PARA TI y suena con su propio texto", () => {
    const c = camposDelDueno({ informe, aviso }, negocio, { base: "https://fiddle.test" });
    expect(c.auxiliaryFields).toEqual([{ key: "aviso", label: "PARA TI", value: aviso.texto, changeMessage: "%@" }]);
  });

  it("sin aviso, vuelve a PREMIOS DADOS con la misma clave y sin changeMessage", () => {
    const [campo] = camposDelDueno({ informe, aviso: null }, negocio).auxiliaryFields;
    expect(campo).toEqual({ key: "aviso", label: "PREMIOS DADOS", value: "6" });
    expect(campo).not.toHaveProperty("changeMessage");
  });

  it("la cabecera es el campo que avisa del informe", () => {
    const [h] = camposDelDueno({ informe, aviso: null }, negocio).headerFields;
    expect(h).toMatchObject({ key: "semana", label: "SEMANA", value: "9 al 15 nov" });
    expect(h.changeMessage).toMatch(/^Semana del %@: 142 visitas/);
  });

  it("sin «resumen», la semana cambia igual pero no suena", () => {
    const [h] = camposDelDueno({ informe, aviso: null }, negocio, { recibir: { resumen: false } }).headerFields;
    expect(h).toEqual({ key: "semana", label: "SEMANA", value: "9 al 15 nov" });
  });

  it("el pass.json lee lo que eligió el dueño en su tarjeta", () => {
    const callado = { ...negocio, tarjetaDueno: { ...negocio.tarjetaDueno, recibir: { resumen: false } } };
    const [h] = construirPassJsonDueno({ informe, aviso: null }, callado, opciones).storeCard.headerFields;
    expect(h).not.toHaveProperty("changeMessage");
  });

  it("deja vacío el campo principal y pone los nuevos en secundario", () => {
    const c = camposDelDueno({ informe, aviso: null }, negocio);
    expect(c.primaryFields).toEqual([]);
    expect(c.secondaryFields).toEqual([{ key: "nuevos", label: "NUEVOS", value: "9" }]);
  });

  it("el reverso trae sus cuatro campos en orden", () => {
    const c = camposDelDueno({ informe, aviso }, negocio, { base: "https://fiddle.test" });
    expect(c.backFields.map((f) => f.key)).toEqual(["para_ti", "informe", "panel", "sobre"]);
  });

  it("el aviso con enlace lo lleva tocable y con el & escapado", () => {
    const [paraTi] = camposDelDueno({ informe, aviso }, negocio).backFields;
    expect(paraTi.attributedValue).toContain('href="https://x.test/delicanteria/avisos?grupo=momento&amp;dia=1"');
    expect(paraTi.value).toContain(aviso.enlace);
  });

  it("un aviso sin enlace solo lleva el texto", () => {
    const [paraTi] = camposDelDueno({ informe, aviso: { texto: "Prueba" } }, negocio).backFields;
    expect(paraTi).toEqual({ key: "para_ti", label: "Para ti", value: "Prueba" });
  });

  it("sin aviso, el reverso dice que no hay nada pendiente", () => {
    const [paraTi] = camposDelDueno({ informe, aviso: null }, negocio).backFields;
    expect(paraTi.value).toMatch(/no hay nada pendiente/);
  });

  it("el panel enlaza Clientes, Avisos y Tienda de su tienda", () => {
    const panel = camposDelDueno({ informe, aviso: null }, negocio, { base: "https://fiddle.test" }).backFields[2];
    expect(panel.value.split("\n")).toHaveLength(3);
    expect(panel.attributedValue).toContain('href="https://fiddle.test/delicanteria/crm"');
    expect(panel.attributedValue).toContain('href="https://fiddle.test/delicanteria/avisos"');
    expect(panel.attributedValue).toContain('href="https://fiddle.test/delicanteria/manager"');
  });
});

describe("pass.json de la tarjeta del dueño", () => {
  it("lleva el web service propio, sin código de barras y sin compartir", () => {
    const p = construirPassJsonDueno({ informe, aviso: null }, negocio, opciones);
    expect(p).toMatchObject({
      formatVersion: 1, organizationName: "fiddle", logoText: "La Delicantería",
      description: "Tarjeta de dueño de La Delicantería",
      webServiceURL: "https://fiddle.test/api/dueno", sharingProhibited: true,
      serialNumber: negocio.tarjetaDueno.serial, authenticationToken: negocio.tarjetaDueno.token,
      backgroundColor: "rgb(26, 66, 47)", foregroundColor: "rgb(248, 243, 236)", labelColor: "rgb(214, 192, 165)",
    });
    expect(p).not.toHaveProperty("barcode");
    expect(p).not.toHaveProperty("barcodes");
    expect(p.storeCard.primaryFields).toEqual([]);
  });

  it("lanza sin serial o con un token corto", () => {
    const sin = { ...negocio, tarjetaDueno: { token: "a".repeat(48) } };
    const corto = { ...negocio, tarjetaDueno: { serial: "dueno-x-1", token: "abc" } };
    expect(() => construirPassJsonDueno({ informe, aviso: null }, sin, opciones)).toThrow();
    expect(() => construirPassJsonDueno({ informe, aviso: null }, corto, opciones)).toThrow();
  });

  it("no contiene ningún dato de clientes: solo cifras", () => {
    const sucio = { ...informe, clientes: [{ nombre: "Ana Pérez", codigo: "K7Q" }] };
    const texto = JSON.stringify(construirPassJsonDueno({ informe: sucio, aviso }, negocio, opciones));
    expect(texto).not.toContain("Ana");
    expect(texto).not.toContain("K7Q");
  });
});

describe("botones de debajo de la tarjeta (featuredActions, iOS 27)", () => {
  const base = { base: "https://fiddle.test" };

  it("con aviso, el primero lleva al aviso preparado y el segundo llama a fiddle", () => {
    const acciones = accionesDelDueno({ texto: "x", enlace: "https://fiddle.test/delicanteria/avisos?grupo=riesgo" }, negocio, base);
    expect(acciones).toEqual([
      { identifier: "aviso", type: "viewOffersRewards", url: "https://fiddle.test/delicanteria/avisos?grupo=riesgo" },
      { identifier: "llamar-fiddle", type: "call", url: expect.stringMatching(/^tel:\+\d{9,15}$/) },
    ]);
  });

  it("sin aviso (o con la prueba, que no lleva enlace) el primero abre Avisos con el mismo identificador", () => {
    for (const aviso of [null, { texto: "Esto es una prueba.", enlace: "" }]) {
      expect(accionesDelDueno(aviso, negocio, base)[0]).toEqual({ identifier: "aviso", type: "viewOffersRewards", url: "https://fiddle.test/delicanteria/avisos" });
    }
  });

  it("van en el pass.json, dos como mucho y solo con tipos de la lista de Apple", () => {
    const { featuredActions } = construirPassJsonDueno({ informe, aviso: null }, negocio, opciones);
    const deApple = ["viewSchedule", "watchTrailer", "listenToMusic", "call", "place", "addToBalance", "order", "shop", "membershipBenefits", "bookAppointment", "bookCar", "bookFlight", "bookStay", "viewOffersRewards"];
    expect(featuredActions.length).toBeLessThanOrEqual(2);
    expect(featuredActions.every((a) => deApple.includes(a.type))).toBe(true);
    expect(new Set(featuredActions.map((a) => a.identifier)).size).toBe(featuredActions.length);
  });
});
