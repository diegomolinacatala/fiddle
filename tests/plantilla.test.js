import { describe, it, expect } from "vitest";
import { sumarDias } from "@/lib/horario";
import { firmarTexto, verificarTexto } from "@/lib/auth";
import {
  normalizarPlantilla, nombreDeEmpleado, nuevoEmpleado, cambiarEmpleado, empleadosActivos, empleadoDe,
  valorQuien, quienDePayload, empleadoDeValor, huellaDePin, pinValido, ponerPin, plantillaPublica, hayQueElegir,
  autorDe, quienTexto, ventanaDe, cuentasDePlantilla, serieDiaria, observacionesPlantilla, resumenDeHoy, colorDe,
  movimientosDePlantilla,
} from "@/lib/plantilla";
import { csvRegistro } from "@/lib/exportar";

const zona = "Europe/Madrid";
// Semana del 5 al 10 de octubre de 2026 (lunes a sábado). Madrid = UTC+2.
const tramo = (abre, cierra) => [{ abre, cierra }];
const horario = {
  zona,
  semana: [tramo("07:30", "18:30"), tramo("07:30", "18:30"), tramo("07:30", "18:30"), tramo("07:30", "18:30"), tramo("07:30", "16:30"), tramo("08:30", "13:00"), null],
};
const plantilla = [
  { id: "sebas1", nombre: "Sebas", alta: "2026-09-01T08:00:00Z", baja: null },
  { id: "marta1", nombre: "Marta", alta: "2026-09-01T08:00:00Z", baja: null },
  { id: "luis01", nombre: "Luis", alta: "2026-08-01T08:00:00Z", baja: "2026-10-01T08:00:00Z" },
  { id: "lucia1", nombre: "Lucía", alta: "2026-10-09T08:00:00Z", baja: null },
];
// Hora LOCAL de Madrid: "2026-10-05 09:05" -> ISO en UTC.
const en = (local) => new Date(Date.parse(`${local.replace(" ", "T")}:00+02:00`)).toISOString();
const ev = (local, tipo, serial, { empleado = null, actor = "caja" } = {}) =>
  ({ ts: en(local), tipo, serial, actor, empleado, mensaje: tipo });

