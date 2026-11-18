import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// LA TARJETA DEL DUEÑO: web service, reloj y rutas del manager
// ----------------------------------------------------------------------------
// El store es el de ficheros en un directorio temporal. Lo de fuera (APNs, la
// config de Apple, el historial del CRM) se simula.
// ============================================================================

const PASS_TYPE = "pass.com.fiddle.general";
const enviarAvisos = vi.fn(async (tokens) => ({ enviados: tokens.length, invalidos: [], errores: [] }));
const datosCrm = vi.fn();

vi.mock("@/lib/apple/apns", () => ({ enviarAvisos: (...a) => enviarAvisos(...a) }));
vi.mock("@/lib/crmDatos", () => ({ datosCrm: (...a) => datosCrm(...a) }));
vi.mock("@/lib/apple/config", async (original) => ({
  ...(await original()),
  configApple: () => ({ passTypeId: PASS_TYPE, teamId: "TEAM", cert: "c", key: "k", wwdr: "w", tienda: null }),
}));

const store = await import("@/lib/store");
const tarjeta = await import("@/lib/dueno/tarjeta");
const servicio = await import("@/lib/dueno/servicio");
const { repasarTarjetaDueno } = await import("@/lib/dueno/servidor");
const { firmarSesion } = await import("@/lib/auth");
const ruta = await import("@/app/api/dueno/[...ruta]/route");

const TOKEN_PUSH = "ab".repeat(16);
let dir;
let t;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-dueno-servicio-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  enviarAvisos.mockClear();
  datosCrm.mockReset();
  datosCrm.mockResolvedValue({ eventos: [], metricas: {}, grupos: [], historialCompletoDesde: "2026-07-01T00:00:00.000Z" });
  t = tarjeta.nuevaTarjeta("nube");
  await tarjeta.guardarTarjeta("nube", t);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const deps = (extra = {}) => ({
  passTypeGeneral: PASS_TYPE,
  tiendaDeSerial: tarjeta.tiendaDeSerial,
  tarjetaDe: tarjeta.tarjetaDe,
  conDispositivo: tarjeta.conDispositivo,
  sinDispositivo: tarjeta.sinDispositivo,
  guardarTarjeta: tarjeta.guardarTarjeta,
  listNegocios: store.listNegocios,
  estadoVigente: async () => ({ informe: { desde: "2026-11-09" }, aviso: null }),
  generarPkpass: async () => Buffer.from("pkpass"),
  log: vi.fn(),
  ...extra,
});
const auth = (token = t.token) => `ApplePass ${token}`;
const alta = (extra = {}) => ({
  dispositivo: "iphone1", passType: PASS_TYPE, serial: t.serial, authorization: auth(), cuerpo: { pushToken: TOKEN_PUSH }, ...extra,
});
const guardados = async () => tarjeta.tarjetaDe(await store.getNegocio("nube")).dispositivos;

describe("registrar", () => {
  it("con el token bueno apunta el iPhone y responde 201; la segunda vez, 200", async () => {
    expect((await servicio.registrar(deps(), alta())).status).toBe(201);
    expect((await servicio.registrar(deps(), alta())).status).toBe(200);
    expect(await guardados()).toHaveLength(1);
  });

  it("con el token malo o sin él, 401 y no apunta nada", async () => {
    expect((await servicio.registrar(deps(), alta({ authorization: auth("x".repeat(48)) }))).status).toBe(401);
    expect((await servicio.registrar(deps(), alta({ authorization: null }))).status).toBe(401);
    expect(await guardados()).toEqual([]);
  });

  it("con un passType que no es el general, 401", async () => {
    expect((await servicio.registrar(deps(), alta({ passType: "pass.com.otra.tienda" }))).status).toBe(401);
  });

  it("con el serial de otra tienda o inexistente, 401", async () => {
    expect((await servicio.registrar(deps(), alta({ serial: "dueno-fade-0123456789abcdef" }))).status).toBe(401);
    expect((await servicio.registrar(deps(), alta({ serial: "nada" }))).status).toBe(401);
  });

  it("con la tarjeta apagada, 401", async () => {
    await tarjeta.guardarTarjeta("nube", { activa: false });
    expect((await servicio.registrar(deps(), alta())).status).toBe(401);
  });

  it("rechaza un dispositivo o un pushToken inválidos", async () => {
    expect((await servicio.registrar(deps(), alta({ dispositivo: "a/b" }))).status).toBe(400);
    expect((await servicio.registrar(deps(), alta({ cuerpo: { pushToken: "zz" } }))).status).toBe(400);
  });

  it("al registrar el sexto iPhone cae el más viejo", async () => {
    for (let i = 1; i <= 6; i++) {
      await servicio.registrar(deps(), alta({ dispositivo: `iphone${i}` }));
      await new Promise((r) => setTimeout(r, 3));
    }
    expect((await guardados()).map((d) => d.id)).toEqual(["iphone2", "iphone3", "iphone4", "iphone5", "iphone6"]);
  });
});

