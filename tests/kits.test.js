import { describe, it, expect } from "vitest";
import { KITS, kitDe, ESTILOS_DE_KITS, ROTULOS_DE_KITS } from "@/lib/kits";
import {
  svgLogo, svgLogoGoogle, svgStripSellos, svgStripCartillas, stripDelPase, temaDelPase, colorDelPase,
  resolverMarca, MARCAS, MARCAS_PROPIAS, MODOS,
} from "@/lib/apple/dibujo";
import { ESTILOS, ESTILOS_GENERALES, estilosDelKit, temaPorDefecto, SEMILLAS } from "@/lib/negocios";
import { patchNegocio } from "@/lib/validacion";
import { construirPassJson, hexARgb } from "@/lib/apple/pase";

const VERDE = "#5b825b";
const BLANCO = "#ffffff";

// Luminancia WCAG, para comprobar lo que se lee y lo que no.
const luz = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("kit de marca de La Delicantería", () => {
  it("solo lo tiene su tienda", () => {
    expect(kitDe("delicanteria")).toBe(KITS.delicanteria);
    expect(kitDe("nube")).toBeNull();
    expect(kitDe("__proto__")).toBeNull();
    expect(kitDe(undefined)).toBeNull();
  });

  it("sus dibujos son los del manual y se dibujan en un solo color", () => {
    for (const marca of Object.keys(KITS.delicanteria.marcas)) {
      expect(MARCAS_PROPIAS).toContain(marca);
      expect(resolverMarca(marca)).toBe(marca);
      const svg = svgLogo({ accent: "#123456", marca });
      expect(svg).toContain('fill="#123456"');
      expect(svg).not.toMatch(/fill="#(?!123456)/); // ni un color más
      expect(svg).not.toContain("<text");
    }
  });

  it("no salen en el selector de los demás: MARCAS sigue siendo la lista de siempre", () => {
    for (const marca of MARCAS_PROPIAS) expect(MARCAS).not.toContain(marca);
  });

  it("valen en cualquier modo de la banda, también el que se llena", () => {
    for (const marca of MARCAS_PROPIAS) {
      for (const modo of MODOS) {
        expect(svgStripSellos(temaPorDefecto({ estilo: "delicanteria-verde", marca, modo }), 8, 5)).toContain("<svg");
      }
    }
  });

  it("sus diseños son estilos válidos que solo ve su editor", () => {
    const suyos = estilosDelKit("delicanteria");
    expect(suyos).toEqual(Object.keys(KITS.delicanteria.estilos));
    expect(estilosDelKit("nube")).toEqual([]);
    for (const estilo of suyos) {
      expect(ESTILOS).toContain(estilo); // se pueden guardar
      expect(ESTILOS_GENERALES).not.toContain(estilo); // pero no se ofrecen a otros
      expect(ROTULOS_DE_KITS[estilo]).toBeTruthy();
    }
    expect(Object.keys(ESTILOS_DE_KITS)).toEqual(suyos);
  });

  it("cada diseño lleva el grano del logo y se lee: texto y etiquetas sobre su fondo", () => {
    for (const estilo of estilosDelKit("delicanteria")) {
      const t = temaPorDefecto({ estilo });
      expect(t.estilo).toBe(estilo);
      expect(t.marca).toBe("delicanteria-grano");
      expect(contraste(t.cardBg, t.ink)).toBeGreaterThanOrEqual(3);
      expect(contraste(t.cardBg, colorDelPase(t))).toBeGreaterThanOrEqual(2);
    }
  });

  it("el color de la tienda nunca es claro: pinta botones con texto blanco", () => {
    for (const estilo of estilosDelKit("delicanteria")) {
      expect(contraste(temaPorDefecto({ estilo }).accent, BLANCO)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("color de los detalles del pase", () => {
  const verde = () => temaPorDefecto({ estilo: "delicanteria-verde" });

  it("sin detalle, el pase va en el color de la tienda, como siempre", () => {
    const t = temaPorDefecto({ estilo: "coffee" });
    expect(temaDelPase(t)).toBe(t);
    expect(colorDelPase(t)).toBe(t.accent);
  });

  it("con detalle, logo, sellos y etiquetas van en él; la tienda sigue con el suyo", () => {
    const t = verde();
    expect(t.accent).toBe(VERDE);
    expect(colorDelPase(t)).toBe(BLANCO);
    expect(temaDelPase(temaDelPase(t))).toEqual(temaDelPase(t)); // dos veces = una
    expect(svgLogo(temaDelPase(t))).toContain(`fill="${BLANCO}"`);
    expect(svgLogoGoogle(t)).toContain(`fill="${BLANCO}"`);
    const p = construirPassJson(
      { serial: "3f1c2b1a-1111-4222-8333-444455556666", sellos: 3, sellos2: 1, premios: 0, auth_token: "a".repeat(48) },
      { ...SEMILLAS.delicanteria, tema: t, promo: null, ubicaciones: [] },
      { passTypeId: "pass.dev.sellos", teamId: "ABCDE12345", appUrl: "https://sellos.app" },
    );
    expect(p.labelColor).toBe(hexARgb(BLANCO));
    expect(p.backgroundColor).toBe(hexARgb(VERDE));
  });

  it("un sello blanco lleva la marca en el color de la tarjeta, no en blanco sobre blanco", () => {
    const t = verde();
    const banda = svgStripCartillas(t, [{ marca: "galleta", meta: 8, sellos: 3 }, { marca: "taza", meta: 8, sellos: 1 }]);
    expect(banda).toContain(`fill="${BLANCO}"`); // la casilla llena
    expect(banda).toContain(`fill="${VERDE}"`); // la galleta de dentro
    const una = stripDelPase({ tipo: "sellos", tema: t, meta: 8 }, { sellos: 3 }).svg;
    expect(una).toContain(`fill="${VERDE}"`);
  });

  it("con un color de detalles oscuro, la marca de dentro sigue siendo blanca", () => {
    const t = temaPorDefecto({ estilo: "delicanteria-claro" });
    const banda = svgStripCartillas(t, [{ marca: "galleta", meta: 8, sellos: 3 }, { marca: "taza", meta: 8, sellos: 1 }]);
    expect(banda).toContain('fill="#ffffff"');
  });

  it("se guarda limpio: un hex, o null para volver al de la tienda", () => {
    const deps = { ESTILOS, temaPorDefecto };
    expect(patchNegocio({ tema: { detalle: "#FFFFFF" } }, [], deps).patch.tema.detalle).toBe("#FFFFFF");
    expect(patchNegocio({ tema: { detalle: null } }, [], deps).patch.tema.detalle).toBeNull();
    expect(patchNegocio({ tema: { detalle: "blanco", accent: "#111111" } }, [], deps).patch.tema).not.toHaveProperty("detalle");
  });

  it("elegir un diseño del kit siembra su paleta entera, detalle y fondo de Google incluidos", () => {
    const { patch } = patchNegocio({ tema: { estilo: "delicanteria-verde" } }, [], { ESTILOS, temaPorDefecto });
    expect(patch.tema).toMatchObject({ estilo: "delicanteria-verde", cardBg: VERDE, detalle: BLANCO, google: "tarjeta", marca: "delicanteria-grano" });
    // Y volver a una plantilla de las de siempre lo quita, aunque quien guarde no lo mande:
    // si no, el blanco de la tarjeta verde se quedaría en la cafetería (el store mezcla temas).
    const vuelta = patchNegocio({ tema: { estilo: "coffee" } }, [], { ESTILOS, temaPorDefecto }).patch.tema;
    expect(vuelta.detalle).toBeNull();
  });

  it("una marca solo se acepta por su nombre, nunca una lista que se le parezca", () => {
    expect(resolverMarca(["taza"])).toBeNull();
    expect(resolverMarca(["delicanteria-grano"])).toBeNull();
    expect(resolverMarca("__proto__")).toBeNull();
    expect(resolverMarca("constructor")).toBeNull();
  });
});
