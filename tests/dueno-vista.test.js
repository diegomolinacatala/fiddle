import { describe, test, expect } from "vitest";
import { partesConEnlaces } from "../src/app/[negocio]/manager/partesConEnlaces";

describe("partesConEnlaces", () => {
  test("separa el enlace del texto que lo rodea", () => {
    const partes = partesConEnlaces("Abre https://fiddle.test/a?x=1 ya");
    expect(partes).toEqual([
      { texto: "Abre ", enlace: false },
      { texto: "https://fiddle.test/a?x=1", enlace: true },
      { texto: " ya", enlace: false },
    ]);
  });

  test("un texto sin enlaces sale entero", () => {
    expect(partesConEnlaces("Solo cifras")).toEqual([{ texto: "Solo cifras", enlace: false }]);
  });

  test("devuelve vacío si no hay texto", () => {
    expect(partesConEnlaces(null)).toEqual([]);
  });
});
