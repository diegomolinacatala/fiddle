import { describe, it, expect } from "vitest";
import { entre, ceros, mayorCambio, duracionDe, frenando } from "@/lib/animar";

describe("entre: de lo que se vio a lo que hay", () => {
  it("a medio camino entre dos cuentas, en entero", () => {
    expect(entre(10, 20, 0.5)).toBe(15);
    expect(entre(0, 3, 0.5)).toBe(2);
    expect(entre(1, 2, 0.5)).toBeTypeOf("number");
    expect(Number.isInteger(entre(0, 7, 0.33))).toBe(true);
  });

  it("con decimales, decimales (la media de la rejilla)", () => {
    expect(entre(0.5, 1.5, 0.5)).toBeCloseTo(1);
  });

  it("al llegar es exactamente lo de ahora", () => {
    const b = { total: 12, porEstado: { nuevo: 3 }, embudo: [{ key: "a", n: 4 }] };
    expect(entre(ceros(b), b, 1)).toEqual(b);
  });

  it("tiene siempre la forma de lo nuevo: lo que antes no estaba sale ya con su valor", () => {
    expect(entre({ a: 1 }, { a: 3, b: 7, c: "x" }, 0)).toEqual({ a: 1, b: 7, c: "x" });
    expect(entre(null, 5, 0.5)).toBe(5);
    expect(entre({ v: null }, { v: null }, 0.5)).toEqual({ v: null });
  });

  it("las fechas y las ventanas no se mueven (un inicio desde 0 sería 1970)", () => {
    const b = { inicio: 1_760_000_000_000, dias: 30, total: 10 };
    const z = ceros(b);
    expect(z).toEqual({ inicio: b.inicio, dias: 30, total: 0 });
    expect(entre(z, b, 0.5).inicio).toBe(b.inicio);
  });

  it("empareja las listas por su llave, no por la posición (la serie se corre un día)", () => {
    const antes = [{ dia: "2026-11-04", n: 5 }, { dia: "2026-11-05", n: 9 }];
    const ahora = [{ dia: "2026-11-05", n: 9 }, { dia: "2026-11-06", n: 2 }];
    expect(entre(antes, ahora, 0)).toEqual([{ dia: "2026-11-05", n: 9 }, { dia: "2026-11-06", n: 2 }]);
    expect(entre([{ key: "x", n: 0 }], [{ key: "x", n: 10 }], 0.5)).toEqual([{ key: "x", n: 5 }]);
  });

  it("listas de listas (la rejilla horaria)", () => {
    expect(entre([[0, 2]], [[4, 2]], 0.5)).toEqual([[2, 2]]);
  });
});

describe("cuánto se mueve", () => {
  it("sin cambios no hay animación", () => {
    const b = { total: 4, lista: [{ key: "a", n: 1 }] };
    expect(mayorCambio(b, b)).toBe(0);
    expect(duracionDe(b, b)).toBe(0);
  });

  it("más salto, algo más largo, con tope", () => {
    expect(duracionDe(0, 1)).toBeGreaterThan(0);
    expect(duracionDe(0, 1000)).toBeGreaterThan(duracionDe(0, 1));
    expect(duracionDe(0, 1e9)).toBeLessThanOrEqual(1600);
  });

  it("frena al llegar", () => {
    expect(frenando(0)).toBe(0);
    expect(frenando(1)).toBe(1);
    expect(frenando(0.5)).toBeGreaterThan(0.5);
  });
});