describe("la lista de la plantilla", () => {
  it("limpia nombres y quita lo que no vale", () => {
    expect(nombreDeEmpleado("  Sebas   García ")).toBe("Sebas García");
    expect(nombreDeEmpleado("")).toBeNull();
    expect(nombreDeEmpleado("x".repeat(31))).toBeNull();
    expect(nombreDeEmpleado(42)).toBeNull();
    const lista = normalizarPlantilla([
      { id: "sebas1", nombre: " Sebas ", alta: "2026-09-01T08:00:00Z" },
      { id: "sebas1", nombre: "Repetido" },
      { id: "MAL ID", nombre: "Nadie" },
      { id: "sinnombre", nombre: "" },
      { id: "marta1", nombre: "Marta", baja: "no es fecha" },
      null,
    ]);
    expect(lista).toEqual([
      { id: "sebas1", nombre: "Sebas", alta: "2026-09-01T08:00:00Z", baja: null, pin: null },
      { id: "marta1", nombre: "Marta", alta: null, baja: null, pin: null },
    ]);
    expect(normalizarPlantilla("nada")).toEqual([]);
    // Del PIN solo se guarda el hash; cualquier otra cosa es «sin PIN».
    const hash = "scrypt$00ff$abcdef0123456789";
    expect(normalizarPlantilla([{ id: "sebas1", nombre: "Sebas", pin: hash }, { id: "marta1", nombre: "Marta", pin: "1234" }]).map((e) => e.pin)).toEqual([hash, null]);
  });

  it("da de alta sin pisar la lista, sin nombres repetidos y con tope", () => {
    const r = nuevoEmpleado(plantilla, "Jorge", { ahora: Date.parse("2026-10-10T10:00:00Z"), id: "jorge1" });
    expect(r.empleado).toEqual({ id: "jorge1", nombre: "Jorge", alta: "2026-10-10T10:00:00.000Z", baja: null, pin: null });
    expect(r.plantilla).toHaveLength(5);
    expect(plantilla).toHaveLength(4);
    expect(nuevoEmpleado(plantilla, "sebas").error).toMatch(/Ya hay alguien/);
    // Un nombre de alguien dado de baja se puede reutilizar.
    expect(nuevoEmpleado(plantilla, "Luis", { id: "luis02" }).empleado.nombre).toBe("Luis");
    expect(nuevoEmpleado(plantilla, "   ").error).toMatch(/nombre/);
    const llena = Array.from({ length: 30 }, (_, i) => ({ id: `e${String(i).padStart(5, "0")}`, nombre: `P${i}`, alta: null, baja: null }));
    expect(nuevoEmpleado(llena, "Uno más").error).toMatch(/30/);
    // El id generado es corto y no choca con los que hay.
    expect(nuevoEmpleado(plantilla, "Ana").empleado.id).toMatch(/^[a-z0-9]{8}$/);
  });

  it("las bajas no se comen el sitio de las altas: el tope de 30 es de activos", () => {
    const bajas = Array.from({ length: 40 }, (_, i) => ({ id: `b${String(i).padStart(5, "0")}`, nombre: `B${i}`, alta: null, baja: "2026-01-01T00:00:00Z" }));
    const r = nuevoEmpleado([...bajas, plantilla[0]], "Nuevo", { id: "nuevo001" });
    expect(r.error).toBeUndefined();
    // Y al releer (componerNegocio normaliza) sigue estando: 41 bajas no recortan al nuevo.
    const leida = normalizarPlantilla(r.plantilla);
    expect(leida).toHaveLength(42);
    expect(leida.find((e) => e.id === "nuevo001")?.nombre).toBe("Nuevo");
    // El activo número 31 sí se cae; la lista entera, a 200.
    const activos = Array.from({ length: 31 }, (_, i) => ({ id: `a${String(i).padStart(5, "0")}`, nombre: `A${i}`, alta: null, baja: null }));
    expect(empleadosActivos(normalizarPlantilla(activos))).toHaveLength(30);
    const muchas = Array.from({ length: 205 }, (_, i) => ({ id: `m${String(i).padStart(5, "0")}`, nombre: `M${i}`, alta: null, baja: "2026-01-01T00:00:00Z" }));
    expect(normalizarPlantilla(muchas)).toHaveLength(200);
    expect(nuevoEmpleado(normalizarPlantilla(muchas), "Otro").error).toMatch(/200/);
  });

  it("volver a dar de alta no deja dos nombres iguales en la caja", () => {
    const conOtroLuis = [...plantilla, { id: "luis02", nombre: "luis", alta: null, baja: null }];
    expect(cambiarEmpleado(conOtroLuis, "luis01", { activo: true }).error).toMatch(/Ya hay alguien/);
    expect(cambiarEmpleado(conOtroLuis, "luis01", { activo: true, nombre: "Luis M." }).empleado).toMatchObject({ nombre: "Luis M.", baja: null });
  });

  it("renombra, da de baja y vuelve a dar de alta sin perder el id", () => {
    const ahora = Date.parse("2026-10-10T10:00:00Z");
    const baja = cambiarEmpleado(plantilla, "sebas1", { activo: false }, { ahora });
    expect(baja.empleado.baja).toBe("2026-10-10T10:00:00.000Z");
    expect(empleadosActivos(baja.plantilla).map((e) => e.id)).toEqual(["marta1", "lucia1"]);
    const vuelve = cambiarEmpleado(baja.plantilla, "sebas1", { activo: true, nombre: "Sebastián" });
    expect(vuelve.empleado).toMatchObject({ id: "sebas1", nombre: "Sebastián", baja: null });
    expect(cambiarEmpleado(plantilla, "nadie", { nombre: "X" }).error).toMatch(/no está/);
    expect(cambiarEmpleado(plantilla, "sebas1", { nombre: "marta" }).error).toMatch(/Ya hay alguien/);
    expect(cambiarEmpleado(plantilla, "sebas1", { nombre: "" }).error).toMatch(/nombre/);
    expect(empleadoDe(plantilla, "luis01").baja).toBeTruthy();
  });
});

