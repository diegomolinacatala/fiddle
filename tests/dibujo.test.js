import { describe, it, expect } from "vitest";
import { normalizarTextoMarca, svgTextoCuadrado, hayGlifo } from "@/lib/apple/glifos";
import { svgLogo, svgIcono, svgStripSellos, svgCasilla, MARCAS, FORMAS } from "@/lib/apple/dibujo";
import { temaPorDefecto, completarTema } from "@/lib/negocios";
import { piezasDeDibujo } from "@/lib/validacion";

const contar = (texto, trozo) => texto.split(trozo).length - 1;

describe("tipografía cuadrada", () => {
  it("se queda con lo que sabe dibujar", () => {
    expect(normalizarTextoMarca("68")).toBe("68");
    expect(normalizarTextoMarca("Café 68")).toBe("CAFE"); // sin tilde, sin espacio, máx. 4
    expect(normalizarTextoMarca("漢字")).toBe("");
    expect(hayGlifo("8")).toBe(true);
    expect(hayGlifo("漢")).toBe(false);
  });

  it("dibuja líneas, no <text> (en el servidor no hay fuentes)", () => {
    const svg = svgTextoCuadrado("68", { cx: 100, cy: 100, alto: 80, color: "#123456" });
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("<text");
    expect(svg).toContain("#123456");
    // Un 6 y un 8: el 8 lleva una polilínea más (la barra de en medio).
    expect(contar(svg, "<polyline")).toBe(3);
  });

  it("sin nada que dibujar no dibuja nada", () => {
    expect(svgTextoCuadrado("", { cx: 0, cy: 0, alto: 10, color: "#000" })).toBe("");
    expect(svgTextoCuadrado("漢", { cx: 0, cy: 0, alto: 10, color: "#000" })).toBe("");
  });
});

describe("piezas del dibujo", () => {
  const tema = (extra) => temaPorDefecto({ estilo: "coffee", ...extra });

  it("la forma de la casilla es independiente de la marca", () => {
    const meta = 8;
    const circulos = svgStripSellos(tema({ forma: "circulo" }), meta, 3);
    const cuadrados = svgStripSellos(tema({ forma: "cuadrado" }), meta, 3);
    expect(contar(circulos, "<circle")).toBeGreaterThanOrEqual(meta);
    expect(contar(cuadrados, "<rect")).toBeGreaterThanOrEqual(meta);
    expect(cuadrados).toContain('rx="0"'); // esquinas en ángulo de verdad
  });

  it("la casilla es la misma figura llena o vacía", () => {
    expect(svgCasilla("circulo", 10, 10, 8, "")).toContain("<circle");
    expect(svgCasilla("cuadrado", 10, 10, 8, "")).toContain('x="6" y="6" width="8" height="8" rx="0"');
    expect(svgCasilla("redondeado", 10, 10, 8, "")).not.toContain('rx="0"');
  });

  it("un texto de marca se puede usar de logo y de icono", () => {
    const t = tema({ marca: "texto", texto: "68" });
    expect(svgLogo(t)).toContain("<polyline");
    expect(svgIcono(t)).toContain("<polyline");
  });

  it("con marca de varias letras los sellos van lisos; con una, marcados", () => {
    const meta = 4;
    const dos = svgStripSellos(tema({ marca: "texto", texto: "68", forma: "cuadrado" }), meta, meta);
    const una = svgStripSellos(tema({ marca: "texto", texto: "6", forma: "cuadrado" }), meta, meta);
    expect(contar(dos, "<polyline")).toBe(0);
    expect(contar(una, "<polyline")).toBeGreaterThan(0);
  });
});

describe("temas de antes", () => {
  it("un tema viejo (solo `estilo`) se sigue pintando igual", () => {
    expect(completarTema({ estilo: "barber" })).toMatchObject({ marca: "barber", forma: "redondeado", banda: "oscura" });
    expect(completarTema({ estilo: "coffee" })).toMatchObject({ marca: "coffee", forma: "circulo", banda: "clara" });
    expect(completarTema({})).toMatchObject({ marca: "coffee", forma: "circulo", banda: "clara" });
  });

  it("los tres estilos de siempre traen sus piezas puestas", () => {
    for (const estilo of ["coffee", "barber", "pizza", "moderno"]) {
      const t = temaPorDefecto({ estilo });
      expect(MARCAS).toContain(t.marca);
      expect(FORMAS).toContain(t.forma);
    }
    expect(temaPorDefecto({ estilo: "moderno", texto: "68" })).toMatchObject({ marca: "texto", texto: "68", forma: "cuadrado" });
  });

  it("no se cuelan piezas inventadas", () => {
    expect(piezasDeDibujo({ marca: "dragon", forma: "triangulo", banda: "fucsia" })).toEqual({});
    expect(piezasDeDibujo({ marca: "texto", texto: " 68 " })).toEqual({ marca: "texto", texto: "68" });
    expect(temaPorDefecto({ estilo: "coffee", forma: "triangulo" }).forma).toBe("circulo");
  });
});
