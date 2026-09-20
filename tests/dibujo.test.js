import { describe, it, expect } from "vitest";
import { normalizarTextoMarca, svgTextoCuadrado, hayGlifo } from "@/lib/apple/glifos";
import { svgLogo, svgIcono, svgStripSellos, svgCasilla, MARCAS, FORMAS, BANDAS, MODOS } from "@/lib/apple/dibujo";
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

describe("modo relleno (la taza que se llena)", () => {
  const tema = (extra) => temaPorDefecto({ estilo: "coffee", modo: "relleno", ...extra });

  it("vacío no recorta nada; a medias y lleno sí", () => {
    expect(svgStripSellos(tema(), 8, 0)).not.toContain("clip-path");
    expect(svgStripSellos(tema(), 8, 4)).toContain("clip-path");
    expect(svgStripSellos(tema(), 8, 8)).toContain("clip-path");
  });

  it("la marca se dibuja dos veces: fantasma y recortada", () => {
    const svg = svgStripSellos(tema(), 8, 4);
    expect(contar(svg, "<clipPath")).toBe(1);
    expect(contar(svg, "opacity=\"0.16\"")).toBe(1); // el fantasma de debajo
  });

  it("el nivel sube con cada sello y llega al tope", () => {
    const altoDe = (sellos) => Number(/<clipPath[^>]*><rect[^>]*height="([\d.]+)"/.exec(svgStripSellos(tema(), 8, sellos))?.[1] || 0);
    const alturas = [0, 1, 4, 7, 8].map(altoDe);
    expect(alturas).toEqual([...alturas].sort((a, b) => a - b)); // siempre hacia arriba
    expect(alturas[0]).toBe(0);
    expect(alturas.at(-1)).toBeGreaterThan(alturas[3]);
  });

  it("no hace falta ninguna imagen a medida: vale con cualquier marca", () => {
    for (const marca of MARCAS) {
      const svg = svgStripSellos(tema({ marca, texto: "68" }), 6, 3);
      expect(svg).toContain("clip-path");
      expect(svg.length).toBeGreaterThan(200);
    }
  });

  it("y con cualquier banda y cualquier cartilla", () => {
    for (const banda of BANDAS) expect(svgStripSellos(tema({ banda }), 1, 1)).toContain("<svg");
    expect(svgStripSellos(tema(), 0, 0)).toContain("<svg"); // sin meta no se divide por cero
  });
});

describe("temas de antes", () => {
  it("un tema viejo (solo `estilo`) se sigue pintando igual", () => {
    // Las marcas se renombraron (coffee -> taza, barber -> tijeras); lo guardado sigue valiendo.
    expect(completarTema({ estilo: "barber" })).toMatchObject({ marca: "tijeras", forma: "redondeado", banda: "oscura", modo: "casillas" });
    expect(completarTema({ estilo: "coffee" })).toMatchObject({ marca: "taza", forma: "circulo", banda: "clara" });
    expect(completarTema({ marca: "coffee" })).toMatchObject({ marca: "taza" });
    expect(completarTema({})).toMatchObject({ marca: "taza", forma: "circulo", banda: "clara" });
  });

  it("y se DIBUJA igual: un tema de antes y su versión completa son el mismo SVG", () => {
    for (const estilo of ["coffee", "barber"]) {
      const antiguo = { estilo, accent: estilo === "barber" ? "#c9a24b" : "#ff5c8a" };
      expect(svgStripSellos(completarTema(antiguo), 8, 5)).toBe(svgStripSellos(antiguo, 8, 5));
    }
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
    expect(piezasDeDibujo({ marca: "dragon", forma: "triangulo", banda: "fucsia", modo: "3d" })).toEqual({});
    expect(piezasDeDibujo({ modo: "relleno" })).toEqual({ modo: "relleno" });
    expect(MODOS).toEqual(["casillas", "relleno", "porciones", "pizza", "barra", "pesas", "anillos"]);
    expect(piezasDeDibujo({ marca: "texto", texto: " 68 " })).toEqual({ marca: "texto", texto: "68" });
    expect(temaPorDefecto({ estilo: "coffee", forma: "triangulo" }).forma).toBe("circulo");
  });
});

describe("modos nuevos (porciones, pizza, barra, pesas, anillos)", () => {
  const NUEVOS = ["porciones", "pizza", "barra", "pesas", "anillos"];
  const tema = (modo, extra) => temaPorDefecto({ estilo: "coffee", modo, ...extra });

  it("todos dibujan algo con cualquier meta, cualquier banda y cualquier marca", () => {
    for (const modo of NUEVOS) {
      for (const meta of [1, 2, 5, 8, 20, 50]) {
        for (const sellos of [0, 1, Math.floor(meta / 2), meta]) {
          const svg = svgStripSellos(tema(modo), meta, sellos);
          expect(svg).toContain("<svg");
          expect(svg).not.toContain("NaN");
          expect(svg).not.toContain("undefined");
        }
      }
      for (const banda of BANDAS) expect(svgStripSellos(tema(modo, { banda }), 6, 3)).toContain("<svg");
      for (const marca of MARCAS) expect(svgStripSellos(tema(modo, { marca, texto: "68" }), 6, 3)).toContain("<svg");
    }
  });

  it("sin meta no se divide por cero", () => {
    for (const modo of NUEVOS) expect(svgStripSellos(tema(modo), 0, 0)).not.toContain("NaN");
  });

  it("las porciones ganadas crecen con los sellos", () => {
    const llenas = (n) => contar(svgStripSellos(tema("porciones"), 8, n), 'fill-opacity="0.12"'); // las que FALTAN
    expect(llenas(0)).toBe(8);
    expect(llenas(3)).toBe(5);
    expect(llenas(8)).toBe(0);
  });

  it("el aro cerrado es un círculo, no un arco de 360° (que no se ve)", () => {
    const medio = svgStripSellos(tema("anillos"), 8, 4);
    const lleno = svgStripSellos(tema("anillos"), 8, 8);
    expect(medio).toContain("<path d=\"M");
    expect(contar(lleno, "<circle")).toBeGreaterThan(contar(medio, "<circle"));
  });

  it("los discos de la barra se reparten a los dos lados", () => {
    // Con 6 discos puestos, tres quedan a la derecha del centro y tres a la izquierda.
    const svg = svgStripSellos(tema("pesas"), 6, 6);
    const centro = (375 * 3) / 2;
    const xs = [...svg.matchAll(/<rect x="([\d.-]+)"[^>]*fill="#[0-9a-f]{6}"\/>/g)].map((m) => Number(m[1]));
    expect(xs.filter((x) => x > centro).length).toBe(3);
    expect(xs.filter((x) => x < centro).length).toBe(3);
  });

  it("la cifra se encoge para no salirse: 20/20 no ocupa más que 3/8", () => {
    const anchoCifra = (svg) => {
      // La cifra es el único grupo con trazo y sin relleno; la marca va rellena.
      const m = /scale\(([\d.]+)\)" fill="none" stroke=/.exec(svg);
      return Number(m?.[1] || 0);
    };
    // Misma banda, cartilla corta vs larga: la larga usa una escala menor.
    expect(anchoCifra(svgStripSellos(tema("barra"), 20, 20))).toBeLessThan(anchoCifra(svgStripSellos(tema("barra"), 8, 3)));
  });
});
