import { describe, it, expect } from "vitest";
import { recibirDe, validarRecibir, resumenRecibir, RECIBIR_DE_PARTIDA, TOPE_SEMANA } from "@/lib/dueno/recibir";

describe("recibirDe", () => {
  it("sin nada guardado, lo de siempre: todo encendido y dos a la semana", () => {
    expect(recibirDe(null)).toEqual({ resumen: true, ideas: true, porSemana: 2 });
    expect(recibirDe({})).toEqual(RECIBIR_DE_PARTIDA);
    expect(TOPE_SEMANA).toBe(2);
  });

  it("respeta lo guardado y rellena lo que falta", () => {
    expect(recibirDe({ recibir: { ideas: false } })).toEqual({ resumen: true, ideas: false, porSemana: 2 });
    expect(recibirDe({ recibir: { resumen: false, porSemana: 1 } })).toEqual({ resumen: false, ideas: true, porSemana: 1 });
  });

  it("un valor raro vale lo de partida", () => {
    expect(recibirDe({ recibir: { resumen: "no", ideas: 0, porSemana: 9 } })).toEqual(RECIBIR_DE_PARTIDA);
    expect(recibirDe({ recibir: "todo" })).toEqual(RECIBIR_DE_PARTIDA);
  });
});

describe("validarRecibir", () => {
  it("acepta una sola clave o las tres", () => {
    expect(validarRecibir({ ideas: false })).toEqual({ ok: true, cambios: { ideas: false } });
    expect(validarRecibir({ resumen: true, ideas: true, porSemana: 1 })).toMatchObject({ ok: true });
  });

  it("rechaza claves de la tarjeta que no son suyas", () => {
    expect(validarRecibir({ token: "x" }).ok).toBe(false);
    expect(validarRecibir({ ideas: true, dispositivos: [] }).ok).toBe(false);
  });

  it("rechaza tipos y topes que no valen", () => {
    expect(validarRecibir({ resumen: "si" }).ok).toBe(false);
    expect(validarRecibir({ porSemana: 0 }).ok).toBe(false);
    expect(validarRecibir({ porSemana: 3 }).ok).toBe(false);
    expect(validarRecibir({ porSemana: 1.5 }).ok).toBe(false);
  });

  it("rechaza un cuerpo vacío o que no es un objeto", () => {
    for (const malo of [null, undefined, {}, [], "ideas"]) expect(validarRecibir(malo).ok).toBe(false);
  });
});

describe("resumenRecibir", () => {
  it("dice qué le avisa en una línea", () => {
    expect(resumenRecibir(RECIBIR_DE_PARTIDA)).toBe("Te avisa con el resumen del lunes y con ideas para tus clientes (2 a la semana como mucho).");
    expect(resumenRecibir({ resumen: true, ideas: false })).toBe("Te avisa solo con el resumen del lunes.");
    expect(resumenRecibir({ resumen: false, ideas: true, porSemana: 1 })).toBe("Te avisa solo con ideas para tus clientes (una a la semana como mucho).");
    expect(resumenRecibir({ resumen: false, ideas: false })).toBe("No te avisa: la tarjeta se pone al día en silencio.");
  });
});