describe("desregistrar", () => {
  it("quita ese iPhone y deja los demás", async () => {
    await servicio.registrar(deps(), alta());
    await servicio.registrar(deps(), alta({ dispositivo: "iphone2" }));
    const r = await servicio.desregistrar(deps(), { dispositivo: "iphone1", passType: PASS_TYPE, serial: t.serial, authorization: auth() });
    expect(r.status).toBe(200);
    expect((await guardados()).map((d) => d.id)).toEqual(["iphone2"]);
  });

  it("con el token malo, 401 y no quita nada", async () => {
    await servicio.registrar(deps(), alta());
    const r = await servicio.desregistrar(deps(), { dispositivo: "iphone1", passType: PASS_TYPE, serial: t.serial, authorization: auth("mal") });
    expect(r.status).toBe(401);
    expect(await guardados()).toHaveLength(1);
  });
});

describe("pasesActualizados", () => {
  const pedir = (desde) => servicio.pasesActualizados(deps(), { dispositivo: "iphone1", passType: PASS_TYPE, desde });

  it("204 si el iPhone no está registrado o nada cambió después de `desde`", async () => {
    expect((await pedir()).status).toBe(204);
    await servicio.registrar(deps(), alta());
    await tarjeta.guardarTarjeta("nube", { actualizado: "2026-11-16T08:00:00.000Z" });
    expect((await pedir(String(Date.parse("2026-11-16T08:00:00.000Z")))).status).toBe(204);
  });

  it("200 con el serial y la marca de tiempo si cambió", async () => {
    await servicio.registrar(deps(), alta());
    await tarjeta.guardarTarjeta("nube", { actualizado: "2026-11-16T08:00:00.000Z" });
    const r = await pedir("0");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ serialNumbers: [t.serial], lastUpdated: String(Date.parse("2026-11-16T08:00:00.000Z")) });
  });

  it("no enseña la tarjeta a un iPhone que no la tiene", async () => {
    await servicio.registrar(deps(), alta({ dispositivo: "otro" }));
    await tarjeta.guardarTarjeta("nube", { actualizado: "2026-11-16T08:00:00.000Z" });
    expect((await pedir("0")).status).toBe(204);
  });
});

describe("paseActual", () => {
  it("siempre 200 con el pkpass y sin caché", async () => {
    const r = await servicio.paseActual(deps(), { passType: PASS_TYPE, serial: t.serial, authorization: auth() });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toBe("application/vnd.apple.pkpass");
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["last-modified"]).toBeTruthy();
    expect(r.body.toString()).toBe("pkpass");
  });

  it("con el token malo, 401", async () => {
    expect((await servicio.paseActual(deps(), { passType: PASS_TYPE, serial: t.serial, authorization: auth("mal") })).status).toBe(401);
  });
});

describe("registrarLogs", () => {
  it("escribe cada línea saneada con su prefijo", () => {
    const d = deps();
    servicio.registrarLogs(d, { cuerpo: { logs: ["fallo\nfalso"] } });
    expect(d.log).toHaveBeenCalledWith("[tarjeta-dueno] fallo falso");
  });
});

