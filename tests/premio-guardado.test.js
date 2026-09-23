import { describe, it, expect } from "vitest";
import { ACCIONES, accionPermitida, premiosDe } from "@/lib/acciones";
import { componerNegocio } from "@/lib/negocios";
import { camposDelPase } from "@/lib/apple/pase";
import { avisoDeCambio } from "@/lib/avisos";
import { construirObjeto } from "@/lib/google/pase";

const crearPaseGoogle = (c, n) => construirObjeto(c, n, { issuerId: "3388", appUrl: "https://fiddle.test" });

const nube = componerNegocio("nube", null); // 8 sellos, café gratis
const deli = componerNegocio("delicanteria", {
  nombre: "La Delicantería",
  tipo: "sellos",
  config: {
    acciones: ["sellar", "canjear", "restar"],
    cartillas: [
      { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
      { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
    ],
  },
});
const cliente = (o = {}) => ({ serial: "x", codigo: "K7M", sellos: 0, sellos2: 0, premios: 0, guardados: 0, guardados2: 0, ...o });

describe("guardar el premio en vez de gastarlo", () => {
  it("con la cartilla llena: la vacía y apunta el premio guardado", () => {
    const r = ACCIONES.guardar.aplicar(cliente({ sellos: 8, premios: 2 }), nube);
    expect(r.cliente).toMatchObject({ sellos: 0, guardados: 1, premios: 2 });
    expect(r.mensaje).toMatch(/guardado/i);
    expect(ACCIONES.guardar.aplicar(cliente({ sellos: 7 }), nube).ok).toBe(false);
  });

  it("se pueden acumular y se gastan de uno en uno, sin tocar los sellos", () => {
    let c = cliente({ sellos: 8, guardados: 1 });
    c = ACCIONES.guardar.aplicar(c, nube).cliente;
    expect(c).toMatchObject({ sellos: 0, guardados: 2 });
    c = { ...c, sellos: 3 };
    c = ACCIONES.usarGuardado.aplicar(c, nube).cliente;
    expect(c).toMatchObject({ sellos: 3, guardados: 1, premios: 1 });
    expect(ACCIONES.usarGuardado.aplicar(cliente(), nube).ok).toBe(false);
  });

  it("con la cartilla llena se sigue pudiendo dar ya, como siempre", () => {
    expect(ACCIONES.canjear.aplicar(cliente({ sellos: 8, guardados: 1 }), nube).cliente).toMatchObject({ sellos: 0, guardados: 1, premios: 1 });
  });

  it("sellar una cartilla llena no suma: pide dar o guardar", () => {
    const r = ACCIONES.sellar.aplicar(cliente({ sellos: 8 }), nube);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/guárdaselo/);
  });

  it("dos cartillas: cada una guarda su propio premio", () => {
    const r = ACCIONES.guardar2.aplicar(cliente({ sellos: 3, sellos2: 8 }), deli);
    expect(r.cliente).toMatchObject({ sellos: 3, sellos2: 0, guardados: 0, guardados2: 1 });
    expect(r.mensaje).toMatch(/cafés/);
    const u = ACCIONES.usarGuardado2.aplicar(r.cliente, deli);
    expect(u.mensaje).toBe("Premio entregado: café gratis");
  });

  it("guardar y usar van con 'canjear': sin él, la caja no puede", () => {
    expect(accionPermitida(nube, "guardar")).toBe(true);
    expect(accionPermitida(nube, "usarGuardado")).toBe(true);
    expect(accionPermitida(nube, "guardar2")).toBe(false); // una sola cartilla
    expect(accionPermitida(deli, "guardar2")).toBe(true);
    expect(accionPermitida({ ...nube, acciones: ["sellar"] }, "guardar")).toBe(false);
  });

  it("un cupón no se guarda", () => {
    const cupon = { ...nube, tipo: "descuento" };
    expect(ACCIONES.guardar.aplicar(cliente(), cupon).ok).toBe(false);
    expect(premiosDe(cliente(), cupon)).toEqual([]);
  });
});

describe("el recuadro del premio en la caja", () => {
  it("solo sale si hay algo que dar", () => {
    expect(premiosDe(cliente({ sellos: 5 }), nube)).toEqual([]);
    expect(premiosDe(cliente({ sellos: 8 }), nube)).toEqual([
      { indice: 0, nombre: null, premio: "café gratis", completa: true, guardados: 0, acciones: { dar: "canjear", guardar: "guardar", usar: "usarGuardado" } },
    ]);
    expect(premiosDe(cliente({ sellos: 2, guardados: 2 }), nube)[0]).toMatchObject({ completa: false, guardados: 2 });
  });

  it("con dos cartillas, uno por cartilla y con sus claves", () => {
    const p = premiosDe(cliente({ sellos: 8, guardados2: 1 }), deli);
    expect(p.map((x) => [x.nombre, x.completa, x.guardados, x.acciones.usar])).toEqual([
      ["Cookies", true, 0, "usarGuardado"],
      ["Cafés", false, 1, "usarGuardado2"],
    ]);
  });
});

describe("el cliente lo ve en su tarjeta", () => {
  it("el pase de Apple lo pone en la cabecera y lo explica en el reverso", () => {
    const { headerFields, backFields } = camposDelPase(cliente({ sellos: 2, guardados: 1, premios: 4 }), nube);
    expect(headerFields).toEqual([{ key: "guardados", label: "PREMIO GUARDADO", value: 1, changeMessage: "Premios guardados en tu tarjeta: %@" }]);
    expect(backFields[0]).toMatchObject({ key: "guardados", label: "Premios guardados" });
    expect(backFields[0].value).toMatch(/1 × café gratis/);
    // Sin premios guardados, la cabecera de siempre.
    expect(camposDelPase(cliente({ premios: 4 }), nube).headerFields[0].key).toBe("canjeados");
  });

  it("con dos cartillas suma los dos y el reverso dice cuáles", () => {
    const { headerFields, backFields } = camposDelPase(cliente({ guardados: 1, guardados2: 2 }), deli);
    expect(headerFields[0]).toMatchObject({ label: "PREMIOS GUARDADOS", value: 3 });
    expect(backFields[0].value).toMatch(/1 × cookie gratis\n2 × café gratis/);
  });

  it("Android: guardar no se anuncia como canje, y usarlo sí", () => {
    const guardado = avisoDeCambio(cliente({ sellos: 8 }), cliente({ sellos: 0, guardados: 1 }), nube);
    expect(guardado).toMatchObject({ tipo: "guardado" });
    expect(guardado.cuerpo).toMatch(/^Premio guardado: café gratis/);
    const usado = avisoDeCambio(cliente({ guardados: 2 }), cliente({ guardados: 1, premios: 1 }), nube);
    expect(usado).toMatchObject({ tipo: "canje", cuerpo: "Premio canjeado: café gratis. Te queda 1 guardado." });
    const deDos = avisoDeCambio(cliente({ sellos2: 8 }), cliente({ sellos2: 0, guardados2: 1 }), deli);
    expect(deDos.cuerpo).toMatch(/café gratis.*cartilla de cafés/);
  });

  it("Google Wallet enseña los guardados en vez de los canjeados", () => {
    const o = crearPaseGoogle(cliente({ guardados: 2, premios: 5 }), nube);
    expect(o.secondaryLoyaltyPoints).toEqual({ label: "Premios guardados", balance: { int: 2 } });
  });
});
