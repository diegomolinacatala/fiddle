import { describe, it, expect } from "vitest";
import { cartillasDe, cuentaCorta, describirBanda } from "@/lib/cartillas";
import { ACCIONES, accionPermitida, accionesDe, singular } from "@/lib/acciones";
import { normalizarCartillas, patchNegocioAdmin } from "@/lib/validacion";
import { componerNegocio } from "@/lib/negocios";
import { camposDelPase } from "@/lib/apple/pase";
import { stripDelPase, svgStripCartillas } from "@/lib/apple/dibujo";
import { avisoDeCambio } from "@/lib/avisos";
import { puntosDe } from "@/lib/resumen";
import { rutaBanda } from "@/lib/rutasImagen";

// La tarjeta de papel de La Delicantería: ocho cookies arriba, ocho cafés abajo.
const CARTILLAS = [
  { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
  { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
];
const deli = componerNegocio("delicanteria", {
  nombre: "La Delicantería",
  tipo: "sellos",
  config: { acciones: ["sellar", "canjear", "restar"], cartillas: CARTILLAS, tema: { estilo: "galletas" } },
});
const cliente = (sellos, sellos2, premios = 0) => ({ serial: "x", codigo: "K7M", sellos, sellos2, premios });

describe("dos cartillas en un pase", () => {
  it("la primera cartilla manda sobre la meta y el premio del negocio", () => {
    expect(deli.cartillas).toEqual(CARTILLAS);
    expect(deli).toMatchObject({ meta: 8, premio: "cookie gratis" });
    expect(deli.tema.marca).toBe("galleta");
  });

  it("una tienda de siempre no tiene cartillas y se lee como una sola", () => {
    const nube = componerNegocio("nube", null);
    expect(nube.cartillas).toBeNull();
    expect(cartillasDe({ sellos: 3 }, nube)).toMatchObject([{ clave: "sellos", sellos: 3, meta: 8, faltan: 5 }]);
    expect(describirBanda({ sellos: 3 }, nube)).toBe("3 de 8 sellos");
  });

  it("cada cartilla cuenta en su columna", () => {
    const [cookies, cafes] = cartillasDe(cliente(8, 3), deli);
    expect(cookies).toMatchObject({ clave: "sellos", sellos: 8, completa: true, faltan: 0 });
    expect(cafes).toMatchObject({ clave: "sellos2", sellos: 3, completa: false, faltan: 5 });
    expect(cuentaCorta(cliente(8, 3), deli)).toBe("8/8 · 3/8");
    expect(describirBanda(cliente(8, 3), deli)).toBe("Cookies 8 de 8, Cafés 3 de 8");
  });

  it("sellar2 y canjear2 tocan solo la segunda cartilla", () => {
    expect(ACCIONES.sellar2.aplicar(cliente(2, 7), deli)).toMatchObject({ cliente: { sellos: 2, sellos2: 8 }, mensaje: "Sello añadido · Cafés 8/8" });
    expect(ACCIONES.sellar2.aplicar(cliente(2, 8), deli).ok).toBe(false);
    expect(ACCIONES.canjear2.aplicar(cliente(2, 7), deli).ok).toBe(false);
    expect(ACCIONES.canjear2.aplicar(cliente(2, 8, 1), deli)).toMatchObject({ cliente: { sellos: 2, sellos2: 0, premios: 2 }, mensaje: "Premio entregado: café gratis" });
    expect(ACCIONES.restar2.aplicar(cliente(2, 0), deli).cliente.sellos2).toBe(0);
    expect(ACCIONES.sellar.aplicar(cliente(2, 5), deli).cliente).toMatchObject({ sellos: 3, sellos2: 5 });
  });

  it("las de la segunda cartilla siguen a su pareja y solo existen con dos", () => {
    expect(accionPermitida(deli, "sellar2")).toBe(true);
    expect(accionPermitida({ ...deli, acciones: ["canjear"] }, "sellar2")).toBe(false);
    expect(accionPermitida({ ...deli, cartillas: null }, "sellar2")).toBe(false);
    expect(accionPermitida(deli, "confirmar")).toBe(false);
    expect(accionPermitida(deli, "borrar")).toBe(false);
  });

  it("la caja ve un botón por cartilla, con su nombre", () => {
    expect(accionesDe(deli).map((a) => [a.key, a.label])).toEqual([
      ["sellar", "Añadir cookie"], ["sellar2", "Añadir café"],
      ["restar", "Quitar cookie"], ["restar2", "Quitar café"],
    ]);
    // El premio no es un botón: tiene su recuadro (premiosDe), solo cuando hay algo que dar.
    const nube = componerNegocio("nube", null);
    expect(accionesDe(nube).map((a) => a.label)).toEqual(["Añadir sello", "Quitar sello"]);
    expect([singular("Cookies"), singular("Cafés"), singular("Panes"), singular("Té")]).toEqual(["cookie", "café", "pan", "té"]);
  });

  it("el pase lleva un campo por cartilla, y el aviso dice de cuál es", () => {
    const { secondaryFields, backFields } = camposDelPase(cliente(8, 3), deli);
    expect(secondaryFields).toEqual([
      { key: "premio", label: "COOKIES", value: "¡cookie gratis!", changeMessage: "Cookies: %@" },
      { key: "premio2", label: "CAFÉS", value: "Faltan 5", changeMessage: "Cafés: %@" },
    ]);
    expect(backFields.find((f) => f.key === "premios").value).toBe("8 cookies: cookie gratis\n8 cafés: café gratis");
  });

  it("los avisos de Android nombran la cartilla que cambió", () => {
    expect(avisoDeCambio(cliente(2, 3), cliente(2, 4), deli)).toMatchObject({ tipo: "sello", cuerpo: "Cafés: 4 de 8. Te faltan 4 para café gratis." });
    expect(avisoDeCambio(cliente(7, 3), cliente(8, 3), deli)).toMatchObject({ tipo: "completa", cuerpo: "Cartilla de cookies completa. Tu cookie gratis te espera en caja." });
    expect(avisoDeCambio(cliente(2, 8, 0), cliente(2, 0, 1), deli)).toMatchObject({ tipo: "canje", cuerpo: expect.stringContaining("café gratis") });
    expect(avisoDeCambio(cliente(2, 4), cliente(2, 3), deli)).toBeNull(); // una corrección no suena
  });

  it("Google cuenta las dos", () => {
    expect(puntosDe(cliente(3, 5), deli)).toEqual({ label: "Cookies · Cafés", balance: "3/8 · 5/8" });
  });

  it("la banda tiene dos filas con su dibujo, y su URL lleva las dos cuentas", () => {
    const { svg } = stripDelPase(deli, cliente(3, 5));
    expect(svg).toBe(svgStripCartillas(deli.tema, cartillasDe(cliente(3, 5), deli)));
    expect(svg).not.toContain("<text");
    // 16 casillas: ocho por fila.
    expect(svg.match(/<circle /g)).toHaveLength(16);
    expect(rutaBanda(deli, cliente(3, 5))).toMatch(/[?&]s=3&s2=5&/);
    expect(rutaBanda(componerNegocio("nube", null), { sellos: 3 })).not.toContain("s2=");
  });

  it("valida las cartillas: dos, completas y con meta razonable", () => {
    expect(normalizarCartillas(CARTILLAS)).toEqual(CARTILLAS);
    expect(normalizarCartillas([CARTILLAS[0]])).toBeNull();
    expect(normalizarCartillas([CARTILLAS[0], { ...CARTILLAS[1], marca: "dragon" }])).toBeNull();
    expect(normalizarCartillas([CARTILLAS[0], { ...CARTILLAS[1], meta: 40 }])).toBeNull();
    expect(normalizarCartillas([CARTILLAS[0], { ...CARTILLAS[1], nombre: "  " }])).toBeNull();
    expect(normalizarCartillas([{ ...CARTILLAS[0], marca: "coffee" }, CARTILLAS[1]])[0].marca).toBe("taza");
  });

  it("el admin las activa y las quita; la meta sigue a la primera", () => {
    expect(patchNegocioAdmin({ cartillas: CARTILLAS, meta: 10 }, []).patch).toMatchObject({ cartillas: CARTILLAS, meta: 8, premio: "cookie gratis" });
    expect(patchNegocioAdmin({ cartillas: null }, []).patch).toEqual({ cartillas: null });
    expect(patchNegocioAdmin({ cartillas: [CARTILLAS[0]] }, []).error).toMatch(/Cartillas no válidas/);
    expect(patchNegocioAdmin({}, []).patch).not.toHaveProperty("cartillas");
  });

  it("un cupón nunca tiene cartillas", () => {
    const cupon = componerNegocio("x", { tipo: "descuento", config: { cartillas: CARTILLAS } });
    expect(cupon.cartillas).toBeNull();
  });
});
