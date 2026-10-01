import { describe, it, expect } from "vitest";
import { stripDelPase, svgStripCartillas, piezasDeTema } from "@/lib/apple/dibujo";
import { camposDelPase } from "@/lib/apple/pase";
import { construirClase } from "@/lib/google/pase";
import { normalizarContacto, enlacesDeContacto } from "@/lib/contacto";
import { patchNegocio } from "@/lib/validacion";
import { temaPorDefecto } from "@/lib/negocios";
import { cartillasDe } from "@/lib/cartillas";

const cartillas = [
  { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
  { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
];
const tienda = (tema = {}, extra = {}) => ({
  slug: "deli", nombre: "Deli", tipo: "sellos", meta: 8, premio: "cookie gratis", cartillas,
  tema: { ...temaPorDefecto({ estilo: "galletas" }), ...tema }, ...extra,
});
const cliente = { serial: "s".repeat(36), codigo: "K7M", sellos: 5, sellos2: 3, premios: 0 };

describe("dos cartillas que se llenan", () => {
  it("de partida siguen siendo filas: las tiendas de antes no cambian", () => {
    expect(piezasDeTema({}).doble).toBe("filas");
    const n = tienda();
    expect(stripDelPase(n, cliente).svg).toBe(svgStripCartillas(n.tema, cartillasDe(cliente, n)));
  });

  it("con doble=llenar, una a cada lado y con su cuenta", () => {
    const { svg } = stripDelPase(tienda({ doble: "llenar" }), cliente);
    expect(svg).toContain("llenar-");
    expect(svg).not.toContain("<text");
    // Dos recortes (uno por dibujo) y ninguna casilla de rejilla.
    expect(svg.match(/<clipPath/g)).toHaveLength(2);
  });

  it("dos tiendas distintas no comparten ids de recorte en la misma página", () => {
    const a = stripDelPase(tienda({ doble: "llenar" }), cliente).svg;
    const b = stripDelPase(tienda({ doble: "llenar" }), { ...cliente, sellos: 6 }).svg;
    expect(a.match(/clipPath id="([^"]+)"/)[1]).not.toBe(b.match(/clipPath id="([^"]+)"/)[1]);
  });
});

describe("contacto del reverso", () => {
  it("limpia lo que se escribe y rechaza lo raro", () => {
    expect(normalizarContacto({ telefono: " +34 960 11 22 33 ", web: "latienda.es/", instagram: "https://instagram.com/la.tienda/" }))
      .toEqual({ contacto: { telefono: "+34 960 11 22 33", web: "https://latienda.es", instagram: "la.tienda" } });
    expect(normalizarContacto({ telefono: "", web: "", instagram: "" })).toEqual({ contacto: null });
    expect(normalizarContacto({ telefono: "llámame" }).error).toMatch(/Teléfono/);
    expect(normalizarContacto({ web: "javascript:alert(1)" }).error).toMatch(/Web/);
    expect(normalizarContacto({ web: "https://user:pw@x.es" }).error).toMatch(/Web/);
    expect(normalizarContacto({ instagram: "<script>" }).error).toMatch(/Instagram/);
  });

  it("sale detrás en Apple, tocable, y como botones en Google", () => {
    const contacto = { telefono: "+34 960 11 22 33", web: "https://latienda.es", instagram: "latienda" };
    const n = tienda({}, { contacto });
    const atras = camposDelPase(cliente, n).backFields;
    expect(atras.find((f) => f.key === "telefono")).toMatchObject({ value: "+34 960 11 22 33", attributedValue: '<a href="tel:+34960112233">+34 960 11 22 33</a>' });
    expect(atras.find((f) => f.key === "instagram").value).toBe("@latienda");
    const clase = construirClase(n, { issuerId: "1", appUrl: "https://x" });
    expect(clase.linksModuleData.uris.map((u) => u.uri)).toEqual(enlacesDeContacto(contacto).map((e) => e.uri));
  });

  it("sin contacto, ni campos ni enlaces de más", () => {
    const n = tienda();
    expect(camposDelPase(cliente, n).backFields.map((f) => f.key)).not.toContain("telefono");
    expect(construirClase(n, { issuerId: "1", appUrl: "https://x" })).not.toHaveProperty("linksModuleData");
  });

  it("el manager lo guarda y lo quita; un error no guarda nada", () => {
    expect(patchNegocio({ contacto: { web: "latienda.es" } }, []).patch.contacto).toEqual({ web: "https://latienda.es" });
    expect(patchNegocio({ contacto: null }, []).patch).toEqual({ contacto: null });
    expect(patchNegocio({ contacto: { telefono: "x" } }, []).error).toMatch(/Teléfono/);
    expect(patchNegocio({ tema: { doble: "llenar" } }, []).patch.tema).toEqual({ doble: "llenar" });
    expect(patchNegocio({ tema: { doble: "raro" } }, []).patch).toEqual({});
  });
});

describe("cada cartilla con su modo", () => {
  it("lado a lado, cada una pinta su modo en su mitad y sin ids repetidos", () => {
    const n = tienda({ doble: "lados" }, {
      cartillas: [{ ...cartillas[0], modo: "anillos" }, { ...cartillas[1], modo: "barra" }],
    });
    const { svg } = stripDelPase(n, cliente);
    expect(svg).toContain("doble-lados");
    expect(svg.match(/<svg x=/g)).toHaveLength(2);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    // Todo lo que se pide por url(#…) existe.
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(ref);
  });

  it("el viejo «llenar» sigue siendo las dos llenándose, una a cada lado", () => {
    const { svg } = stripDelPase(tienda({ doble: "llenar" }), cliente);
    expect(svg).toContain("llenar-");
  });
});

describe("Google: fondo y «Abierto»", () => {
  const opciones = { issuerId: "1", appUrl: "https://x" };
  it("el fondo es el color de la tienda, el de la tarjeta u otro", () => {
    const n = tienda();
    expect(construirClase(n, opciones).hexBackgroundColor).toBe(n.tema.accent);
    expect(construirClase(tienda({ google: "tarjeta" }), opciones).hexBackgroundColor).toBe(n.tema.cardBg);
    expect(construirClase(tienda({ google: "#123456" }), opciones).hexBackgroundColor).toBe("#123456");
  });

  it("«Ahora · Abierto hasta…» va el primero de los detalles, salvo que la tienda lo apague", () => {
    const n = tienda({}, { estadoPase: "Abierto hasta las 18:30" });
    expect(construirClase(n, opciones).textModulesData[0]).toEqual({ id: "estado", header: "Ahora", body: "Abierto hasta las 18:30" });
    const apagado = tienda({ abierto: false }, { estadoPase: "Abierto hasta las 18:30" });
    expect(construirClase(apagado, opciones).textModulesData.map((t) => t.id)).not.toContain("estado");
  });
});
