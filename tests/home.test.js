import { describe, it, expect } from "vitest";
import { PLANES, WHATSAPP, CORREO, enlaceWhatsApp, enlaceCorreo, enlaceGmail, mensajeDePlan } from "@/app/home/datos";
import { ejemplo, avisoDe, ejemploDe, CAFETERIA, CARRUSEL, CINTAS, DISENOS } from "@/app/home/demo";
import { GRUPOS } from "@/lib/crm";
import { ubicacionesApple } from "@/lib/apple/pase";
import { PALETA } from "@/app/home/paleta";
import { svgLacre, svgLogoLacre, svgIconoLacre } from "@/lib/lacre";
import { ESTILOS_GENERALES } from "@/lib/negocios";
import { stripDelPase, esColorClaro, colorDelPase } from "@/lib/apple/dibujo";
import { pedir, entrar, INICIO, paradaMasCercana } from "@/app/home/posicion";
import { MARCAS as MARCAS_DIBUJO, MODOS as MODOS_DIBUJO, FORMAS as FORMAS_DIBUJO } from "@/lib/apple/dibujo";
import {
  PALETAS, ICONOS, MODOS as MODOS_PROBADOR, MODOS_DOS, FONDOS, SECCIONES, INICIAL, MAX_NOMBRE, NOMBRE_POR_DEFECTO,
  ZOOM_MAX, ENTERA_MAX, limpiar, temaDe, tarjetaDe, encuadre, regionDe,
} from "@/app/home/tarjeta/opciones";
import { leerEmail, leerTelefono, leerContactos } from "@/lib/interesados";
import { cifrasDe } from "@/lib/apple/dibujo";

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

  it("tres planes: Esencial a 19 €, Plus a 39 € y Pro a 49 €, el último destacado", () => {
    expect(PLANES.map((p) => [p.id, p.precio])).toEqual([["esencial", 19], ["plus", 39], ["pro", 49]]);
    expect(PLANES.filter((p) => p.destacado).map((p) => p.id)).toEqual(["pro"]);
    for (const p of PLANES) expect(p.incluye.length).toBeGreaterThan(0);
    const [esencial, plus, pro] = PLANES.map((p) => p.incluye.join(" "));
    // Esencial (06-11-2026): hasta 750 tarjetas, sin promociones y la monta la tienda.
    expect(esencial).toMatch(/750 tarjetas/);
    expect(esencial).not.toMatch(/Promociones|sin límite|montada/);
    expect(esencial).toMatch(/La montas tú/);
    // Plus y Pro (13-10-2026; antes Tarjetas y Completo).
    expect(plus).toMatch(/sin límite/);
    expect(plus).toMatch(/Promociones al momento, a todos/);
    expect(PLANES[2].incluye[0]).toBe("Todo lo de Plus");
    // Las estadísticas van desde Plus (06-11-2026, como los planes de lib/planes.js).
    expect(plus).toMatch(/estadísticas/);
    for (const cosa of [/grupos/, /automáticos y programados/, /Abierto hasta/, /pasar cerca/]) {
      expect(pro).toMatch(cosa);
    }
    expect(new Set(PLANES.map((p) => p.id)).size).toBe(PLANES.length);
  });

  it("el mensaje de cada plan dice cuál y cuánto", () => {
    expect(mensajeDePlan(PLANES[0])).toContain("Esencial");
    expect(mensajeDePlan(PLANES[0])).toContain("19 €");
    expect(mensajeDePlan(PLANES[1])).toContain("Plus");
    expect(mensajeDePlan(PLANES[1])).toContain("39 €");
    expect(mensajeDePlan(PLANES[2])).toContain("49 €");
    expect(mensajeDePlan(PLANES[2])).toContain("plan Pro");
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
    expect(avisoDe(porId.doble)).toBe("Cookies: Faltan 3");
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

describe("el lacre de fiddle", () => {
  it("recorta el anillo y la f con una máscara del id que se le pide", () => {
    const svg = svgLacre({ color: "#402c0f", id: "efe-pie" });
    expect(svg).toContain('<mask id="efe-pie"');
    expect(svg).toContain('mask="url(#efe-pie)"');
    expect(svg).toContain('fill="#402c0f"');
    expect(svg).not.toContain("<text");
  });

  it("el icono es un SVG cuadrado con su fondo", () => {
    const svg = svgIconoLacre({ color: "#402c0f", fondo: "#a5a789", radio: 230 });
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 1024 1024"/);
    expect(svg).toContain('fill="#a5a789"');
  });

  it("el logo lleva el sello y el nombre, en trazos y del mismo color", () => {
    const svg = svgLogoLacre({ color: "#402c0f", id: "efe-logo" });
    expect(svg).toContain('mask="url(#efe-logo)"');
    expect(svg.match(/fill="#402c0f"/g)).toHaveLength(2);
    expect(svg).not.toContain("<text");
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

describe("web de fiddle: «Diseña tu tarjeta»", () => {
  it("cada opción existe en el dibujo del pase", () => {
    for (const i of ICONOS) expect(MARCAS_DIBUJO, i.id).toContain(i.id);
    for (const m of MODOS_PROBADOR) expect(MODOS_DIBUJO, m.id).toContain(m.id);
    for (const m of MODOS_DOS) expect(MODOS_DIBUJO, m.id).toContain(m.id);
    for (const p of PALETAS) {
      for (const color of [p.cardBg, p.ink, p.accent, p.detalle].filter(Boolean)) expect(color, p.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("los colores se leen en el pase, y la banda nunca es la de barbería", () => {
    for (const p of PALETAS) {
      for (const fondo of FONDOS) {
        const tema = temaDe({ paleta: p.id, fondo: fondo.id });
        expect(tema.banda).not.toBe("oscura");
        expect(esColorClaro(tema.accent), `${p.id}: accent claro`).toBe(false);
        expect(contraste(colorDelPase(tema), tema.cardBg), `${p.id}: etiquetas`).toBeGreaterThanOrEqual(3);
        expect(contraste(tema.ink, tema.cardBg), `${p.id}: texto`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("lo que llega del navegador se limpia: nada fuera de las listas", () => {
    const e = limpiar({ cartillas: 7, paleta: "x", icono: "pizza", modo: "luna", premio: "<b>", nombre: "a".repeat(80) });
    expect(e).toMatchObject({ cartillas: 1, paleta: PALETAS[0].id, icono: ICONOS[0].id, modo: INICIAL.modo });
    expect(e).not.toHaveProperty("premio");
    expect(e.nombre).toHaveLength(MAX_NOMBRE);
    // Con dos premios, solo los modos que caben dos veces, y dos iconos distintos.
    expect(limpiar({ cartillas: 2, modo: "cifra" }).modo).toBe(INICIAL.modo);
    expect(limpiar({ cartillas: 2, icono: "galleta", icono2: "galleta" }).icono2).toBe("taza");
  });

  it("la tarjeta sale de las funciones del pase, sin nombre de cliente ni brief", () => {
    const { negocio, cliente } = tarjetaDe({ ...INICIAL, nombre: "  " });
    expect(negocio.nombre).toBe(NOMBRE_POR_DEFECTO);
    expect(cliente).not.toHaveProperty("nombre");
    expect(negocio).not.toHaveProperty("brief");
    expect(stripDelPase(negocio, cliente).svg).toContain("<svg");
    expect(tarjetaDe({ ...INICIAL, nombre: "Café Ruzafa" }).negocio.nombre).toBe("Café Ruzafa");
  });

  it("los números: las tres letras salen distintas, y sin elegir cada banda sigue como estaba", () => {
    const banda = (e) => { const { negocio, cliente } = tarjetaDe(e); return stripDelPase(negocio, cliente).svg; };
    for (const m of MODOS_PROBADOR.filter((x) => x.id !== "casillas")) {
      const [g, n, c] = ["gruesas", "normales", "cuadradas"].map((cifras) => banda({ ...INICIAL, modo: m.id, cifras }));
      expect(new Set([g, n, c]).size, m.id).toBe(3);
    }
    const dos = (cifras) => banda({ ...INICIAL, cartillas: 2, cifras });
    expect(new Set([dos("gruesas"), dos("normales"), dos("cuadradas")]).size).toBe(3);
    // Dos cartillas lado a lado sin elegir letra (La Delicantería): las normales de siempre.
    const lados = tarjetaDe({ ...INICIAL, cartillas: 2, cifras: "normales" });
    const sinElegir = { ...lados.negocio, tema: { ...lados.negocio.tema, cifras: undefined } };
    expect(stripDelPase(sinElegir, lados.cliente).svg).toBe(stripDelPase(lados.negocio, lados.cliente).svg);
    expect(cifrasDe({})).toBe("cuadradas");
    expect(cifrasDe({}, "normales")).toBe("normales");
    expect(cifrasDe({ cifras: "<b>" })).toBe("cuadradas");
    expect(cifrasDe({ cifras: "normales" })).toBe("normales");
  });

  it("el premio sale del icono", () => {
    expect(tarjetaDe({ ...INICIAL, icono: "galleta" }).negocio.premio).toBe("cookie gratis");
    expect(tarjetaDe({ ...INICIAL, icono: "taza" }).negocio.premio).toBe("café gratis");
    for (const i of ICONOS) expect(i.premio, i.id).toBeTruthy();
  });

  it("con dos premios salen dos cartillas, y lado a lado la taza va a la derecha", () => {
    for (const m of MODOS_DOS) {
      const { negocio, cliente } = tarjetaDe({ ...INICIAL, cartillas: 2, modo: m.id });
      expect(negocio.cartillas, m.id).toHaveLength(2);
      expect(stripDelPase(negocio, cliente).svg, m.id).toContain("<svg");
    }
    const { negocio } = tarjetaDe({ ...INICIAL, cartillas: 2, modo: "relleno", icono: "taza", icono2: "galleta" });
    expect(negocio.cartillas.map((c) => c.marca)).toEqual(["galleta", "taza"]);
  });

  it("el contacto del final: email, teléfono o los dos, y con uno basta", () => {
    expect(leerEmail(" hola@cafe.es ")).toBe("hola@cafe.es");
    expect(leerTelefono("+34 600 123 456")).toBe("+34 600 123 456");
    for (const malo of ["", "hola", "12345", "a@b", "<b>@x.es y más", 7, null]) {
      expect(leerEmail(malo), String(malo)).toBeNull();
      expect(leerTelefono(malo), String(malo)).toBeNull();
    }
    expect(leerTelefono("hola@cafe.es")).toBeNull();
    expect(leerEmail("600123456")).toBeNull();

    expect(leerContactos({ email: "hola@cafe.es", telefono: "  " })).toEqual({ email: "hola@cafe.es", telefono: null, errores: null });
    expect(leerContactos({ telefono: "600 123 456" })).toEqual({ email: null, telefono: "600 123 456", errores: null });
    expect(leerContactos({ email: "hola@cafe.es", telefono: "600123456" })).toEqual({ email: "hola@cafe.es", telefono: "600123456", errores: null });
    expect(leerContactos({}).errores.ninguno).toBeTruthy();
    expect(leerContactos(undefined).errores.ninguno).toBeTruthy();
    // Uno bien no tapa el otro mal: se diría guardado sin el que creía haber dejado.
    const mal = leerContactos({ email: "hola@cafe.es", telefono: "123" });
    expect(mal.errores).toEqual({ telefono: expect.any(String) });
    expect(mal.email).toBeNull();
  });

  it("la cámara: la tarjeta entera cabe y una parte queda en el centro", () => {
    const tarjeta = { w: 340, h: 500 };
    const todo = encuadre(null, tarjeta, { w: 800, h: 800 });
    expect(todo.y).toBe(0);
    expect(todo.s * tarjeta.h).toBeLessThanOrEqual(800 * 0.8 + 0.5);
    expect(encuadre(null, tarjeta, { w: 2000, h: 2000 }).s).toBe(ENTERA_MAX);
    // La cabecera (arriba) baja: el desplazamiento la lleva al centro.
    const cabecera = encuadre({ top: 0, height: 60 }, tarjeta, { w: 900, h: 800 });
    expect(cabecera.s).toBe(ZOOM_MAX);
    expect(cabecera.y).toBeCloseTo((250 - 30) * ZOOM_MAX, 1);
    // En un móvil estrecho, no se sale por los lados.
    expect(encuadre({ top: 0, height: 60 }, tarjeta, { w: 375, h: 400 }).s * tarjeta.w).toBeLessThanOrEqual(375 * 0.9 + 0.5);
    expect(encuadre(null, { w: 0, h: 0 }, { w: 375, h: 400 })).toEqual({ s: 1, y: 0 });
  });

  it("varias partes se encuadran juntas; «todo» o una que no está, la tarjeta entera", () => {
    const medidas = { cabecera: { top: 0, height: 60 }, banda: { top: 60, height: 120 } };
    expect(regionDe("cabecera banda", medidas)).toEqual({ top: 0, height: 180 });
    expect(regionDe("todo", medidas)).toBeNull();
    expect(regionDe("campos", medidas)).toBeNull();
    for (const s of SECCIONES) expect(s.parte === "todo" || s.parte.split(" ").every((p) => ["cabecera", "banda", "campos"].includes(p))).toBe(true);
  });
});
