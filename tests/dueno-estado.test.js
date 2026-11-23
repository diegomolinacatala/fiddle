import { describe, it, expect } from "vitest";
import { estadoDeHoy, claveDeEstado, avisoVisible, horaDeRepaso } from "@/lib/dueno/estado";

const zona = "Europe/Madrid";
const horario = {
  zona,
  semana: [
    [{ abre: "08:30", cierra: "14:00" }],
    [{ abre: "08:30", cierra: "14:00" }],
    [{ abre: "08:30", cierra: "14:00" }],
    [{ abre: "08:30", cierra: "14:00" }],
    [{ abre: "08:30", cierra: "14:00" }],
    null,
    null,
  ],
};
const negocio = { slug: "cafe", horario };
const LUNES = Date.parse("2026-11-16T08:00:00Z");

describe("estadoDeHoy", () => {
  const observaciones = [{ id: "dormidos", texto: "Hay clientes dormidos.", accion: { tipo: "grupo", grupo: "dormidos", label: "Avisar" } }];

  it("une la fecha local, el informe y el aviso", () => {
    const e = estadoDeHoy({ negocio, eventos: [], observaciones, ahora: LUNES, base: "https://x.test" });
    expect(e.fecha).toBe("2026-11-16");
    expect(e.informe.desde).toBe("2026-11-09");
    expect(e.aviso.id).toBe("dormidos");
    expect(e.aviso.enlace.startsWith("https://x.test/cafe/avisos")).toBe(true);
  });

  it("sin «ideas», no hay aviso del día aunque los números digan algo", () => {
    const e = estadoDeHoy({ negocio, eventos: [], observaciones, ahora: LUNES, recibir: { ideas: false } });
    expect(e.aviso).toBeNull();
    expect(e.informe.desde).toBe("2026-11-09");
  });

  it("con una a la semana y una ya dicha, tampoco", () => {
    const e = estadoDeHoy({ negocio, eventos: [], observaciones, ahora: LUNES, avisados: { otra: "2026-11-16" }, recibir: { porSemana: 1 } });
    expect(e.aviso).toBeNull();
  });

  it("la fecha es la de la tienda: a las 23:30 UTC ya es el día siguiente", () => {
    const e = estadoDeHoy({ negocio, eventos: [], observaciones: [], ahora: Date.parse("2026-11-15T23:30:00Z") });
    expect(e.fecha).toBe("2026-11-16");
    expect(e.aviso).toBeNull();
  });
});

describe("claveDeEstado", () => {
  it("junta el lunes de la semana y el aviso", () => {
    expect(claveDeEstado({ informe: { desde: "2026-11-09" }, aviso: { id: "dormidos" } })).toBe("2026-11-09|dormidos");
  });
  it("sin aviso queda vacío tras la barra", () => {
    expect(claveDeEstado({ informe: { desde: "2026-11-09" }, aviso: null })).toBe("2026-11-09|");
  });
});

describe("avisoVisible", () => {
  const estado = { aviso: { texto: "Del día", enlace: "/a", hasta: "2026-11-16T23:00:00.000Z" } };
  const prueba = (hasta) => ({ prueba: { texto: "De prueba", enlace: "/p", hasta } });

  it("una prueba vigente gana al aviso del día", () => {
    const v = avisoVisible(prueba("2026-11-16T09:00:00.000Z"), estado, LUNES);
    expect(v).toEqual({ texto: "De prueba", enlace: "/p" });
  });
  it("una prueba caducada no cuenta: sale el aviso del día", () => {
    expect(avisoVisible(prueba("2026-11-16T07:00:00.000Z"), estado, LUNES)).toEqual({ texto: "Del día", enlace: "/a" });
  });
  it("el aviso del día caducado no se enseña", () => {
    expect(avisoVisible({}, estado, Date.parse("2026-11-17T00:00:00Z"))).toBeNull();
  });
  it("sin «ideas», el aviso del día ya calculado se deja de enseñar", () => {
    expect(avisoVisible({ recibir: { ideas: false } }, estado, LUNES)).toBeNull();
  });
  it("sin «ideas», la prueba sí sale: la pide él", () => {
    const tarjeta = { ...prueba("2026-11-16T09:00:00.000Z"), recibir: { ideas: false } };
    expect(avisoVisible(tarjeta, estado, LUNES)).toEqual({ texto: "De prueba", enlace: "/p" });
  });
  it("sin nada que enseñar devuelve null", () => {
    expect(avisoVisible({ prueba: null }, { aviso: null }, LUNES)).toBeNull();
    expect(avisoVisible(null, null, LUNES)).toBeNull();
  });
});

describe("horaDeRepaso", () => {
  it("es la primera apertura del día", () => {
    expect(horaDeRepaso(horario, "2026-11-16")).toBe(8 * 60 + 30);
  });
  it("si el día no abre, las 9:00", () => {
    expect(horaDeRepaso(horario, "2026-11-15")).toBe(540);
  });
  it("sin horario, las 9:00", () => {
    expect(horaDeRepaso(null, "2026-11-16")).toBe(540);
  });
  it("con horario partido, la apertura de la mañana", () => {
    const partido = { zona, semana: [[{ abre: "09:00", cierra: "13:00" }, { abre: "17:00", cierra: "20:00" }], null, null, null, null, null, null] };
    expect(horaDeRepaso(partido, "2026-11-16")).toBe(540);
  });
});
