import { describe, it, expect } from "vitest";
import { ACCIONES, LISTA_ACCIONES } from "@/lib/acciones";

const sellos = { tipo: "sellos", meta: 3, premio: "café gratis" };
const cupon = { tipo: "descuento", meta: 1, premio: "20%" };
const cliente = (s, p = 0) => ({ serial: "x", sellos: s, premios: p });

describe("acciones", () => {
  it("sellar suma hasta la meta y luego rechaza", () => {
    expect(ACCIONES.sellar.aplicar(cliente(2), sellos).cliente.sellos).toBe(3);
    expect(ACCIONES.sellar.aplicar(cliente(3), sellos).ok).toBe(false);
  });

  it("restar no baja de cero", () => {
    expect(ACCIONES.restar.aplicar(cliente(0), sellos).cliente.sellos).toBe(0);
    expect(ACCIONES.restar.aplicar(cliente(2), sellos).cliente.sellos).toBe(1);
  });

  it("canjear exige cartilla llena y la reinicia", () => {
    expect(ACCIONES.canjear.aplicar(cliente(2), sellos).ok).toBe(false);
    const r = ACCIONES.canjear.aplicar(cliente(3, 1), sellos);
    expect(r.cliente).toMatchObject({ sellos: 0, premios: 2 });
  });

  it("canjear un cupón solo una vez", () => {
    expect(ACCIONES.canjear.aplicar(cliente(0), cupon).cliente.premios).toBe(1);
    expect(ACCIONES.canjear.aplicar(cliente(0, 1), cupon).ok).toBe(false);
  });

  it("confirmar no cambia el estado y no muta la entrada", () => {
    const c = Object.freeze(cliente(1));
    expect(ACCIONES.confirmar.aplicar(c, sellos).cliente).toEqual(c);
    expect(() => ACCIONES.sellar.aplicar(c, sellos)).not.toThrow();
  });

  it("LISTA_ACCIONES expone todas para la UI", () => {
    expect(LISTA_ACCIONES.map((a) => a.key)).toEqual(Object.keys(ACCIONES));
  });
});
