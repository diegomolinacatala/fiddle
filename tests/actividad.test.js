import { describe, it, expect } from "vitest";
import { actividadDelDia, ultimaVezTexto, diaCompleto } from "@/lib/actividad";
import { csvActividad } from "@/lib/exportar";
import { componerNegocio } from "@/lib/negocios";

const zona = "Europe/Madrid";
// Martes 7-10-2026, de 8:00 a 14:00 y de 17:00 a 20:00 (Madrid = UTC+2 en octubre).
const tramos = [{ abre: "08:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:00" }];
const horario = { zona, semana: [tramos, tramos, tramos, tramos, tramos, null, null] };

const ev = (ts, tipo, serial = "a", actor = "caja", mensaje = tipo) => ({ ts, tipo, serial, actor, mensaje });

describe("ultimaVezTexto: la hora, en la tienda", () => {
  const ahora = Date.parse("2026-10-08T10:00:00Z"); // 12:00 en Madrid
  it("hoy y ayer llevan la hora local", () => {
    expect(ultimaVezTexto("2026-10-08T07:42:00Z", zona, ahora)).toBe("hoy, 09:42");
    expect(ultimaVezTexto("2026-10-07T21:30:00Z", zona, ahora)).toBe("ayer, 23:30");
  });
  it("cuenta días de calendario de la tienda, no de UTC", () => {
    // 22:30 UTC del 7 = 00:30 del 8 en Madrid: es hoy, aunque en UTC fuera ayer.
    expect(ultimaVezTexto("2026-10-07T22:30:00Z", zona, ahora)).toBe("hoy, 00:30");
  });
  it("más atrás, como antes", () => {
    expect(ultimaVezTexto("2026-10-05T10:00:00Z", zona, ahora)).toBe("hace 3 días");
    expect(ultimaVezTexto(null, zona, ahora)).toBe("nunca");
  });
});

describe("actividadDelDia", () => {
  const eventos = [
    ev("2026-10-07T07:05:00Z", "sellar", "a"), // 09:05
    ev("2026-10-07T07:06:00Z", "sellar", "a"), // 09:06
    ev("2026-10-07T07:07:00Z", "restar", "a"), // corrección
    ev("2026-10-07T08:10:00Z", "sellar2", "b"), // segunda cartilla
    ev("2026-10-07T08:11:00Z", "canjear2", "b"),
    ev("2026-10-07T08:30:00Z", "guardar", "c"),
    ev("2026-10-07T13:00:00Z", "sellar", "d"), // 15:00: descanso de mediodía
    ev("2026-10-07T20:30:00Z", "alta", "e", "tap"), // 22:30, un cliente en su casa
    ev("2026-10-07T09:00:00Z", "instalado", "a", "apple"), // no es de la caja
    ev("2026-10-06T22:30:00Z", "sellar", "f"), // 00:30 del 7 en Madrid: cuenta
    ev("2026-10-07T22:30:00Z", "sellar", "g"), // 00:30 del 8: no
  ];
  const r = actividadDelDia(eventos, "2026-10-07", { zona, horario, cartillas: 2 });

  it("solo lo de la caja y las altas, de ese día en la tienda, en orden", () => {
    expect(r.filas.map((f) => f.serial)).toEqual(["f", "a", "a", "a", "b", "b", "c", "d", "e"]);
    expect(r.filas[0].hora).toBe("00:30");
  });

  it("cuenta por cartilla, con las correcciones aparte", () => {
    expect(r.totales.porCartilla[0]).toEqual({ sellos: 4, quitados: 1, premios: 0, guardados: 1 });
    expect(r.totales.porCartilla[1]).toEqual({ sellos: 1, quitados: 0, premios: 1, guardados: 0 });
    expect(r.totales.altas).toBe(1);
    expect(r.totales.atendidos).toBe(5); // f, a, b, c, d
  });

  it("marca lo del personal con la tienda cerrada, nunca un alta del cliente", () => {
    const fuera = r.filas.filter((f) => f.fueraDeHorario).map((f) => f.serial);
    expect(fuera).toEqual(["f", "d"]);
    expect(r.totales.fueraDeHorario).toBe(2);
  });

  it("sin horario no acusa a nadie", () => {
    const sin = actividadDelDia(eventos, "2026-10-07", { zona, horario: null, cartillas: 2 });
    expect(sin.totales.fueraDeHorario).toBe(0);
  });

  it("hora a hora", () => {
    const nueve = r.porHora.find((h) => h.hora === 9);
    expect(nueve).toEqual({ hora: 9, sellos: [2, 0], quitados: 1, premios: 0 });
    expect(r.porHora.find((h) => h.hora === 10).sellos).toEqual([0, 1]);
  });
});

describe("diaCompleto", () => {
  it("sin tope, todo vale; con tope, el día más viejo no", () => {
    expect(diaCompleto("2026-10-01", zona, null)).toBe(true);
    const desde = "2026-10-01T09:00:00Z";
    expect(diaCompleto("2026-10-01", zona, desde)).toBe(false);
    expect(diaCompleto("2026-10-02", zona, desde)).toBe(true);
  });
});

describe("csvActividad", () => {
  const deli = componerNegocio("delicanteria", {
    nombre: "La Delicantería", tipo: "sellos",
    config: { acciones: ["sellar", "canjear"], cartillas: [
      { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie" },
      { nombre: "Cafés", marca: "taza", meta: 8, premio: "café" },
    ] },
  });
  it("una fila por movimiento, con el código y SIN nombres", () => {
    const { filas } = actividadDelDia([ev("2026-10-07T08:10:00Z", "sellar2", "b", "caja", "Sello Cafés 3/8")], "2026-10-07", { zona, horario, cartillas: 2 });
    const csv = csvActividad({ fecha: "2026-10-07", filas, codigoDe: () => "K7M", negocio: deli });
    const lineas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lineas[0]).toBe("Fecha;Hora;Código;Qué;Cartilla;Detalle;Quién;Fuera de horario");
    expect(lineas[1]).toBe("2026-10-07;10:10;K7M;Sello;Cafés;Sello Cafés 3/8;Caja;");
  });
});
