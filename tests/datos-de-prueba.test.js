import { describe, it, expect, afterEach } from "vitest";
import { generar, semillaDe, PIN_DEV } from "@/lib/datosDePrueba";
import { tramosDe, relojLocal } from "@/lib/horario";
import { SEMILLAS } from "@/lib/negocios";
import { comprobarClave } from "@/lib/claves";
import { normalizarPlantilla } from "@/lib/plantilla";
import { perfilDe, puenteActivos, cohortes } from "@/lib/crm";

const ahora = Date.parse("2026-10-08T10:00:00Z");

describe("datos de prueba de dev", () => {
  afterEach(() => { delete process.env.DATOS_DE_PRUEBA; delete process.env.VERCEL_ENV; });

  it("solo con DATOS_DE_PRUEBA=1 y nunca en producción", () => {
    expect(semillaDe("clientes")).toBeUndefined();
    process.env.DATOS_DE_PRUEBA = "1";
    process.env.VERCEL_ENV = "production";
    expect(semillaDe("clientes")).toBeUndefined();
    process.env.VERCEL_ENV = "preview";
    expect(Object.keys(semillaDe("clientes")).length).toBeGreaterThan(20);
    expect(semillaDe("accesos")).toBeUndefined();
  });

  it("igual en cada arranque, con códigos únicos y nada en el futuro", () => {
    const a = generar(ahora);
    expect(generar(ahora)).toEqual(a);
    const codigos = Object.values(a.clientes).map((c) => c.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(a.eventos.every((e) => Date.parse(e.ts) <= ahora)).toBe(true);
  });

  it("toda la plantilla entra con el mismo PIN, con un hash fijo que vale en cualquier función de Vercel", async () => {
    const { plantilla } = generar(ahora).negocios.delicanteria.config;
    const leida = normalizarPlantilla(plantilla);
    expect(leida).toHaveLength(5);
    for (const e of leida) {
      expect(e.largoPin, e.nombre).toBe(PIN_DEV.length);
      expect(await comprobarClave(PIN_DEV, e.pin), e.nombre).toBe(true);
    }
    expect(await comprobarClave("0000", leida[0].pin)).toBe(false);
  });

  it("trae la plantilla y las dos últimas semanas llevan nombre; lo de antes, no", () => {
    const { negocios, eventos } = generar(ahora);
    const { plantilla } = negocios.delicanteria.config;
    expect(plantilla.map((e) => e.nombre)).toEqual(["Sebas", "Andreina", "Marta", "Jorge", "Lucía"]);
    // De partida viene apagada; en dev, encendida para poder verla.
    expect(negocios.delicanteria.config.plantillaActiva).toBe(true);
    expect(negocios.delicanteria.config.cartillas).toEqual(SEMILLAS.delicanteria.cartillas);
    const caja = eventos.filter((e) => e.actor === "caja");
    const hace15 = new Date(ahora - 15 * 864e5).toISOString();
    const hace13 = new Date(ahora - 13 * 864e5).toISOString();
    expect(caja.filter((e) => e.ts < hace15).every((e) => e.empleado === null)).toBe(true);
    const recientes = caja.filter((e) => e.ts > hace13);
    expect(recientes.length).toBeGreaterThan(50);
    expect(recientes.every((e) => plantilla.some((p) => p.id === e.empleado))).toBe(true);
    // Jorge corrige: al menos las tres de propósito.
    expect(eventos.filter((e) => e.empleado === "jorge001" && e.tipo.startsWith("restar")).length).toBeGreaterThanOrEqual(3);
    process.env.DATOS_DE_PRUEBA = "1";
    process.env.VERCEL_ENV = "preview";
    expect(semillaDe("negocios").delicanteria.config.plantilla).toHaveLength(5);
  });

  it("el Resumen tiene con qué: puente con altas, vueltas y bajas, y cohortes por semana", () => {
    const { clientes, eventos } = generar(ahora);
    const lista = Object.values(clientes);
    const tienda = SEMILLAS.delicanteria;
    const perfiles = lista.map((c) => perfilDe(c, tienda, ahora));
    const historialDesde = ahora - 120 * 864e5;
    const p = puenteActivos(lista, perfiles, eventos, tienda, { ahora, historialDesde });
    expect(p.listo).toBe(true);
    for (const k of ["antes", "nuevos", "volvieron", "enfriados"]) expect(p[k], k).toBeGreaterThan(0);
    const co = cohortes(lista, perfiles, eventos, { ahora, historialDesde, zona: tienda.horario.zona });
    expect(co).toMatchObject({ unidad: "semana", listo: true });
  });

  it("la caja trabaja en horario, salvo el sello de después de cerrar", () => {
    const { horario } = SEMILLAS.delicanteria;
    const fuera = generar(ahora).eventos.filter((e) => {
      if (e.actor !== "caja") return false;
      const { fecha, minutos } = relojLocal(Date.parse(e.ts), horario.zona);
      return !tramosDe(horario, fecha).some((t) => minutos >= t.abre && minutos < t.cierra + 1);
    });
    expect(fuera).toHaveLength(1);
  });
});