describe("la cookie de quién atiende y el PIN", () => {
  const hash = "scrypt$00ff$abcdef0123456789abcdef";
  const conPin = plantilla.map((e) => (e.id === "sebas1" ? { ...e, pin: hash } : e));

  it("el texto firmado lleva la tienda, el id y la huella del PIN, y solo vale con el PIN de ahora", () => {
    const payload = valorQuien("delicanteria", "sebas1", huellaDePin(hash));
    expect(payload).toBe(`delicanteria.sebas1.${hash.slice(-12)}`);
    expect(quienDePayload(payload, "delicanteria", conPin)?.nombre).toBe("Sebas");
    expect(quienDePayload(payload, "nube", conPin)).toBeNull();
    expect(quienDePayload(valorQuien("delicanteria", "sebas1", "otrahuella1"), "delicanteria", conPin)).toBeNull(); // le quitaron el PIN
    expect(quienDePayload(valorQuien("delicanteria", "marta1", huellaDePin(null)), "delicanteria", conPin)).toBeNull(); // sin PIN no hay cookie que valga
    expect(quienDePayload(valorQuien("delicanteria", "luis01", "sin"), "delicanteria", conPin)).toBeNull(); // de baja
    expect(quienDePayload(undefined, "delicanteria", conPin)).toBeNull();
    expect(quienDePayload("sebas1", "delicanteria", conPin)).toBeNull();
  });

  it("«la última vez» va sin firmar y solo propone a alguien de alta", () => {
    expect(empleadoDeValor("delicanteria.sebas1", "delicanteria", plantilla)?.nombre).toBe("Sebas");
    expect(empleadoDeValor("delicanteria.luis01", "delicanteria", plantilla)).toBeNull();
    expect(empleadoDeValor("nube.sebas1", "delicanteria", plantilla)).toBeNull();
    expect(empleadoDeValor(undefined, "delicanteria", plantilla)).toBeNull();
  });

  it("firmar y verificar un texto: caduca y no se puede tocar", async () => {
    const ahora = Date.parse("2026-10-10T10:00:00Z");
    const token = await firmarTexto("delicanteria.sebas1.abc", ahora + 1000);
    expect(await verificarTexto(token, ahora)).toBe("delicanteria.sebas1.abc");
    expect(await verificarTexto(token, ahora + 2000)).toBeNull();
    expect(await verificarTexto(`${token}x`, ahora)).toBeNull();
    expect(await verificarTexto(token.replace("sebas1", "marta1"), ahora)).toBeNull();
    expect(await verificarTexto("nada", ahora)).toBeNull();
    expect(await verificarTexto(undefined, ahora)).toBeNull();
  });

  it("el PIN: de 4 a 6 cifras, no todas iguales; se pone una vez y el manager lo quita", () => {
    expect(pinValido("2468")).toBe("2468");
    expect(pinValido(" 123456 ")).toBe("123456");
    expect(pinValido("123")).toBeNull();
    expect(pinValido("1234567")).toBeNull();
    expect(pinValido("1111")).toBeNull();
    expect(pinValido("12a4")).toBeNull();
    expect(pinValido(null)).toBeNull();
    const puesto = ponerPin(plantilla, "marta1", hash);
    expect(puesto.empleado.pin).toBe(hash);
    expect(ponerPin(puesto.plantilla, "marta1", hash).error).toMatch(/Ya tiene PIN/);
    expect(ponerPin(plantilla, "luis01", hash).error).toMatch(/no está/);
    expect(ponerPin(plantilla, "marta1", "1234").error).toMatch(/no válido/);
    const quitado = cambiarEmpleado(puesto.plantilla, "marta1", { quitarPin: true });
    expect(quitado.empleado.pin).toBeNull();
    // Hacia el navegador nunca va el hash, solo si lo tiene.
    expect(plantillaPublica(puesto.plantilla).find((e) => e.id === "marta1")).toEqual({ id: "marta1", nombre: "Marta", alta: "2026-09-01T08:00:00Z", baja: null, tienePin: true });
    expect(JSON.stringify(plantillaPublica(puesto.plantilla))).not.toContain("scrypt");
  });

  it("solo la caja elige, y solo con gente dada de alta", () => {
    expect(hayQueElegir({ rol: "caja" }, plantilla)).toBe(true);
    expect(hayQueElegir({ rol: "manager" }, plantilla)).toBe(false);
    expect(hayQueElegir({ rol: "admin" }, plantilla)).toBe(false);
    expect(hayQueElegir({ rol: "caja" }, [plantilla[2]])).toBe(false);
    expect(hayQueElegir({ rol: "caja" }, [])).toBe(false);
    expect(hayQueElegir(null, plantilla)).toBe(false);
  });
});

