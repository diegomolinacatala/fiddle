import { describe, it, expect } from "vitest";
import { encajar, repartir, partir, recortar } from "@/lib/vistaWallet";

// Una letra = medio tamaño de ancho: basta para comprobar la lógica.
const medir = (t, tam) => String(t).length * tam * 0.5;

describe("cómo coloca iOS un valor", () => {
  it("si cabe, entero y a su tamaño", () => {
    expect(encajar("Faltan 3", 100, medir, { max: 20 })).toEqual({ tam: 20, lineas: ["Faltan 3"], cortado: false });
  });
  it("si no, primero encoge", () => {
    const r = encajar("Faltan 3", 70, medir, { max: 20 });
    expect(r.lineas).toHaveLength(1);
    expect(r.tam).toBeLessThan(20);
  });
  it("luego pasa a dos líneas", () => {
    const r = encajar("2x1 en cafés esta tarde", 90, medir, { max: 20, min: 11 });
    expect(r.lineas).toHaveLength(2);
    expect(r.cortado).toBe(false);
  });
  it("y al final corta con …", () => {
    const largo = "Esta semana el segundo café te lo invitamos si vienes antes de las diez de la mañana";
    const r = encajar(largo, 90, medir, { max: 20, min: 11 });
    expect(r.lineas).toHaveLength(2);
    expect(r.cortado).toBe(true);
    expect(r.lineas[1].endsWith("…")).toBe(true);
    for (const l of r.lineas) expect(medir(l, r.tam)).toBeLessThanOrEqual(90);
  });
});

describe("la fila de campos", () => {
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