describe("repasarTarjetaDueno", () => {
  // Lunes 16 de noviembre de 2026, 10:00 en Valencia (UTC+1): ya pasó la hora de repaso.
  const LUNES = Date.parse("2026-11-16T10:00:00+01:00");
  const MARTES = Date.parse("2026-11-17T10:00:00+01:00");
  const OTRO_LUNES = Date.parse("2026-11-23T10:00:00+01:00");
  const conIphone = () => tarjeta.guardarTarjeta("nube", {
    dispositivos: [{ id: "iphone1", token: TOKEN_PUSH, tipo: PASS_TYPE, alta: "2026-11-01T00:00:00.000Z" }],
  });
  const repasar = async (ahora) => repasarTarjetaDueno(await store.getNegocio("nube"), ahora);

  it("sin iPhones registrados no calcula nada", async () => {
    expect(await repasar(LUNES)).toEqual({ ok: true, cambio: false });
    expect(datosCrm).not.toHaveBeenCalled();
  });

  it("no repasa dos veces el mismo día y guarda el estado con su fecha", async () => {
    await conIphone();
    await repasar(LUNES);
    await repasar(LUNES + 3_600_000);
    expect(datosCrm).toHaveBeenCalledTimes(1);
    const guardada = tarjeta.tarjetaDe(await store.getNegocio("nube"));
    expect(guardada.estado.fecha).toBe("2026-11-16");
    expect(guardada.actualizado).toBe(new Date(LUNES).toISOString());
  });

  it("antes de la hora de repaso no hace nada", async () => {
    await conIphone();
    await repasar(Date.parse("2026-11-16T07:00:00+01:00"));
    expect(datosCrm).not.toHaveBeenCalled();
  });

  it("empuja solo si cambia lo que enseña la tarjeta", async () => {
    await conIphone();
    expect((await repasar(LUNES)).cambio).toBe(true);
    expect(enviarAvisos).toHaveBeenCalledTimes(1);

    expect((await repasar(MARTES)).cambio).toBe(false);
    expect(enviarAvisos).toHaveBeenCalledTimes(1);
    const tras = tarjeta.tarjetaDe(await store.getNegocio("nube"));
    expect(tras.estado.fecha).toBe("2026-11-17");
    expect(tras.actualizado).toBe(new Date(LUNES).toISOString());

    expect((await repasar(OTRO_LUNES)).cambio).toBe(true);
    expect(enviarAvisos).toHaveBeenCalledTimes(2);
  });

  it("no lanza si no se pueden leer los datos", async () => {
    await conIphone();
    datosCrm.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await repasar(LUNES)).toEqual({ ok: false, cambio: false });
  });
});

