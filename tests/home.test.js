import { describe, it, expect } from "vitest";
import { PLANES, WHATSAPP, CORREO, enlaceWhatsApp, enlaceCorreo, mensajeDePlan } from "@/app/home/datos";
import { ejemplo, avisoDe, ejemploDe, CAFETERIA, CARRUSEL, MUESTRARIO } from "@/app/home/demo";
import { PALETA } from "@/app/home/paleta";
import { svgViolin, svgIconoViolin } from "@/lib/violin";
import { ESTILOS_GENERALES } from "@/lib/negocios";
import { stripDelPase } from "@/lib/apple/dibujo";

describe("web de fiddle: contacto y precios", () => {
  it("WhatsApp abre el chat con el mensaje escrito, sin «+» ni espacios en el número", () => {
    expect(WHATSAPP).toMatch(/^\d{11}$/);
    const url = new URL(enlaceWhatsApp("Hola, ¿qué tal? 39 € & más"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe(`/${WHATSAPP}`);
    expect(url.searchParams.get("text")).toBe("Hola, ¿qué tal? 39 € & más");
    expect(new URL(enlaceWhatsApp()).searchParams.get("text")).toMatch(/fiddle/);
  });

  it("el correo lleva la dirección y el asunto", () => {
    expect(enlaceCorreo("Hola & adiós")).toBe(`mailto:${CORREO}?subject=Hola%20%26%20adi%C3%B3s`);
  });

  it("dos planes: Tarjetas a 39 € y Completo a 49 €, el segundo destacado", () => {
    expect(PLANES.map((p) => [p.id, p.precio])).toEqual([["tarjetas", 39], ["completo", 49]]);
    expect(PLANES.filter((p) => p.destacado).map((p) => p.id)).toEqual(["completo"]);
    for (const p of PLANES) expect(p.incluye.length).toBeGreaterThan(0);
    expect(new Set(PLANES.map((p) => p.id)).size).toBe(PLANES.length);
  });

  it("el mensaje de cada plan dice cuál y cuánto", () => {
    expect(mensajeDePlan(PLANES[0])).toContain("Tarjetas");
    expect(mensajeDePlan(PLANES[0])).toContain("39 €");
    expect(mensajeDePlan(PLANES[1])).toContain("49 €");
  });
});

describe("web de fiddle: tarjetas de ejemplo", () => {
  it("se arman con las funciones del pase y el aviso es el campo que cambia", () => {
    const e = ejemplo(CAFETERIA, 7);
    expect(e.negocio.nombre).toBe("Tu cafetería");
    expect(e.cliente.sellos).toBe(7);
    expect(avisoDe(e)).toBe("Faltan 1 · café gratis");
    expect(stripDelPase(e.negocio, e.cliente).svg).toMatch(/^<svg/);
  });

  it("el carrusel enseña cosas distintas, y abierto/cerrado lo escribe estadoParaPase", () => {
    expect(new Set(CARRUSEL.map((d) => d.id)).size).toBe(CARRUSEL.length);
    expect(new Set(CARRUSEL.map((d) => d.titulo)).size).toBe(CARRUSEL.length);
    const porId = Object.fromEntries(CARRUSEL.map((d) => [d.id, ejemploDe(d)]));
    expect(porId.abierto.estado).toEqual({ abierta: true, texto: "Abierto hasta las 20:00" });
    expect(porId.cerrado.estado).toEqual({ abierta: false, texto: "Cerrado hasta las 8:00" });
    expect(porId.vaso.estado).toBeNull();
    // Dos cartillas: el aviso dice de cuál es.
    expect(porId.doble.negocio.cartillas).toHaveLength(2);
    expect(avisoDe(porId.doble)).toBe("Cafés: Faltan 3");
    for (const e of Object.values(porId)) {
      expect(avisoDe(e)).not.toBe("");
      expect(stripDelPase(e.negocio, e.cliente, { estado: e.estado }).svg).toMatch(/^<svg/);
    }
  });

  it("nunca enseñan un kit de marca ni el nombre de un cliente", () => {
    for (const t of [CAFETERIA, ...CARRUSEL.map((d) => d.tienda), ...MUESTRARIO]) {
      expect(ESTILOS_GENERALES).toContain(t.tema.estilo);
      const e = ejemplo(t, 3);
      expect(e.cliente).not.toHaveProperty("nombre");
      expect(e.negocio).not.toHaveProperty("brief");
    }
  });

  it("los colores de la tienda de ejemplo se guardarían (#rrggbb)", () => {
    for (const color of Object.values(PALETA)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("el violín de fiddle", () => {
  it("recorta la efe con una máscara del id que se le pide", () => {
    const svg = svgViolin({ color: "#402c0f", id: "efe-pie" });
    expect(svg).toContain('<mask id="efe-pie"');
    expect(svg).toContain('mask="url(#efe-pie)"');
    expect(svg).toContain('fill="#402c0f"');
    expect(svg).not.toContain("<text");
  });

  it("el icono es un SVG cuadrado con su fondo", () => {
    const svg = svgIconoViolin({ color: "#402c0f", fondo: "#a5a789", radio: 230 });
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 1024 1024"/);
    expect(svg).toContain('fill="#a5a789"');
  });
});
