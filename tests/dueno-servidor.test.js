import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ============================================================================
// LA TARJETA DEL DUEÑO: lo que hace el servidor (reloj, estado vigente, avisos)
// ----------------------------------------------------------------------------
// Store de ficheros en un directorio temporal. Se simulan lo que lee la base
// (historial del CRM, observaciones) y APNs.
// ============================================================================

const PASS_TYPE = "pass.com.fiddle.general";
const TOKEN_PUSH = "ab".repeat(16);
const enviarAvisos = vi.fn();
const datosCrm = vi.fn();
const ideas = { lista: [] };

vi.mock("@/lib/apple/apns", () => ({ enviarAvisos: (...a) => enviarAvisos(...a) }));
vi.mock("@/lib/crmDatos", () => ({ datosCrm: (...a) => datosCrm(...a) }));
vi.mock("@/lib/observaciones", async (original) => ({
  ...(await original()),
  observaciones: () => ideas.lista,
  suficiencia: () => ({ hay: true }),
}));
vi.mock("@/lib/apple/config", async (original) => ({
  ...(await original()),
  configApple: () => ({ passTypeId: PASS_TYPE, teamId: "TEAM", cert: "c", key: "k", wwdr: "w", tienda: null }),
}));

const store = await import("@/lib/store");
const tarjeta = await import("@/lib/dueno/tarjeta");
const { repasarTarjetaDueno, estadoVigente, avisarDueno } = await import("@/lib/dueno/servidor");

const LUNES = Date.parse("2026-11-16T10:00:00+01:00");
const MARTES = Date.parse("2026-11-17T10:00:00+01:00");
const OTRO_LUNES = Date.parse("2026-11-23T10:00:00+01:00");
const idea = (id) => ({ id, texto: `Idea ${id}.`, accion: { tipo: "grupo", grupo: "dormidos", label: "Avisar" } });
const iphone = (id = "iphone1", token = TOKEN_PUSH) => ({ id, token, tipo: PASS_TYPE, alta: "2026-11-01T00:00:00.000Z" });

