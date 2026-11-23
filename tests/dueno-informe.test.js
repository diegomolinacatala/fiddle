import { describe, it, expect } from "vitest";
import { informeSemanal, semanaDelInforme, textoComparado, fraseDelInforme, lineasDelInforme } from "@/lib/dueno/informe";

const zona = "Europe/Madrid";
const tramos = [{ abre: "08:00", cierra: "14:00" }];
const horario = { zona, semana: [tramos, tramos, tramos, tramos, tramos, null, null] };
const negocio = { slug: "cafe", horario };

let n = 0;
// Cada evento, de una tarjeta distinta: así ninguno se funde con otro en la misma visita.
const ev = (ts, tipo = "sellar") => ({ ts, tipo, serial: `s${n++}`, actor: "caja", mensaje: tipo });

// Lunes 16-11-2026, 09:00 en Madrid (UTC+1).
const LUNES = Date.parse("2026-11-16T08:00:00Z");
const MIERCOLES = Date.parse("2026-11-18T12:00:00Z");

describe("informeSemanal: la última semana entera", () => {
  const eventos = [
    ev("2026-11-10T10:00:00Z"), ev("2026-11-10T11:00:00Z"), ev("2026-11-12T09:00:00Z", "canjear"),
    ev("2026-11-11T09:00:00Z", "alta"),
    ev("2026-11-03T10:00:00Z"), ev("2026-11-04T10:00:00Z"),
  ];

  it("un lunes cuenta de lunes 9 a domingo 15", () => {
    const i = informeSemanal({ eventos, negocio, ahora: LUNES });
    expect(i.desde).toBe("2026-11-09");
    expect(i.hasta).toBe("2026-11-15");
    expect(i.etiqueta).toBe("9 al 15 nov");
    expect(i.visitas).toBe(3);
    expect(i.nuevos).toBe(1);
    expect(i.premios).toBe(1);
  });

  it("a mitad de semana enseña la misma semana", () => {
    const i = informeSemanal({ eventos, negocio, ahora: MIERCOLES });
    expect(i.desde).toBe("2026-11-09");
    expect(i.visitas).toBe(3);
  });

  it("trae las cifras de la semana anterior", () => {
    const i = informeSemanal({ eventos, negocio, ahora: LUNES });
    expect(i.visitasAntes).toBe(2);
    expect(i.nuevosAntes).toBe(0);
    expect(i.premiosAntes).toBe(0);
  });

  it("reparte las visitas por día y marca el mejor", () => {
    const i = informeSemanal({ eventos, negocio, ahora: LUNES });
    expect(i.porDia).toHaveLength(7);
    expect(i.porDia[1]).toMatchObject({ fecha: "2026-11-10", d: 1, n: 2, cerrado: false });
    expect(i.mejorDia).toEqual({ d: 1, n: 2 });
  });

  it("los días que la tienda no abre salen cerrados", () => {
    const i = informeSemanal({ eventos, negocio, ahora: LUNES });
    expect(i.porDia[5].cerrado).toBe(true);
    expect(i.porDia[6].cerrado).toBe(true);
  });

  it("sin horario ningún día sale cerrado", () => {
    const i = informeSemanal({ eventos, negocio: { slug: "cafe" }, ahora: LUNES });
    expect(i.porDia.every((d) => !d.cerrado)).toBe(true);
  });

  it("sin visitas no hay mejor día", () => {
    expect(informeSemanal({ eventos: [], negocio, ahora: LUNES }).mejorDia).toBeNull();
  });

  it("la zona de la tienda manda: las 23:30 UTC del domingo ya son lunes en Madrid", () => {
    const i = informeSemanal({ eventos: [ev("2026-11-08T23:30:00Z")], negocio, ahora: LUNES });
    expect(i.porDia[0].n).toBe(1);
    expect(i.visitas).toBe(1);
    // Es todo el historial de la tienda: no hay semana anterior con la que comparar.
    expect(i.visitasAntes).toBeNull();
  });

  it("una tienda sin ningún movimiento anterior a la semana no compara con una semana vacía", () => {
    const i = informeSemanal({ eventos: [ev("2026-11-10T10:00:00Z")], negocio, ahora: LUNES });
    expect([i.visitasAntes, i.nuevosAntes, i.premiosAntes]).toEqual([null, null, null]);
  });

  it("semanaDelInforme da el lunes y el domingo de la última semana entera, con la hora de la tienda", () => {
    expect(semanaDelInforme(negocio, LUNES)).toEqual({ desde: "2026-11-09", hasta: "2026-11-15" });
    // Domingo 23:30 UTC = lunes 00:30 en Madrid.
    expect(semanaDelInforme(negocio, Date.parse("2026-11-15T23:30:00Z"))).toEqual({ desde: "2026-11-09", hasta: "2026-11-15" });
    expect(semanaDelInforme(negocio, Date.parse("2026-11-15T12:00:00Z"))).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
  });

  it("una semana que cambia de mes lleva los dos meses en la etiqueta", () => {
    const i = informeSemanal({ eventos: [], negocio, ahora: Date.parse("2026-11-04T10:00:00Z") });
    expect(i.desde).toBe("2026-10-26");
    expect(i.etiqueta).toBe("26 oct al 1 nov");
  });

  it("si el historial no cubre la semana anterior, no compara", () => {
    const i = informeSemanal({ eventos, negocio, ahora: LUNES, historialDesde: Date.parse("2026-11-05T00:00:00Z") });
    expect(i.visitasAntes).toBeNull();
    expect(i.nuevosAntes).toBeNull();
    expect(i.premiosAntes).toBeNull();
    expect(i.visitas).toBe(3);
  });

  it("si el historial la cubre entera, sí compara", () => {
    const i = informeSemanal({ eventos, negocio, ahora: LUNES, historialDesde: Date.parse("2026-11-01T00:00:00Z") });
    expect(i.visitasAntes).toBe(2);
  });

  it("siete cafés seguidos de una tarjeta son una visita", () => {
    const mismos = Array.from({ length: 7 }, (_, k) => ({ ts: `2026-11-10T10:0${k}:00Z`, tipo: "sellar", serial: "x", actor: "caja", mensaje: "" }));
    expect(informeSemanal({ eventos: mismos, negocio, ahora: LUNES }).visitas).toBe(1);
  });
});

