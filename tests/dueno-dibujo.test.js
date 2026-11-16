import { describe, it, expect } from "vitest";
import { svgStripDueno, svgIconoDueno, svgLogoDueno, COLORES_DUENO } from "../src/lib/dueno/dibujo";

const informe = (n = [21, 24, 26, 22, 31, 8, 0], cerrado = 6, mejor = { d: 4, n: 31 }) => ({
  desde: "2026-11-09", hasta: "2026-11-15", etiqueta: "9 al 15 nov",
  visitas: n.reduce((a, b) => a + b, 0), visitasAntes: 130, nuevos: 9, premios: 6,
  porDia: n.map((v, d) => ({ fecha: `2026-11-${9 + d}`, d, n: v, cerrado: d === cerrado })),
  mejorDia: mejor,
});

// Las barras empiezan en la línea base (y=94).
const BARRAS = /<path d="M[\d.]+ 94L/g;

describe("banda de la tarjeta del dueño", () => {
  it("mide 375x123 y no lleva <text>", () => {
    const { svg, ancho, alto } = svgStripDueno(informe());
    expect([ancho, alto]).toEqual([375, 123]);
    expect(svg).not.toContain("<text");
  });

  it("solo la barra del mejor día va a opacidad 1", () => {
    const { svg } = svgStripDueno(informe());
    expect(svg.match(/<path d="M[^"]*" fill="[^"]+" fill-opacity="1"\/>/g)).toHaveLength(1);
    expect(svg).toContain(`fill="${COLORES_DUENO.barraMejor}" fill-opacity="1"`);
    expect(svg.match(/<path d="M[^"]*" fill="[^"]+" fill-opacity="0\.45"\/>/g)).toHaveLength(5);
  });

  it("un día cerrado lleva un punto y no una barra", () => {
    const { svg } = svgStripDueno(informe());
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(svg.match(BARRAS)).toHaveLength(6);
  });

  it("con todo a cero no sale NaN ni Infinity y las siete barras son visibles", () => {
    const { svg } = svgStripDueno(informe([0, 0, 0, 0, 0, 0, 0], -1, null));
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    expect(svg.match(BARRAS)).toHaveLength(7);
  });

  it("con cuatro cifras el número se encoge para no pasar de x=150", () => {
    const grande = { ...informe(), visitas: 12345 };
    // El segundo texto de la banda (tras la etiqueta VISITAS) es el número.
    const escalaDelNumero = (s) => Number([...s.matchAll(/scale\(([\d.]+)\)/g)][1][1]);
    expect(escalaDelNumero(svgStripDueno(grande).svg)).toBeLessThan(escalaDelNumero(svgStripDueno(informe()).svg));
  });
});

describe("icono y logo", () => {
  it("el icono es un SVG cuadrado", () => {
    expect(svgIconoDueno()).toContain('viewBox="0 0 1024 1024"');
  });

  it("el logo es de 150x150 y tiene su propia máscara", () => {
    const logo = svgLogoDueno();
    expect(logo).toContain('viewBox="0 0 150 150"');
    expect(logo).toContain('id="lacre-logo-dueno"');
    expect(svgIconoDueno()).not.toContain("lacre-logo-dueno");
  });
});

describe("lo que el iPhone enseña de la banda", () => {
  // Wallet pinta la banda a 139 de alto (escala 139/123) en 360 de ancho: se ven ~318,6
  // puntos del lienzo, y el margen de 16 puntos son ~14,2 del lienzo: de x=42,4 a x=332,6.
  const X0 = (375 - 360 / (139 / 123)) / 2 + 16 / (139 / 123);
  // Solo las barras (las letras son contornos en su propio sistema de coordenadas).
  const xs = (svg) => [...svg.matchAll(/<path d="(M[\d.]+ 94L[^"]*)"/g)]
    .flatMap((m) => [...m[1].matchAll(/[MLQ]\s?(-?[\d.]+) [\d.]+/g)].map((x) => Number(x[1])));

  it("las barras caen dentro de lo que se ve, entre x=42 y x=333", () => {
    const todas = xs(svgStripDueno(informe()).svg);
    expect(X0).toBeGreaterThan(42);
    expect(X0).toBeLessThan(43);
    expect(Math.min(...todas)).toBeGreaterThanOrEqual(X0 - 0.5);
    expect(Math.max(...todas)).toBeLessThanOrEqual(375 - X0 + 0.5);
  });

  it("un día cerrado que sí tuvo visitas lleva su barra; con cero, el punto", () => {
    const sin = svgStripDueno(informe([5, 5, 5, 5, 5, 8, 0], 6));
    expect(sin.svg.match(BARRAS)).toHaveLength(6);
    expect(sin.svg).toContain("<circle");
    const con = svgStripDueno(informe([5, 5, 5, 5, 5, 8, 3], 6));
    expect(con.svg.match(BARRAS)).toHaveLength(7);
    expect(con.svg).not.toContain("<circle");
  });
});
