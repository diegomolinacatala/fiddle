import { describe, it, expect } from "vitest";
import { ACCIONES, LISTA_ACCIONES, SEGUNDOS_DESHACER, tieneDeshacer } from "@/lib/acciones";

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

  it("LISTA_ACCIONES expone las que el manager activa; las de la segunda cartilla y las del premio van solas", () => {
    expect(LISTA_ACCIONES.map((a) => a.key)).toEqual(["sellar", "restar", "canjear", "confirmar"]);
    expect(LISTA_ACCIONES.map((a) => a.key)).not.toContain("sellar2");
  });
});

describe("deshacer un premio", () => {
  it("solo lo que mueve un premio se puede deshacer, y unos segundos", () => {
    const con = Object.keys(ACCIONES).filter(tieneDeshacer);
    expect(con.sort()).toEqual(["canjear", "canjear2", "guardar", "guardar2", "usarGuardado", "usarGuardado2"]);
    expect(tieneDeshacer("sellar")).toBe(false);
    expect(tieneDeshacer("nada")).toBe(false);
    expect(SEGUNDOS_DESHACER).toBeGreaterThanOrEqual(5);
    expect(SEGUNDOS_DESHACER).toBeLessThanOrEqual(10);
  });

  it("al deshacer, la caja dice en qué queda la tarjeta", () => {
    expect(ACCIONES.canjear.deshecho(sellos)).toBe("Deshecho. La cartilla sigue completa: el premio no se ha dado.");
    expect(ACCIONES.canjear.deshecho(cupon)).toBe("Deshecho. El cupón sigue sin usar.");
    expect(ACCIONES.guardar.deshecho(sellos)).toBe("Deshecho. La cartilla sigue completa: no se ha guardado nada.");
    expect(ACCIONES.usarGuardado.deshecho(sellos)).toBe("Deshecho. El premio sigue guardado en su tarjeta.");
    const dos = { ...sellos, cartillas: [{ nombre: "Cookies", meta: 8, premio: "cookie" }, { nombre: "Cafés", meta: 8, premio: "café" }] };
    expect(ACCIONES.canjear2.deshecho(dos)).toBe("Deshecho. La cartilla de cafés sigue completa: el premio no se ha dado.");
    expect(ACCIONES.guardar2.deshecho(dos)).toMatch(/de cafés/);
  });
});