describe("textoComparado", () => {
  it("dice más, menos o igual", () => {
    expect(textoComparado(142, 130)).toBe("12 más que la anterior");
    expect(textoComparado(5, 13)).toBe("8 menos que la anterior");
    expect(textoComparado(5, 5)).toBe("igual que la anterior");
  });
  it("sin semana anterior no dice nada", () => {
    expect(textoComparado(5, null)).toBe("");
  });
});

describe("fraseDelInforme y lineasDelInforme", () => {
  const base = { visitas: 142, visitasAntes: 130, nuevos: 9, nuevosAntes: 7, premios: 6, premiosAntes: 6, mejorDia: { d: 4, n: 31 } };

  it("une las tres cifras en una frase", () => {
    expect(fraseDelInforme(base)).toBe("142 visitas (12 más que la anterior), 9 clientes nuevos y 6 premios dados.");
  });
  it("usa el singular con uno", () => {
    const f = fraseDelInforme({ ...base, visitas: 1, visitasAntes: null, nuevos: 1, premios: 1 });
    expect(f).toBe("1 visita, 1 cliente nuevo y 1 premio dado.");
  });
  it("con cero va en plural", () => {
    expect(fraseDelInforme({ ...base, visitasAntes: null, nuevos: 0, premios: 0 })).toBe("142 visitas, 0 clientes nuevos y 0 premios dados.");
  });
  it("el reverso lleva una línea por cifra y el mejor día", () => {
    expect(lineasDelInforme(base)).toEqual([
      "Visitas: 142 (12 más que la anterior)",
      "Clientes nuevos: 9 (2 más que la anterior)",
      "Premios dados: 6 (igual que la anterior)",
      "Mejor día: el viernes, con 31 visitas.",
    ]);
  });
  it("el reverso no inventa mejor día ni comparación", () => {
    const l = lineasDelInforme({ ...base, visitasAntes: null, nuevosAntes: null, premiosAntes: null, mejorDia: null });
    expect(l).toEqual(["Visitas: 142", "Clientes nuevos: 9", "Premios dados: 6"]);
  });
  it("el mejor día con una visita va en singular", () => {
    expect(lineasDelInforme({ ...base, mejorDia: { d: 2, n: 1 } }).at(-1)).toBe("Mejor día: el miércoles, con 1 visita.");
  });
});