let dir;
const leer = async () => tarjeta.tarjetaDe(await store.getNegocio("nube"));
const repasar = async (ahora) => repasarTarjetaDueno(await store.getNegocio("nube"), ahora);

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-dueno-servidor-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  enviarAvisos.mockReset();
  enviarAvisos.mockImplementation(async (tokens) => ({ enviados: tokens.length, invalidos: [], errores: [] }));
  datosCrm.mockReset();
  datosCrm.mockResolvedValue({ eventos: [], metricas: {}, grupos: [], historialCompletoDesde: "2026-07-01T00:00:00.000Z" });
  ideas.lista = [];
  await tarjeta.guardarTarjeta("nube", { ...tarjeta.nuevaTarjeta("nube"), dispositivos: [iphone()] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("repasarTarjetaDueno: el reloj", () => {
  it("no repasa dos veces el mismo día", async () => {
    await repasar(LUNES);
    await repasar(LUNES + 3_600_000);
    expect(datosCrm).toHaveBeenCalledTimes(1);
  });

  it("el lunes cambia la clave y empuja UNA vez aunque el reloj pase cuatro veces", async () => {
    await repasar(MARTES);
    enviarAvisos.mockClear();
    const r = await repasar(OTRO_LUNES);
    for (const minutos of [15, 30, 45]) await repasar(OTRO_LUNES + minutos * 60_000);
    expect(r.cambio).toBe(true);
    expect(enviarAvisos).toHaveBeenCalledTimes(1);
  });

  it("sin iPhones registrados no calcula nada", async () => {
    await tarjeta.guardarTarjeta("nube", { dispositivos: [] });
    expect(await repasar(LUNES)).toEqual({ ok: true, cambio: false });
    expect(datosCrm).not.toHaveBeenCalled();
  });

  it("si no se pueden leer los datos devuelve ok: false y no lanza", async () => {
    datosCrm.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await repasar(LUNES)).toEqual({ ok: false, cambio: false });
  });
});

describe("repasarTarjetaDueno: los avisos", () => {
  it("un aviso ya dicho no se repite en las dos semanas siguientes", async () => {
    ideas.lista = [idea("uno")];
    await repasar(LUNES);
    expect((await leer()).avisados).toEqual({ uno: "2026-11-16" });
    await repasar(OTRO_LUNES);
    expect((await leer()).estado.aviso).toBeNull();
  });

  it("no pasan de dos a la semana", async () => {
    ideas.lista = [idea("uno")];
    await repasar(LUNES);
    ideas.lista = [idea("dos")];
    await repasar(MARTES);
    ideas.lista = [idea("tres")];
    await repasar(Date.parse("2026-11-18T10:00:00+01:00"));
    const guardada = await leer();
    expect(Object.keys(guardada.avisados).sort()).toEqual(["dos", "uno"]);
    expect(guardada.estado.aviso).toBeNull();
  });
});

describe("repasarTarjetaDueno: la prueba", () => {
  const conPrueba = (hasta) => tarjeta.guardarTarjeta("nube", { prueba: { texto: "Prueba", hasta: new Date(hasta).toISOString() } });

  it("una prueba vencida se quita, se sube `actualizado` y se empuja", async () => {
    await conPrueba(LUNES - 60_000);
    // Hoy ya está repasado: lo único que toca es quitar la prueba.
    await tarjeta.guardarTarjeta("nube", { estado: { fecha: "2026-11-16", informe: { desde: "2026-11-09" }, aviso: null } });
    const r = await repasar(LUNES);
    const guardada = await leer();
    expect(r.cambio).toBe(true);
    expect(guardada.prueba).toBeNull();
    expect(guardada.actualizado).toBe(new Date(LUNES).toISOString());
    expect(enviarAvisos).toHaveBeenCalledTimes(1);
  });

  it("una prueba vigente se deja como está", async () => {
    await conPrueba(LUNES + 60_000);
    await repasar(LUNES);
    expect((await leer()).prueba).not.toBeNull();
  });

  it("si además toca repasar, empuja una sola vez", async () => {
    await conPrueba(LUNES - 60_000);
    await repasar(LUNES);
    expect(enviarAvisos).toHaveBeenCalledTimes(1);
  });
});

describe("estadoVigente", () => {
  it("ignora un estado guardado de otra semana y calcula el de hoy", async () => {
    const viejo = { fecha: "2026-11-09", informe: { desde: "2026-11-02", hasta: "2026-11-08", visitas: 999 }, aviso: null };
    await tarjeta.guardarTarjeta("nube", { estado: viejo });
    const { informe } = await estadoVigente(await store.getNegocio("nube"), LUNES);
    expect(informe.desde).toBe("2026-11-09");
    expect(informe.visitas).not.toBe(999);
    expect(datosCrm).toHaveBeenCalledTimes(1);
  });

  it("usa el estado guardado si es de la última semana entera de hoy", async () => {
    const bueno = { fecha: "2026-11-16", informe: { desde: "2026-11-09", hasta: "2026-11-15", visitas: 7 }, aviso: null };
    await tarjeta.guardarTarjeta("nube", { estado: bueno });
    const { informe } = await estadoVigente(await store.getNegocio("nube"), LUNES);
    expect(informe.visitas).toBe(7);
    expect(datosCrm).not.toHaveBeenCalled();
  });
});

describe("avisarDueno", () => {
  it("dice por qué no avisa cuando no hay iPhone", async () => {
    await tarjeta.guardarTarjeta("nube", { dispositivos: [] });
    expect(await avisarDueno(await store.getNegocio("nube"))).toEqual({ enviados: 0, motivo: "sin_iphone" });
  });

  it("dice `error` si APNs falla, sin lanzar", async () => {
    enviarAvisos.mockRejectedValue(new Error("apns"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await avisarDueno(await store.getNegocio("nube"))).toEqual({ enviados: 0, motivo: "error" });
  });

  it("al quitar un token muerto no pisa un iPhone que se registró mientras se esperaba", async () => {
    const otro = iphone("iphone2", "cd".repeat(16));
    enviarAvisos.mockImplementation(async () => {
      await tarjeta.guardarTarjeta("nube", { dispositivos: [iphone(), otro] });
      return { enviados: 0, invalidos: [TOKEN_PUSH], errores: [] };
    });
    await avisarDueno(await store.getNegocio("nube"));
    expect((await leer()).dispositivos.map((d) => d.id)).toEqual(["iphone2"]);
  });
});