describe("quién hizo cada movimiento", () => {
  it("el empleado manda sobre el actor; el dueño y la caja sin nombre tienen su clave", () => {
    expect(autorDe({ actor: "caja", empleado: "sebas1" })).toBe("e:sebas1");
    expect(autorDe({ actor: "manager", empleado: null })).toBe("dueno");
    expect(autorDe({ actor: "caja" })).toBe("caja");
    expect(autorDe({ actor: "admin" })).toBe("admin");
    expect(autorDe({ actor: "apple" })).toBeNull();
    expect(autorDe({ actor: "tap" })).toBeNull();
  });
  it("y su nombre para las pantallas", () => {
    expect(quienTexto({ actor: "caja", empleado: "sebas1" }, plantilla)).toBe("Sebas");
    expect(quienTexto({ actor: "caja", empleado: "luis01" }, plantilla)).toBe("Luis");
    expect(quienTexto({ actor: "caja", empleado: "borrado" }, plantilla)).toBe("Empleado");
    expect(quienTexto({ actor: "caja" }, plantilla)).toBe("Caja");
    expect(quienTexto({ actor: "manager" }, plantilla)).toBe("Dueño");
    expect(quienTexto({ actor: "admin" }, plantilla)).toBe("Fiddle");
    expect(quienTexto({ actor: "tap" }, plantilla)).toBe("El cliente");
    expect(quienTexto({ actor: null }, plantilla)).toBe("");
  });
});