describe("las rutas del manager", () => {
  async function pedir(url, metodo, como, cuerpo) {
    const headers = {};
    if (como) headers.cookie = `sesion=${await firmarSesion(...como)}`;
    if (cuerpo !== undefined) headers["content-type"] = "application/json";
    const body = cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {};
    const request = new NextRequest(`http://x${url}`, { method: metodo, headers, ...body });
    const params = Promise.resolve({ ruta: url.split("?")[0].replace("/api/dueno/", "").split("/") });
    return ruta[metodo](request, { params });
  }
  const CASOS = [["GET", "/api/dueno/pase?b=nube"], ["GET", "/api/dueno/vista?b=nube"], ["POST", "/api/dueno/prueba?b=nube"], ["PUT", "/api/dueno/recibir?b=nube"]];

  for (const [metodo, url] of CASOS) {
    it(`${metodo} ${url}: 401 sin sesión`, async () => {
      expect((await pedir(url, metodo, null)).status).toBe(401);
    });

    it(`${metodo} ${url}: 403 con otra tienda o con la caja de la misma`, async () => {
      expect((await pedir(url, metodo, ["fade", "manager"])).status).toBe(403);
      expect((await pedir(url, metodo, ["nube", "caja"])).status).toBe(403);
    });
  }

  it("la prueba del manager guarda el aviso de 15 minutos y empuja", async () => {
    await tarjeta.guardarTarjeta("nube", { dispositivos: [{ id: "iphone1", token: TOKEN_PUSH, tipo: PASS_TYPE, alta: "a" }] });
    const r = await pedir("/api/dueno/prueba?b=nube", "POST", ["nube", "manager"]);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, avisados: 1 });
    const guardada = tarjeta.tarjetaDe(await store.getNegocio("nube"));
    expect(guardada.prueba.texto).toMatch(/^Esto es una prueba/);
    expect(Date.parse(guardada.prueba.hasta)).toBeGreaterThan(Date.now());
  });

  it("la prueba, si ya hay una vigente, no se reenvía", async () => {
    await tarjeta.guardarTarjeta("nube", { dispositivos: [{ id: "iphone1", token: TOKEN_PUSH, tipo: PASS_TYPE, alta: "a" }] });
    await pedir("/api/dueno/prueba?b=nube", "POST", ["nube", "manager"]);
    enviarAvisos.mockClear();
    const r = await pedir("/api/dueno/prueba?b=nube", "POST", ["nube", "manager"]);
    expect(await r.json()).toEqual({ ok: true, avisados: 0, repetida: true });
    expect(enviarAvisos).not.toHaveBeenCalled();
  });

  it("la prueba sin iPhone dice el motivo", async () => {
    const r = await pedir("/api/dueno/prueba?b=nube", "POST", ["nube", "manager"]);
    expect(await r.json()).toEqual({ ok: true, avisados: 0, motivo: "sin_iphone" });
  });

  it("la vista previa devuelve el informe y el aviso, sin serial ni token", async () => {
    const r = await pedir("/api/dueno/vista?b=nube", "GET", ["nube", "manager"]);
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(Object.keys(cuerpo).sort()).toEqual(["aviso", "informe"]);
    expect(cuerpo.informe.porDia).toHaveLength(7);
    expect(JSON.stringify(cuerpo)).not.toContain(t.token);
  });

  it("qué recibe: guarda solo lo suyo, marca la tarjeta como cambiada y no toca el token", async () => {
    const r = await pedir("/api/dueno/recibir?b=nube", "PUT", ["nube", "manager"], { resumen: false });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, recibir: { resumen: false, ideas: true, porSemana: 2 } });
    const guardada = tarjeta.tarjetaDe(await store.getNegocio("nube"));
    expect(guardada.recibir).toEqual({ resumen: false, ideas: true, porSemana: 2 });
    expect(guardada.token).toBe(t.token);
    expect(guardada.actualizado).toBeTruthy();
    expect(enviarAvisos).not.toHaveBeenCalled();
  });

  it("qué recibe: cambiar las ideas empuja a los iPhone", async () => {
    await tarjeta.guardarTarjeta("nube", { dispositivos: [{ id: "iphone1", token: TOKEN_PUSH, tipo: PASS_TYPE, alta: "a" }] });
    await pedir("/api/dueno/recibir?b=nube", "PUT", ["nube", "manager"], { ideas: false });
    expect(enviarAvisos).toHaveBeenCalledTimes(1);
  });

  it("qué recibe: lo que no es suyo o no vale es 400 y no se guarda", async () => {
    for (const malo of [{ token: "x" }, { porSemana: 7 }, { ideas: "no" }, {}]) {
      expect((await pedir("/api/dueno/recibir?b=nube", "PUT", ["nube", "manager"], malo)).status).toBe(400);
    }
    const guardada = tarjeta.tarjetaDe(await store.getNegocio("nube"));
    expect(guardada.token).toBe(t.token);
    expect(guardada.recibir).toBeUndefined();
  });

  it("lo que no casa es 404", async () => {
    expect((await pedir("/api/dueno/v1/nada", "GET", null)).status).toBe(404);
    expect((await pedir("/api/dueno/otra", "GET", null)).status).toBe(404);
  });
});
