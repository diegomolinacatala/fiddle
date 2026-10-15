import { describe, it, expect } from "vitest";
import {
  actividadDelDia, actividadDelRango, ultimaVezTexto, ultimoSelloTexto, TIPOS_SELLO, diaCompleto, atendidosHoy, horaDeHoyTexto,
  periodoDe, periodoDeFechas, moverPeriodo, periodoAnterior, comparable, nombrePeriodo, rangoCorto, textoComparacion,
} from "@/lib/actividad";
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

describe("ultimoSelloTexto: cuándo fue el último sello, para el mostrador", () => {
  const ahora = Date.parse("2026-10-08T10:00:00Z"); // 12:00 en Madrid
  const sello = (ts) => ({ tipo: "sellar", mensaje: "Punto 3/8", ts });
  it("los primeros minutos van al minuto: es lo que se discute", () => {
    expect(ultimoSelloTexto(sello("2026-10-08T09:59:40Z"), zona, ahora)).toBe("Último punto hace un momento");
    expect(ultimoSelloTexto(sello("2026-10-08T09:48:00Z"), zona, ahora)).toBe("Último punto hace 12 min");
  });
  it("más atrás, como la lista de clientes, con la hora de la tienda", () => {
    expect(ultimoSelloTexto(sello("2026-10-08T07:42:00Z"), zona, ahora)).toBe("Último punto hoy, 09:42");
    expect(ultimoSelloTexto(sello("2026-10-07T21:30:00Z"), zona, ahora)).toBe("Último punto ayer, 23:30");
    expect(ultimoSelloTexto(sello("2026-10-05T10:00:00Z"), zona, ahora)).toBe("Último punto hace 3 días");
  });
  it("sin sello nunca, nada que decir", () => {
    expect(ultimoSelloTexto(null, zona, ahora)).toBeNull();
    expect(ultimoSelloTexto({ tipo: "sellar", mensaje: "", ts: "no es fecha" }, zona, ahora)).toBeNull();
    expect(TIPOS_SELLO).toEqual(["sellar", "sellar2"]);
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

describe("actividadDelRango: varios días de golpe", () => {
  const eventos = [
    ev("2026-10-05T07:05:00Z", "sellar", "a"), // lunes 5, 09:05
    ev("2026-10-06T07:05:00Z", "sellar", "a"), // martes 6, 09:05
    ev("2026-10-06T08:05:00Z", "sellar2", "b"), // martes 6, 10:05
    ev("2026-10-06T16:05:00Z", "canjear", "b"), // martes 6, 18:05
    ev("2026-10-08T07:30:00Z", "alta", "c", "tap"), // jueves 8
    ev("2026-10-12T07:05:00Z", "sellar", "z"), // el lunes siguiente: fuera
  ];
  const r = actividadDelRango(eventos, "2026-10-05", "2026-10-11", { zona, horario, cartillas: 2 });

  it("suma el rango y cuenta a cada cliente una vez", () => {
    expect(r.totales.porCartilla[0]).toEqual({ sellos: 2, quitados: 0, premios: 1, guardados: 0 });
    expect(r.totales.porCartilla[1].sellos).toBe(1);
    expect(r.totales.atendidos).toBe(2); // a y b, aunque vinieran dos días
    expect(r.totales.altas).toBe(1);
    expect(r.filas.map((f) => f.fecha)).toEqual(["2026-10-05", "2026-10-06", "2026-10-06", "2026-10-06", "2026-10-08"]);
  });

  it("una fila por día, también los de cero y los cerrados", () => {
    expect(r.porDia.map((d) => d.fecha)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    const martes = r.porDia[1];
    expect(martes.porCartilla[0].sellos).toBe(1);
    expect(martes.porCartilla[1].sellos).toBe(1);
    expect(martes.atendidos).toBe(2);
    expect(r.porDia[2]).toMatchObject({ atendidos: 0, altas: 0, cerrado: false });
    expect(r.porDia[5].cerrado).toBe(true); // sábado
  });

  it("la hora a hora suma todos los días", () => {
    expect(r.porHora.find((h) => h.hora === 9).sellos).toEqual([2, 0]);
  });

  it("hastaMinutos corta el último día a esa hora", () => {
    const corto = actividadDelRango(eventos, "2026-10-05", "2026-10-06", { zona, horario, cartillas: 2, hastaMinutos: 11 * 60 });
    expect(corto.filas.map((f) => f.hora)).toEqual(["09:05", "09:05", "10:05"]); // el canje de las 18:05 aún no
  });

  it("un día suelto es lo mismo que actividadDelDia", () => {
    expect(actividadDelRango(eventos, "2026-10-06", "2026-10-06", { zona, horario, cartillas: 2 }).totales)
      .toEqual(actividadDelDia(eventos, "2026-10-06", { zona, horario, cartillas: 2 }).totales);
  });
});

describe("atendidosHoy: la lista de debajo del escáner", () => {
  const ahora = Date.parse("2026-10-15T12:00:00Z"); // 14:00 en Madrid
  const clientes = [
    { serial: "a", codigo: "AAA", nombre: "Ana", nota: "secreto" },
    { serial: "b", codigo: "BBB", nombre: null },
    { serial: "c", codigo: "CCC", nombre: "Carla" },
  ];
  const eventos = [
    ev("2026-10-15T07:00:00Z", "sellar", "a", "caja", "Punto Cafés 1/8"),
    ev("2026-10-15T11:50:00Z", "canjear2", "a", "caja", "Premio Cookies"), // lo último de Ana
    ev("2026-10-15T09:00:00Z", "sellar", "b", "manager", "Punto Cafés 3/8"), // el dueño también atiende
    ev("2026-10-15T11:55:00Z", "alta", "c", "tap"), // se dio de alta él: no es atendido
    ev("2026-10-15T11:58:00Z", "instalado", "c", "apple"),
    ev("2026-10-14T21:30:00Z", "sellar", "c", "caja"), // 23:30 de ayer en Madrid
    ev("2026-10-15T10:00:00Z", "sellar", "z", "caja"), // una tarjeta que ya no está (fusionada o borrada)
  ];
  const r = atendidosHoy(eventos, clientes, { zona, ahora });

  it("cada uno una vez, el último arriba, con lo último que se le hizo", () => {
    expect(r.total).toBe(2);
    expect(r.lista.map((c) => c.codigo)).toEqual(["AAA", "BBB"]);
    expect(r.lista[0]).toEqual({ serial: "a", codigo: "AAA", nombre: "Ana", ts: "2026-10-15T11:50:00Z", mensaje: "Premio Cookies" });
  });

  it("solo código, nombre y lo de hoy: nada más de la ficha", () => {
    expect(Object.keys(r.lista[0]).sort()).toEqual(["codigo", "mensaje", "nombre", "serial", "ts"]);
  });

  it("con tope, pero el total los cuenta a todos", () => {
    const corto = atendidosHoy(eventos, clientes, { zona, ahora, max: 1 });
    expect(corto.lista).toHaveLength(1);
    expect(corto.total).toBe(2);
  });

  it("la hora: al minuto la primera hora, luego la del reloj de la tienda", () => {
    expect(horaDeHoyTexto("2026-10-15T11:59:40Z", zona, ahora)).toBe("ahora");
    expect(horaDeHoyTexto("2026-10-15T11:48:00Z", zona, ahora)).toBe("hace 12 min");
    expect(horaDeHoyTexto("2026-10-15T07:00:00Z", zona, ahora)).toBe("09:00");
  });
});

describe("el periodo que se mira", () => {
  it("la semana va de lunes a domingo y el mes, del 1 al último", () => {
    expect(periodoDe("semana", "2026-10-15")).toEqual({ modo: "semana", desde: "2026-10-12", hasta: "2026-10-18" });
    expect(periodoDe("semana", "2026-10-18")).toEqual({ modo: "semana", desde: "2026-10-12", hasta: "2026-10-18" });
    expect(periodoDe("mes", "2026-02-10")).toEqual({ modo: "mes", desde: "2026-02-01", hasta: "2026-02-28" });
    expect(periodoDe("dia", "2026-10-15")).toEqual({ modo: "dia", desde: "2026-10-15", hasta: "2026-10-15" });
  });

  it("las flechas saltan un periodo entero", () => {
    expect(moverPeriodo(periodoDe("semana", "2026-10-15"), -1).desde).toBe("2026-10-05");
    expect(moverPeriodo(periodoDe("mes", "2026-03-31"), -1)).toEqual({ modo: "mes", desde: "2026-02-01", hasta: "2026-02-28" });
    expect(moverPeriodo(periodoDe("mes", "2026-12-05"), 1).desde).toBe("2027-01-01");
    expect(moverPeriodo(periodoDeFechas("2026-10-10", "2026-10-01"), -1)).toEqual({ modo: "fechas", desde: "2026-09-21", hasta: "2026-09-30" });
  });

  it("un periodo que no ha acabado se compara con los mismos días y hasta la misma hora", () => {
    const semana = periodoDe("semana", "2026-10-15"); // jueves
    expect(periodoAnterior(semana, "2026-10-15", 13 * 60)).toEqual({ modo: "semana", desde: "2026-10-05", hasta: "2026-10-08", hastaMinutos: 780 });
    const pasada = moverPeriodo(semana, -1);
    expect(periodoAnterior(pasada, "2026-10-15", 13 * 60)).toEqual({ modo: "semana", desde: "2026-09-28", hasta: "2026-10-04", hastaMinutos: null });
    // El 31 de octubre contra un septiembre de 30 días: septiembre entero.
    expect(periodoAnterior(periodoDe("mes", "2026-10-31"), "2026-10-31", 600)).toEqual({ modo: "mes", desde: "2026-09-01", hasta: "2026-09-30", hastaMinutos: null });
  });

  it("solo hay flechas si la tienda ya existía y ese periodo está entero en el panel", () => {
    const anterior = { desde: "2026-10-05", hasta: "2026-10-11" };
    const alta = (iso) => Date.parse(iso);
    expect(comparable(anterior, { zona, primeraAlta: alta("2026-09-30T10:00:00Z"), completoDesde: null })).toBe(true);
    expect(comparable(anterior, { zona, primeraAlta: alta("2026-10-06T10:00:00Z"), completoDesde: null })).toBe(false);
    expect(comparable(anterior, { zona, primeraAlta: alta("2026-09-30T10:00:00Z"), completoDesde: "2026-10-05T09:00:00Z" })).toBe(false);
    expect(comparable(anterior, { zona, primeraAlta: Infinity, completoDesde: null })).toBe(false); // sin clientes
  });

  it("los nombres", () => {
    const hoy = "2026-10-15";
    expect(nombrePeriodo(periodoDe("dia", hoy), hoy)).toBe("Hoy");
    expect(nombrePeriodo(periodoDe("dia", "2026-10-14"), hoy)).toBe("Ayer");
    expect(nombrePeriodo(periodoDe("semana", hoy), hoy)).toBe("Esta semana");
    expect(nombrePeriodo(periodoDe("semana", "2026-10-08"), hoy)).toBe("La semana pasada");
    expect(nombrePeriodo(periodoDe("semana", "2026-09-30"), hoy)).toBe("Semana del 28 de septiembre");
    expect(nombrePeriodo(periodoDe("mes", hoy), hoy)).toBe("Este mes");
    expect(nombrePeriodo(periodoDe("mes", "2026-09-10"), hoy)).toBe("Septiembre");
    expect(nombrePeriodo(periodoDe("mes", "2025-12-10"), hoy)).toBe("Diciembre de 2025");
    expect(nombrePeriodo(periodoDeFechas("2026-10-01", "2026-10-15"), hoy)).toBe("Del 1 al 15 de octubre");
    expect(nombrePeriodo(periodoDeFechas("2026-09-28", "2026-10-04"), hoy)).toBe("Del 28 de septiembre al 4 de octubre");
    expect(rangoCorto("2026-10-12", "2026-10-18")).toBe("12 – 18 oct");
    expect(rangoCorto("2026-09-28", "2026-10-04")).toBe("28 sept – 4 oct");
    const texto = (p, h = hoy) => textoComparacion(p, periodoAnterior(p, h, 600), h);
    expect(texto(periodoDe("semana", hoy))).toBe("los mismos días de la semana pasada");
    expect(texto(periodoDe("mes", "2026-09-10"))).toBe("el mes anterior");
    expect(texto(periodoDe("mes", hoy))).toBe("los mismos días del mes pasado");
    // El 31 de octubre ya no hay «mismos días» en septiembre: se dice que es entero.
    expect(texto(periodoDe("mes", "2026-10-31"), "2026-10-31")).toBe("el mes pasado entero");
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
    const { filas } = actividadDelDia([ev("2026-10-07T08:10:00Z", "sellar2", "b", "caja", "Punto Cafés 3/8")], "2026-10-07", { zona, horario, cartillas: 2 });
    const csv = csvActividad({ fecha: "2026-10-07", filas, codigoDe: () => "K7M", negocio: deli });
    const lineas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lineas[0]).toBe("Fecha;Hora;Código;Qué;Cartilla;Detalle;Quién;Fuera de horario");
    expect(lineas[1]).toBe("2026-10-07;10:10;K7M;Punto;Cafés;Punto Cafés 3/8;Caja;");
  });

  it("de varios días, cada fila lleva el suyo", () => {
    const { filas } = actividadDelRango([
      ev("2026-10-06T08:10:00Z", "sellar", "a"), ev("2026-10-07T08:10:00Z", "sellar", "b"),
    ], "2026-10-05", "2026-10-11", { zona, horario, cartillas: 2 });
    const csv = csvActividad({ fecha: "2026-10-05", filas, codigoDe: () => "K7M", negocio: deli });
    const lineas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lineas.slice(1).map((l) => l.split(";")[0])).toEqual(["2026-10-06", "2026-10-07"]);
  });
});
