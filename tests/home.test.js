import { describe, it, expect } from "vitest";
import { PLANES, WHATSAPP, CORREO, enlaceWhatsApp, enlaceCorreo, enlaceGmail, mensajeDePlan } from "@/app/home/datos";
import { ejemplo, avisoDe, ejemploDe, CAFETERIA, CARRUSEL, CINTAS, DISENOS } from "@/app/home/demo";
import { GRUPOS } from "@/lib/crm";
import { ubicacionesApple } from "@/lib/apple/pase";
import { PALETA } from "@/app/home/paleta";
import { svgViolin, svgIconoViolin } from "@/lib/violin";
import { ESTILOS_GENERALES } from "@/lib/negocios";
import { stripDelPase, esColorClaro, colorDelPase } from "@/lib/apple/dibujo";
import { pedir, entrar, INICIO, paradaMasCercana } from "@/app/home/posicion";

describe("web de fiddle: contacto y precios", () => {
  it("WhatsApp abre el chat con el mensaje escrito, sin «+» ni espacios en el número", () => {
    expect(WHATSAPP).toMatch(/^\d{11}$/);
    const url = new URL(enlaceWhatsApp("Hola, ¿qué tal? 39 € & más"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe(`/${WHATSAPP}`);
    expect(url.searchParams.get("text")).toBe("Hola, ¿qué tal? 39 € & más");
    expect(new URL(enlaceWhatsApp()).searchParams.get("text")).toMatch(/fiddle/);
  });

  it("el correo lleva la dirección, el asunto y el mensaje empezado", () => {
    expect(enlaceCorreo("Hola & adiós", "Uno")).toBe(`mailto:${CORREO}?subject=Hola%20%26%20adi%C3%B3s&body=Uno`);
    expect(enlaceCorreo()).toMatch(/^mailto:[^?]+\?subject=.+&body=.+/);
  });

  it("en el ordenador, Gmail con el correo ya escrito a nuestra dirección", () => {
    const url = new URL(enlaceGmail("Asunto & más", "Cuerpo"));
    expect(url.origin).toBe("https://mail.google.com");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe(CORREO);
    expect(url.searchParams.get("su")).toBe("Asunto & más");
    expect(url.searchParams.get("body")).toBe("Cuerpo");
  });

  it("dos planes: Tarjetas a 39 € y Completo a 49 €, el segundo destacado", () => {
    expect(PLANES.map((p) => [p.id, p.precio])).toEqual([["tarjetas", 39], ["completo", 49]]);
    expect(PLANES.filter((p) => p.destacado).map((p) => p.id)).toEqual(["completo"]);
    for (const p of PLANES) expect(p.incluye.length).toBeGreaterThan(0);
    // Lo que decidieron para cada uno (13-10-2026).
    expect(PLANES[0].incluye.join(" ")).toMatch(/sin límite/);
    expect(PLANES[0].incluye.join(" ")).toMatch(/Promociones al momento, a todos/);
    expect(PLANES[1].incluye[0]).toBe("Todo lo de Tarjetas");
    for (const cosa of [/estadísticas/, /grupos/, /automáticos y programados/, /Abierto hasta/, /pasar cerca/]) {
      expect(PLANES[1].incluye.join(" ")).toMatch(cosa);
    }
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

  it("el catálogo: cada diseño una vez, y el móvil y las cintas salen de él", () => {
    const ids = DISENOS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of [...CARRUSEL, ...CINTAS.flat()]) expect(DISENOS).toContain(d);
    // La última del móvil dice cuándo vuelves a abrir: su título empieza por «Y».
    expect(CARRUSEL.at(-1).titulo).toMatch(/^Y /);
    // Ninguna cinta repite un diseño, ni dentro ni de una a la otra.
    const enCintas = CINTAS.flat().map((d) => d.id);
    expect(new Set(enCintas).size).toBe(enCintas.length);
    // La primera, justo bajo el móvil, enseña lo que el móvil no.
    for (const d of CINTAS[0]) expect(CARRUSEL).not.toContain(d);
  });

  it("los colores de cada diseño se guardarían y se leen en el pase", () => {
    for (const d of DISENOS) {
      const { tema } = ejemploDe(d).negocio;
      for (const k of ["cardBg", "ink", "accent", "detalle"]) if (tema[k] !== undefined) expect(tema[k], `${d.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/);
      // accent también pinta los botones de la caja, con texto blanco: nunca claro.
      expect(esColorClaro(tema.accent), `${d.id}: accent claro`).toBe(false);
      // Las etiquetas («PREMIO») van en el color del pase: no puede ser el del fondo.
      expect(contraste(colorDelPase(tema), tema.cardBg), `${d.id}: etiquetas`).toBeGreaterThanOrEqual(3);
      expect(contraste(tema.ink, tema.cardBg), `${d.id}: texto`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("nunca enseñan un kit de marca ni el nombre de un cliente", () => {
    for (const t of [CAFETERIA, ...DISENOS.map((d) => d.tienda)]) {
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

describe("web de fiddle: el panel", () => {
  it("los grupos que enseña existen, con su icono y su frase", () => {
    for (const id of ["a_punto", "fieles_frios", "nuevos", "dormidos"]) {
      expect(GRUPOS[id]?.label).toBeTruthy();
      expect(GRUPOS[id].icon).toBeTruthy();
    }
    expect(GRUPOS.a_punto.idea.replace("{premio}", CAFETERIA.premio)).toBe("Te falta 1 para tu café gratis");
  });

  it("el aviso al pasar cerca es el que mete el pase", () => {
    const { negocio } = ejemplo(CAFETERIA, 7);
    const [u] = ubicacionesApple({ ...negocio, ubicaciones: [{ lat: 39.47, lng: -0.37 }] });
    expect(u.relevantText).toBe("Estás cerca de Tu cafetería. Enseña tu tarjeta en caja.");
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

// Contraste WCAG entre dos #rrggbb.
function contraste(a, b) {
  const luz = (hex) => {
    const [r, g, bl] = hex.slice(1).match(/../g).map((x) => {
      const c = parseInt(x, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [claro, oscuro] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

describe("web de fiddle: el móvil que pasa tarjetas", () => {
  it("hacia delante entra por la derecha y da la vuelta al final", () => {
    let p = pedir(INICIO, (a) => a + 1, 1, 3);
    expect(p).toMatchObject({ actual: 1, anterior: 0, sentido: 1, objetivo: null, movido: true });
    p = pedir(pedir(p, (a) => a + 1, 1, 3), (a) => a + 1, 1, 3);
    expect(p.actual).toBe(0);
  });

  it("al ir hacia atrás, primero se dan la vuelta las que esperan y luego entra", () => {
    const delante = pedir(INICIO, 2, 1, 4);
    const vuelta = pedir(delante, (a) => a - 1, -1, 4);
    // Primer tiempo: la misma de antes, otro sentido y la que se iba, fuera ya.
    expect(vuelta).toMatchObject({ actual: 2, anterior: null, sentido: -1, objetivo: 1 });
    // Segundo tiempo (el fotograma siguiente): entra la que esperaba.
    expect(entrar(vuelta)).toMatchObject({ actual: 1, anterior: 2, sentido: -1, objetivo: null });
    // Si ya entró, el segundo tiempo no hace nada.
    expect(entrar(entrar(vuelta))).toEqual(entrar(vuelta));
  });

  it("pedir la que ya se ve no cambia nada; el primer aviso espera a que se mueva", () => {
    expect(pedir(INICIO, 0, 1, 5)).toBe(INICIO);
    expect(pedir(INICIO, 5, 1, 5)).toBe(INICIO);
    expect(INICIO.movido).toBe(false);
    expect(pedir(INICIO, -1, -1, 5)).toMatchObject({ actual: 0, objetivo: 4 });
  });
});

describe("web de fiddle: las filas que se deslizan en el móvil", () => {
  const paradas = [0, 300, 600, 900];
  it("marca la parada más cercana", () => {
    expect(paradaMasCercana({ paradas, desplazado: 0, maximo: 800 })).toBe(0);
    expect(paradaMasCercana({ paradas, desplazado: 140, maximo: 800 })).toBe(0);
    expect(paradaMasCercana({ paradas, desplazado: 170, maximo: 800 })).toBe(1);
    expect(paradaMasCercana({ paradas, desplazado: 610, maximo: 800 })).toBe(2);
  });

  it("al final del todo, la última aunque no llegue a alinearse", () => {
    expect(paradaMasCercana({ paradas, desplazado: 798, maximo: 800 })).toBe(3);
  });

  it("si no hay nada que deslizar, la primera", () => {
    expect(paradaMasCercana({ paradas, desplazado: 0, maximo: 0 })).toBe(0);
    expect(paradaMasCercana({ paradas: [], desplazado: 0, maximo: 100 })).toBe(0);
  });
});
