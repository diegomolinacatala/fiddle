import { describe, it, expect } from "vitest";
import { PLANES, WHATSAPP, CORREO, enlaceWhatsApp, enlaceCorreo, mensajeDePlan } from "@/app/home/datos";
import { ejemplo, avisoDeSello, CAFETERIA, MUESTRARIO } from "@/app/home/demo";
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
    expect(avisoDeSello(e)).toBe("Faltan 1 · café gratis");
    expect(stripDelPase(e.negocio, e.cliente).svg).toMatch(/^<svg/);
  });

  it("nunca enseñan un kit de marca ni el nombre de un cliente", () => {
    for (const m of [CAFETERIA, ...MUESTRARIO]) {
      expect(ESTILOS_GENERALES).toContain(m.estilo);
      const e = ejemplo(m, 3);
      expect(e.cliente).not.toHaveProperty("nombre");
      expect(e.negocio).not.toHaveProperty("brief");
    }
  });
});
