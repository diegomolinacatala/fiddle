import { describe, it, expect } from "vitest";
import { csvClientes, celda } from "@/lib/exportar";
import { componerNegocio } from "@/lib/negocios";

const nube = componerNegocio("nube", null);
const deli = componerNegocio("delicanteria", {
  nombre: "La Delicantería",
  tipo: "sellos",
  config: {
    acciones: ["sellar", "canjear"],
    cartillas: [
      { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
      { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
    ],
  },
});
const perfil = { estado: "activo", visitas: 3, diasSinVenir: 2.4, cadencia: 7, contactable: true };
const cliente = { codigo: "K7M", nombre: "Ana", sellos: 1, sellos2: 4, premios: 2, guardados: 1, guardados2: 0, creado: "2026-09-01T10:00:00Z", origen: "tap" };

describe("exportar a CSV", () => {
  it("punto y coma, BOM y cabeceras legibles: Excel en español lo abre en columnas", () => {
    const csv = csvClientes([{ cliente, perfil }], nube);
    expect(csv.startsWith("﻿")).toBe(true);
    const [cabecera, fila] = csv.slice(1).split("\r\n");
    expect(cabecera.split(";").slice(0, 5)).toEqual(["Código", "Nombre", "Estado", "Visitas", "Sellos (de 8)"]);
    expect(fila.split(";").slice(0, 5)).toEqual(["K7M", "Ana", "Activo", "3", "1"]);
    expect(cabecera).not.toContain(",");
  });

  it("con dos cartillas, una columna por cartilla", () => {
    const [cabecera, fila] = csvClientes([{ cliente, perfil }], deli).slice(1).split("\r\n");
    const cols = cabecera.split(";");
    expect(cols).toContain("Sellos cookies (de 8)");
    expect(cols).toContain("Sellos cafés (de 8)");
    expect(fila.split(";")[cols.indexOf("Sellos cafés (de 8)")]).toBe("4");
    expect(fila.split(";")[cols.indexOf("Premios guardados")]).toBe("1");
  });

  it("celdas seguras: comillas si hace falta y nada de fórmulas", () => {
    expect(celda("hola")).toBe("hola");
    expect(celda("a;b")).toBe('"a;b"');
    expect(celda('dice "hola"')).toBe('"dice ""hola"""');
    expect(celda("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
  });
});
