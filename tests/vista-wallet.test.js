import { describe, it, expect } from "vitest";
import { colocarFila, repartir, partir, recortar } from "@/lib/vistaWallet";

// Una letra = medio tamaño de ancho: basta para comprobar la lógica.
const medir = (t, tam) => String(t).length * tam * 0.5;
const fila = (valores, total, o = {}) => colocarFila(
  valores.map((value) => ({ label: "X", value })),
  { total, hueco: 12, max: 20, min: 8, medir, etiquetas: valores.map(() => 20), ...o },
);

describe("cómo coloca iOS la fila bajo la banda", () => {
  it("si cabe, entera y a su tamaño", () => {
    const [premio] = fila(["Faltan 3"], 276);
    expect(premio).toMatchObject({ tam: 20, lineas: ["Faltan 3"], cortado: false });
  });

  it("si no, encoge la fila ENTERA, todos al mismo tamaño", () => {
    const r = fila(["Faltan 3", "2x1 en cafés esta tarde"], 276);
    expect(r.every((c) => c.lineas.length === 1)).toBe(true);
    expect(r[0].tam).toBeLessThan(20);
    expect(r[0].tam).toBe(r[1].tam);
  });

  it("encoge mucho antes de pasar a dos líneas", () => {
    // 40 letras al lado del premio: a 20 no caben, pero de una línea todavía sí.
    const r = fila(["Faltan 3", "Esta tarde está tranquilo: ven a por café"], 276);
    expect(r[1].lineas).toHaveLength(1);
    expect(r[1].tam).toBeLessThan(12);
  });

  it("al mínimo, el largo pasa a dos líneas y caben unas 100 letras", () => {
    const cien = "Esta tarde está tranquilo: ven a por tu café con calma y llévate una cookie de regalo con él hoy";
    const r = fila(["Faltan 3", cien], 276);
    expect(r[1]).toMatchObject({ tam: 8, cortado: false });
    expect(r[1].lineas).toHaveLength(2);
    expect(r[0].lineas).toEqual(["Faltan 3"]); // el corto, entero
    for (const c of r) for (const l of c.lineas) expect(medir(l, c.tam)).toBeLessThanOrEqual(c.ancho);
  });

  it("y si ni así, la segunda acaba en …", () => {
    const r = fila(["Faltan 3", "palabra ".repeat(40).trim()], 276);
    expect(r[1].cortado).toBe(true);
    expect(r[1].lineas[1].endsWith("…")).toBe(true);
  });
});

describe("el reparto del ancho", () => {
  it("si caben, cada uno lo suyo", () => {
    expect(repartir([60, 50, 30], 276, 12)).toEqual([60, 50, 30]);
  });
  it("si no, el corto se queda lo suyo y los largos se reparten el resto", () => {
    const r = repartir([60, 200, 30], 200, 10);
    expect(r[2]).toBe(30);
    expect(r[0] + r[1] + r[2] + 20).toBeCloseTo(200);
  });
});

it("partir y recortar no rompen con palabras enormes", () => {
  expect(partir("supercalifragilistico", 40, 10, medir).every((l) => medir(l, 10) <= 40)).toBe(true);
  expect(recortar("hola que tal", 30, 10, medir)).toMatch(/…$/);
});
