import { describe, it, expect } from "vitest";
import {
  IDS, FINAL, normalizarPrimerosPasos, primerosPasosNuevos, avanceDe, mostrarAviso,
  marcarHecho, conOculto, pasoDeHash, siguienteDe, anteriorDe, leerCambio,
} from "@/lib/primerosPasos";

const tienda = (extra = {}) => ({ slug: "cafe", horario: null, promo: null, primerosPasos: primerosPasosNuevos(new Date("2026-11-24T10:00:00Z")), ...extra });

describe("primeros pasos", () => {
  it("una tienda sin la clave no tiene primeros pasos ni aviso", () => {
    expect(avanceDe({ slug: "delicanteria" })).toBeNull();
    expect(mostrarAviso({ slug: "delicanteria" })).toBe(false);
    expect(normalizarPrimerosPasos(null)).toBeNull();
    expect(normalizarPrimerosPasos([])).toBeNull();
  });

  it("una tienda nueva empieza por la tarjeta y enseña el aviso", () => {
    expect(avanceDe(tienda())).toEqual({ hechos: [], total: 5, siguiente: "tarjeta", terminado: false, oculto: false });
    expect(mostrarAviso(tienda())).toBe(true);
  });

  it("el horario y la promo puestos a mano cuentan como hechos", () => {
    const a = avanceDe(tienda({ horario: { zona: "Europe/Madrid" }, promo: "2x1" }));
    expect(a.hechos).toEqual(["horario", "promos"]);
    expect(a.siguiente).toBe("tarjeta");
    expect(avanceDe(tienda({ promo: "   " })).hechos).toEqual([]);
  });

  it("marcar no repite, guarda en orden e ignora lo que no es un paso", () => {
    let pp = marcarHecho(tienda().primerosPasos, "promos");
    pp = marcarHecho(pp, "tarjeta");
    pp = marcarHecho(pp, "tarjeta");
    pp = marcarHecho(pp, "otro");
    expect(pp.hechos).toEqual(["tarjeta", "promos"]);
  });

  it("con todos hechos está terminado y el aviso no sale", () => {
    const pp = IDS.reduce(marcarHecho, tienda().primerosPasos);
    const a = avanceDe(tienda({ primerosPasos: pp }));
    expect(a).toMatchObject({ terminado: true, siguiente: null });
    expect(mostrarAviso(tienda({ primerosPasos: pp }))).toBe(false);
  });

  it("ocultar quita el aviso sin perder lo hecho; volver a enseñarlo lo devuelve", () => {
    const pp = conOculto(marcarHecho(tienda().primerosPasos, "qr"), true);
    expect(mostrarAviso(tienda({ primerosPasos: pp }))).toBe(false);
    expect(avanceDe(tienda({ primerosPasos: pp })).hechos).toEqual(["qr"]);
    expect(mostrarAviso(tienda({ primerosPasos: conOculto(pp, false) }))).toBe(true);
  });

  it("no cambia el objeto que recibe", () => {
    const pp = Object.freeze({ ...tienda().primerosPasos, hechos: Object.freeze([]) });
    expect(() => marcarHecho(pp, "qr")).not.toThrow();
    expect(pp.hechos).toEqual([]);
  });

  it("el hash dice el paso; uno desconocido no", () => {
    expect(pasoDeHash("#horario")).toBe("horario");
    expect(pasoDeHash("#listo")).toBe(FINAL);
    expect(pasoDeHash("#nada")).toBeNull();
    expect(pasoDeHash("")).toBeNull();
  });

  it("siguiente y anterior recorren los cinco y acaban en el final", () => {
    expect(siguienteDe("tarjeta")).toBe("qr");
    expect(siguienteDe("promos")).toBe(FINAL);
    expect(anteriorDe("tarjeta")).toBeNull();
    expect(anteriorDe(FINAL)).toBe("promos");
  });

  it("la API solo acepta un paso conocido o el oculto", () => {
    expect(leerCambio({ hecho: "qr" })).toEqual({ hecho: "qr" });
    expect(leerCambio({ hecho: "admin" })).toHaveProperty("error");
    expect(leerCambio({ oculto: true })).toEqual({ oculto: true });
    expect(leerCambio({ oculto: "si" })).toHaveProperty("error");
    expect(leerCambio(null)).toHaveProperty("error");
  });
});
