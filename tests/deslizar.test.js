import { describe, it, expect } from "vitest";
import { progresoDe, confirmaAlSoltar, velocidadDe, UMBRAL, MITAD, TIRON } from "@/lib/deslizar";

describe("deslizar para confirmar", () => {
  it("el progreso va de 0 a 1 y no se sale", () => {
    expect(progresoDe(0, 200)).toBe(0);
    expect(progresoDe(100, 200)).toBe(0.5);
    expect(progresoDe(-40, 200)).toBe(0);
    expect(progresoDe(260, 200)).toBe(1);
    // Sin sitio para moverse (aún sin medir), nada.
    expect(progresoDe(50, 0)).toBe(0);
    expect(progresoDe(NaN, 200)).toBe(0);
  });

  it("al soltar pasado el umbral confirma; antes, vuelve", () => {
    expect(confirmaAlSoltar(UMBRAL)).toBe(true);
    expect(confirmaAlSoltar(1)).toBe(true);
    expect(confirmaAlSoltar(UMBRAL - 0.01)).toBe(false);
    expect(confirmaAlSoltar(0)).toBe(false);
  });

  it("un tirón rápido basta desde la mitad, pero no antes", () => {
    expect(confirmaAlSoltar(MITAD, TIRON)).toBe(true);
    expect(confirmaAlSoltar(MITAD - 0.01, TIRON * 3)).toBe(false);
    // Lento, o hacia atrás, no cuenta como tirón.
    expect(confirmaAlSoltar(0.7, TIRON - 0.01)).toBe(false);
    expect(confirmaAlSoltar(0.7, -2)).toBe(false);
  });

  it("la velocidad sale de los últimos 100 ms del dedo", () => {
    const rastro = [{ x: 0, t: 0 }, { x: 10, t: 200 }, { x: 60, t: 250 }, { x: 110, t: 300 }];
    // Del punto de t=200 al de t=300: 100 px en 100 ms.
    expect(velocidadDe(rastro)).toBe(1);
    expect(velocidadDe([{ x: 5, t: 0 }])).toBe(0);
    expect(velocidadDe([])).toBe(0);
  });

  it("quieto antes de soltar no es un tirón", () => {
    const rastro = [{ x: 0, t: 0 }, { x: 120, t: 50 }, { x: 120, t: 400 }];
    expect(velocidadDe(rastro)).toBe(0);
    expect(confirmaAlSoltar(0.6, velocidadDe(rastro))).toBe(false);
  });
});