describe("cuentas por persona", () => {
  const eventos = [
    ev("2026-10-05 09:05", "sellar", "s1", { empleado: "sebas1" }),
    ev("2026-10-05 09:06", "sellar", "s1", { empleado: "sebas1" }),
    ev("2026-10-05 09:40", "sellar2", "s2", { empleado: "sebas1" }),
    ev("2026-10-05 10:15", "canjear", "s2", { empleado: "sebas1" }),
    ev("2026-10-05 12:30", "sellar", "s3", { empleado: "sebas1" }),
    ev("2026-10-05 11:00", "sellar", "s11", { empleado: "luis01" }), // dado de baja, pero selló
    ev("2026-10-05 17:10", "sellar", "s4", { empleado: "marta1" }),
    ev("2026-10-05 17:12", "restar", "s4", { empleado: "marta1" }),
    ev("2026-10-05 17:50", "sellar", "s5", { empleado: "marta1" }),
    ev("2026-10-06 08:10", "sellar", "s6", { empleado: "sebas1" }), // estreno: s6 se dio de alta esa mañana
    ev("2026-10-06 11:00", "sellar", "s7"), // la caja sin nombre
    ev("2026-10-07 10:00", "sellar", "s8", { actor: "manager" }), // el dueño
    ev("2026-10-10 09:00", "sellar", "s9", { empleado: "marta1" }),
    ev("2026-10-10 21:00", "sellar", "s10", { empleado: "marta1" }), // sábado por la noche: cerrado
    ev("2026-10-06 09:00", "instalado", "s1", { actor: "apple" }), // no es de la caja
    ev("2026-10-06 09:00", "alta", "s6", { actor: "tap" }), // tampoco
    ev("2026-09-20 10:00", "sellar", "s1", { empleado: "sebas1" }), // fuera del periodo
  ];
  const ahora = Date.parse("2026-10-10T20:00:00Z"); // sábado, 22:00 en Madrid
  const { desde, hasta } = ventanaDe(7, ahora, zona);
  const clientes = [{ serial: "s6", creado: en("2026-10-06 08:08") }, { serial: "s1", creado: "2026-09-01T10:00:00Z" }];
  const c = cuentasDePlantilla(eventos, { plantilla, zona, horario, desde, hasta, clientes });
  const fila = (clave) => c.filas.find((f) => f.clave === clave);

  it("el periodo va de medianoche de la tienda a ahora", () => {
    expect(new Date(desde).toISOString()).toBe("2026-10-03T22:00:00.000Z"); // 00:00 del 4 en Madrid
    expect(hasta).toBe(ahora);
  });

  it("suma sellos, premios, correcciones, clientes, días y horas de caja", () => {
    expect(fila("e:sebas1")).toMatchObject({
      nombre: "Sebas", activo: true, persona: true,
      sellos: 5, premios: 1, quitados: 0, movimientos: 6, clientes: 4, dias: 2, horas: 4, fuera: 0, estrenos: 1,
    });
    expect(fila("e:sebas1").sellosPorHora).toBeCloseTo(1.25);
    expect(fila("e:marta1")).toMatchObject({ sellos: 4, quitados: 1, clientes: 4, dias: 2, fuera: 1, estrenos: 0 });
    expect(fila("e:luis01")).toMatchObject({ nombre: "Luis", activo: false, sellos: 1 });
    expect(fila("dueno")).toMatchObject({ nombre: "Dueño", persona: true, sellos: 1 });
    expect(fila("caja")).toMatchObject({ nombre: "Sin nombre", persona: false, sellos: 1 });
    // Lucía está de alta y no ha hecho nada: sale a cero. Lo de fuera del periodo no cuenta.
    expect(fila("e:lucia1")).toMatchObject({ sellos: 0, movimientos: 0, horas: 0, sellosPorHora: null });
  });

  it("la jornada de cada día: del primer al último movimiento", () => {
    expect(fila("e:sebas1").jornadas).toEqual([
      expect.objectContaining({ fecha: "2026-10-06", primero: "08:10", ultimo: "08:10", sellos: 1 }),
      expect.objectContaining({ fecha: "2026-10-05", primero: "09:05", ultimo: "12:30", sellos: 4, premios: 1 }),
    ]);
    expect(fila("e:sebas1").rejilla[0][9]).toBe(3); // lunes de 9 a 10: tres movimientos
    expect(fila("e:sebas1").primeraVez).toBe(en("2026-10-05 09:05"));
    expect(fila("e:sebas1").ultimaVez).toBe(en("2026-10-06 08:10"));
  });

  it("el equipo y la media, solo de las personas que trabajaron", () => {
    expect(c.equipo).toMatchObject({ sellos: 12, quitados: 1, premios: 1, movimientos: 14, sinNombre: 1, fuera: 1, estrenos: 1, personas: 4 });
    expect(c.equipo.clientes).toBe(11);
    expect(c.media.sellos).toBeCloseTo(11 / 4); // Sebas 5, Marta 4, Luis 1, Dueño 1
    expect(c.media.tasaCorreccion).toBeCloseTo(1 / 11);
    expect(c.filas.map((f) => f.clave)).toEqual(["e:sebas1", "e:marta1", "dueno", "e:luis01", "caja", "e:lucia1"]);
  });

  it("el ritmo esperado compara con el equipo en los mismos días y tramos", () => {
    // Lunes por la mañana solo trabaja Sebas (y Luis una hora): lo esperado se parece a lo suyo.
    expect(fila("e:sebas1").esperado).toBeGreaterThan(0);
    expect(fila("e:marta1").esperado).toBeGreaterThan(0);
  });

  it("sin plantilla ni horario sigue contando (nada es 'fuera')", () => {
    const r = cuentasDePlantilla(eventos, { zona });
    expect(r.filas.find((f) => f.clave === "e:sebas1")).toMatchObject({ nombre: "Empleado", sellos: 6, fuera: 0 });
    expect(r.filas.find((f) => f.clave === "e:marta1").fuera).toBe(0);
    expect(cuentasDePlantilla([], { plantilla, zona }).media).toBeNull();
  });

  it("un id que ya no está en la lista cuenta como baja, y el admin no es del equipo", () => {
    const sueltos = [
      ev("2026-10-05 09:05", "sellar", "s1", { empleado: "borrado1" }),
      ev("2026-10-05 10:05", "sellar", "s2", { actor: "admin" }),
      ev("2026-10-05 11:05", "sellar", "s3", { empleado: "sebas1" }),
    ];
    const r = cuentasDePlantilla(sueltos, { plantilla, zona, desde, hasta });
    expect(r.filas.find((f) => f.clave === "e:borrado1")).toMatchObject({ nombre: "Empleado", activo: false, persona: true, sellos: 1 });
    expect(r.filas.find((f) => f.clave === "admin")).toMatchObject({ nombre: "Fiddle", persona: false, sellos: 1 });
    // La media es de las personas: Sebas y el huérfano, no Fiddle.
    expect(r.equipo.personas).toBe(2);
    expect(r.media.sellos).toBe(1);
  });

  it("la serie diaria reparte los sellos de cada día por persona", () => {
    const serie = serieDiaria(eventos, { zona, dias: 7, ahora });
    expect(serie).toHaveLength(7);
    expect(serie[0].dia).toBe("2026-10-04");
    expect(serie[1]).toEqual({ dia: "2026-10-05", total: 7, por: { "e:sebas1": 4, "e:luis01": 1, "e:marta1": 2 } });
    expect(serie[6]).toEqual({ dia: "2026-10-10", total: 2, por: { "e:marta1": 2 } });
  });

  it("el resumen de hoy en la caja: solo lo de esa persona y de hoy", () => {
    expect(resumenDeHoy(eventos, { id: "marta1", zona, ahora })).toEqual({ sellos: 2, quitados: 0, premios: 0, clientes: 2 });
    expect(resumenDeHoy(eventos, { id: "sebas1", zona, ahora })).toEqual({ sellos: 0, quitados: 0, premios: 0, clientes: 0 });
  });

  it("el registro: cada movimiento con su hora, quién y si fue con la tienda cerrada", () => {
    const m = movimientosDePlantilla(eventos, { plantilla, zona, horario, desde, hasta });
    expect(m).toHaveLength(14);
    expect(m[0]).toMatchObject({ fecha: "2026-10-10", hora: "21:00", quien: "Marta", clase: "sello", fueraDeHorario: true });
    expect(m.at(-1)).toMatchObject({ fecha: "2026-10-05", hora: "09:05", quien: "Sebas", fueraDeHorario: false });
    expect(m.find((x) => x.serial === "s7").quien).toBe("Sin nombre"); // en el registro, como en las cuentas
    expect(m.find((x) => x.serial === "s8").quien).toBe("Dueño");
    const lineas = csvRegistro({ filas: m, codigoDe: (s) => s.toUpperCase() }).split("\r\n");
    expect(lineas[0]).toBe("﻿Fecha;Hora;Código;Qué;Detalle;Quién;Fuera de horario");
    expect(lineas[1]).toBe("2026-10-10;21:00;S10;Sello;sellar;Marta;Sí");
  });

  it("cada persona tiene su color, estable", () => {
    expect(colorDe(0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorDe(0)).not.toBe(colorDe(1));
    expect(colorDe(9)).toBe(colorDe(0));
  });
});

describe("conclusiones", () => {
  // Cuatro semanas: Sebas y Marta en las mismas mañanas; Sebas da el triple.
  // Jorge corrige mucho; Marta cubre sola los sábados; dos sellos sin nombre.
  function semanas() {
    const out = [];
    let n = 0;
    const serial = () => `c${n += 1}`;
    for (let s = 0; s < 4; s += 1) {
      for (let d = 0; d < 5; d += 1) {
        const fecha = sumarDias("2026-09-14", s * 7 + d); // lunes 14 de septiembre
        for (let h = 9; h < 11; h += 1) {
          for (let k = 0; k < 3; k += 1) out.push(ev(`${fecha} ${String(h).padStart(2, "0")}:${10 + k * 5}`, "sellar", serial(), { empleado: "sebas1" }));
          out.push(ev(`${fecha} ${String(h).padStart(2, "0")}:40`, "sellar", serial(), { empleado: "marta1" }));
        }
        if (d < 2) {
          out.push(ev(`${fecha} 16:10`, "sellar", "j1", { empleado: "jorge1" }));
          out.push(ev(`${fecha} 16:11`, "restar", "j1", { empleado: "jorge1" }));
          out.push(ev(`${fecha} 16:30`, "sellar", serial(), { empleado: "jorge1" }));
        }
      }
      const sabado = sumarDias("2026-09-19", s * 7);
      for (let k = 0; k < 4; k += 1) out.push(ev(`${sabado} 10:${10 + k * 10}`, "sellar", serial(), { empleado: "marta1" }));
    }
    out.push(ev("2026-10-01 10:00", "sellar", "x1"));
    out.push(ev("2026-10-01 10:05", "sellar", "x2"));
    return out;
  }
  const equipo = [...plantilla, { id: "jorge1", nombre: "Jorge", alta: "2026-09-01T08:00:00Z", baja: null }];
  const ahora = Date.parse("2026-10-10T12:00:00Z");
  const { desde, hasta } = ventanaDe(30, ahora, zona);
  const c = cuentasDePlantilla(semanas(), { plantilla: equipo, zona, horario, desde, hasta });
  const ideas = observacionesPlantilla(c, { dias: 30 });
  const idea = (prefijo) => ideas.find((o) => o.id.startsWith(prefijo));

  it("quién va por encima y por debajo de lo normal en sus franjas", () => {
    expect(idea("ritmo-alto-e:sebas1")).toMatchObject({ tono: "bien" });
    expect(idea("ritmo-alto-e:sebas1").texto).toMatch(/^Sebas da 3 sellos por hora de caja; en sus franjas lo normal son 2/);
    expect(idea("ritmo-bajo-e:marta1")).toMatchObject({ tono: "ojo" });
    expect(idea("ritmo-bajo-e:marta1").texto).toMatch(/^Marta da 1,[0-9] sellos por hora de caja/);
    expect(idea("ritmo-")?.detalle).toMatch(/mismos días y tramos/);
  });

  it("quién corrige más de la cuenta", () => {
    expect(idea("correcciones-e:jorge1")).toMatchObject({ tono: "ojo" });
    expect(idea("correcciones-e:jorge1").texto).toBe("Jorge quita 1 de cada 2 sellos que da; el resto del equipo, ninguno.");
    expect(idea("correcciones-e:sebas1")).toBeUndefined();
  });

  it("quién cubre una franja en solitario", () => {
    expect(idea("solo-e:marta1").texto).toBe("Marta cubre en solitario las mañanas de los sábados.");
    expect(idea("solo-e:sebas1")).toBeUndefined(); // las mañanas entre semana las comparte
  });

  it("los movimientos sin nombre y la carga del equipo", () => {
    expect(idea("sin-nombre").texto).toBe("2 movimientos sin nombre: se selló sin elegir quién atendía.");
    expect(idea("carga-e:sebas1").texto).toMatch(/^Sebas da el 6\d % de los sellos del equipo\.$/);
    expect(idea("fuera-")).toBeUndefined();
  });

  it("con pocos movimientos no se concluye nada", () => {
    const pocas = cuentasDePlantilla(semanas().slice(0, 10), { plantilla: equipo, zona, horario, desde, hasta });
    expect(observacionesPlantilla(pocas, { dias: 30 })).toEqual([expect.objectContaining({ id: "pocos" })]);
  });

  it("una tienda sin plantilla (todo sin nombre, con estrenos) no revienta: solo dice que falta el equipo", () => {
    const sinNombre = semanas().map((e) => ({ ...e, empleado: null }));
    const clientes = [...new Set(sinNombre.map((e) => e.serial))].map((serial) => ({ serial, creado: "2026-09-20T06:00:00Z" }));
    const cc = cuentasDePlantilla(sinNombre, { plantilla: [], zona, horario, desde, hasta, clientes });
    expect(cc.equipo.estrenos).toBeGreaterThanOrEqual(5);
    expect(cc.equipo.movimientos).toBeGreaterThan(20);
    expect(observacionesPlantilla(cc, { dias: 30 })).toEqual([expect.objectContaining({ id: "sin-personas", tono: "dato" })]);
  });

  it("con una sola persona nadie «cubre en solitario» nada", () => {
    const sola = semanas().filter((e) => e.empleado === "marta1");
    const cc = cuentasDePlantilla(sola, { plantilla: equipo, zona, horario, desde, hasta });
    expect(observacionesPlantilla(cc, { dias: 30 }).some((o) => o.id.startsWith("solo-"))).toBe(false);
  });

  it("y avisa de los movimientos con la tienda cerrada", () => {
    const conFuera = [...semanas(), ev("2026-10-03 20:00", "sellar", "z1", { empleado: "jorge1" }), ev("2026-10-03 20:05", "sellar", "z2", { empleado: "jorge1" })];
    const cc = cuentasDePlantilla(conFuera, { plantilla: equipo, zona, horario, desde, hasta });
    const o = observacionesPlantilla(cc, { dias: 30 }).find((x) => x.id === "fuera-e:jorge1");
    expect(o.texto).toBe("2 movimientos de Jorge con la tienda cerrada, según el horario.");
  });
});
