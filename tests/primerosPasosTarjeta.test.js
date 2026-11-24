import { describe, it, expect } from "vitest";
import { PALETAS } from "@/app/home/tarjeta/opciones";
import {
  paletaDe, iconoDe, fondoDe, negocioConCambios, cuerpoDeGuardar, conCambio,
  metasPosibles, estadoParaEscena, sugerenciasDePremio,
} from "@/app/[negocio]/primeros-pasos/tarjeta";

const tienda = (extra = {}) => ({
  slug: "cafe", nombre: "Café", meta: 8, premio: "café gratis", pedirNombre: false,
  tema: { estilo: "coffee", cardBg: "#4c7d4f", ink: "#ffffff", accent: "#35603a", detalle: "#ffffff", marca: "taza", modo: "relleno", banda: "clara" },
  ...extra,
});

describe("lo que la tienda es hoy", () => {
  it("reconoce la paleta por el fondo y devuelve null con un color propio", () => {
    expect(paletaDe({ cardBg: "#4C7D4F" })).toBe("verde");
    expect(paletaDe({ cardBg: "#123456" })).toBeNull();
  });

  it("el icono fuera de la lista (un logo, un kit) es null", () => {
    expect(iconoDe({ marca: "grano" })).toBe("grano");
    expect(iconoDe({ marca: "propia:abc" })).toBeNull();
  });

  it("el fondo liso es la banda clara", () => {
    expect(fondoDe({ banda: "clara" })).toBe("liso");
    expect(fondoDe({ banda: "rayas" })).toBe("rayas");
    expect(fondoDe({ banda: "oscura" })).toBeNull();
  });

  it("si la meta no es de la lista, sale también y ordenada", () => {
    expect(metasPosibles({ meta: 7 })).toEqual([6, 7, 8, 10, 12]);
    expect(metasPosibles({ meta: 10 })).toEqual([6, 8, 10, 12]);
  });
});

describe("negocioConCambios", () => {
  it("sin cambios es la misma tienda", () => {
    const n = tienda();
    expect(negocioConCambios(n, {})).toEqual(n);
  });

  it("pone encima solo lo tocado y no muta la tienda", () => {
    const n = tienda();
    const copia = JSON.parse(JSON.stringify(n));
    const r = negocioConCambios(n, { paleta: "azul", icono: "grano", fondo: "liso", modo: "barra", meta: 10, premio: " bebida gratis ", pedirNombre: true, abierto: false });
    const azul = PALETAS.find((p) => p.id === "azul");
    expect(r.tema).toMatchObject({ cardBg: azul.cardBg, accent: azul.accent, marca: "grano", banda: "clara", modo: "barra", abierto: false });
    expect(r).toMatchObject({ meta: 10, premio: "bebida gratis", pedirNombre: true });
    expect(n).toEqual(copia);
    expect(r.tema).not.toBe(n.tema);
  });

  it("una paleta sin detalle quita el de antes", () => {
    const r = negocioConCambios(tienda(), { paleta: "crema" });
    expect(r.tema.detalle).toBeNull();
  });

  it("con dos cartillas o de cupón no toca meta ni premio", () => {
    const dos = tienda({ cartillas: [{}, {}] });
    expect(negocioConCambios(dos, { meta: 12, premio: "otro" })).toMatchObject({ meta: 8, premio: "café gratis" });
    const cupon = tienda({ tipo: "descuento" });
    expect(negocioConCambios(cupon, { meta: 12 }).meta).toBe(8);
  });

  it("un premio en blanco deja el de la tienda", () => {
    expect(negocioConCambios(tienda(), { premio: "   " }).premio).toBe("café gratis");
  });
});

describe("cuerpoDeGuardar", () => {
  it("sin nada tocado, o tocado igual que hoy, no hay nada que guardar", () => {
    expect(cuerpoDeGuardar(tienda(), {})).toBeNull();
    expect(cuerpoDeGuardar(tienda(), { paleta: "verde", icono: "taza", meta: 8, premio: "café gratis", pedirNombre: false, abierto: true })).toBeNull();
  });

  it("manda solo las piezas tocadas y nunca el estilo", () => {
    const c = cuerpoDeGuardar(tienda(), { icono: "grano", fondo: "rayas" });
    expect(c).toEqual({ tema: { marca: "grano", banda: "rayas" } });
    expect(c.tema).not.toHaveProperty("estilo");
  });

  it("la paleta lleva sus cuatro colores y detalle null si no lo trae", () => {
    expect(cuerpoDeGuardar(tienda(), { paleta: "crema" }).tema).toEqual({ cardBg: "#f6ece0", ink: "#3a2318", accent: "#b04a26", detalle: null });
  });

  it("liso se guarda como banda clara", () => {
    const n = tienda({ tema: { ...tienda().tema, banda: "rayas" } });
    expect(cuerpoDeGuardar(n, { fondo: "liso" })).toEqual({ tema: { banda: "clara" } });
  });

  it("lleva meta, premio recortado y pedirNombre", () => {
    const c = cuerpoDeGuardar(tienda(), { meta: 10, premio: `  ${"a".repeat(80)} `, pedirNombre: true });
    expect(c.meta).toBe(10);
    expect(c.premio).toHaveLength(64);
    expect(c.pedirNombre).toBe(true);
  });

  it("con dos cartillas o cupón no manda meta, premio ni modo", () => {
    const dos = tienda({ cartillas: [{}, {}] });
    expect(cuerpoDeGuardar(dos, { meta: 12, premio: "otro", modo: "barra" })).toBeNull();
  });

  it("no muta la tienda ni los cambios", () => {
    const n = tienda();
    const c = { paleta: "azul", premio: "x" };
    const antes = JSON.stringify([n, c]);
    cuerpoDeGuardar(n, c);
    expect(JSON.stringify([n, c])).toBe(antes);
  });
});

describe("el resto", () => {
  it("conCambio pone, quita y no muta", () => {
    const a = { paleta: "azul" };
    expect(conCambio(a, "icono", "grano")).toEqual({ paleta: "azul", icono: "grano" });
    expect(conCambio(a, "paleta", undefined)).toEqual({});
    expect(a).toEqual({ paleta: "azul" });
  });

  it("la línea de abierto: apagada nada; sin horario, solo el ejemplo; sin hora aún, nada", () => {
    const n = tienda();
    expect(estadoParaEscena(n, { encendido: false, ejemplo: true, ahora: 1 })).toBeNull();
    expect(estadoParaEscena(n, { encendido: true, ejemplo: false, ahora: 1 })).toBeNull();
    expect(estadoParaEscena(n, { encendido: true, ejemplo: true, ahora: 1 })).toEqual({ abierta: true, texto: "Abierto hasta las 20:00" });
    expect(estadoParaEscena(tienda({ horario: { zona: "Europe/Madrid" } }), { encendido: true, ejemplo: true, ahora: null })).toBeNull();
  });

  it("las sugerencias de premio no se repiten", () => {
    const s = sugerenciasDePremio();
    expect(new Set(s).size).toBe(s.length);
    expect(s).toContain("café gratis");
  });
});
