import { describe, it, expect, beforeEach, vi } from "vitest";
import { registrar, desregistrar, pasesActualizados, paseActual, registrarLogs } from "@/lib/apple/servicio";

const PASS = "pass.dev.sellos";
const TOKEN = "t".repeat(48);
const AUTH = `ApplePass ${TOKEN}`;
const PUSH = "ab".repeat(32);

// Store en memoria con la misma forma que lib/store.
function crearDeps() {
  const clientes = {
    s1: { serial: "s1", negocio: "nube", auth_token: TOKEN, actualizado: "2026-09-01T10:00:00.000Z" },
    s2: { serial: "s2", negocio: "nube", auth_token: "otro".repeat(8), actualizado: "2026-09-02T10:00:00.000Z" },
  };
  const registros = [];
  return {
    registros,
    clientes,
    config: { passTypeId: PASS },
    getCliente: async (s) => clientes[s] ?? null,
    getNegocio: async (slug) => (slug === "nube" ? { slug } : null),
    registrarPase: vi.fn(async (r) => {
      if (registros.some((x) => x.dispositivo === r.dispositivo && x.serial === r.serial)) return false;
      registros.push(r);
      return true;
    }),
    borrarRegistro: vi.fn(async ({ dispositivo, serial }) => {
      const i = registros.findIndex((r) => r.dispositivo === dispositivo && r.serial === serial);
      if (i >= 0) registros.splice(i, 1);
      return { ultimo: !registros.some((r) => r.serial === serial) };
    }),
    marcarInstalacion: vi.fn(async (serial, dentro) => {
      const c = clientes[serial];
      if (!c) return;
      if (dentro) { c.instalado = c.instalado || "2026-09-10T10:00:00.000Z"; c.desinstalado = null; }
      else c.desinstalado = "2026-09-20T10:00:00.000Z";
    }),
    addEvento: vi.fn(async () => {}),
    pasesDeDispositivo: async ({ dispositivo }) =>
      registros.filter((r) => r.dispositivo === dispositivo).map((r) => ({ serial: r.serial, actualizado: clientes[r.serial].actualizado })),
    generarPkpass: vi.fn(async () => Buffer.from("PKPASS")),
    log: vi.fn(),
  };
}

let deps;
beforeEach(() => { deps = crearDeps(); });

describe("registrar", () => {
  const args = (extra = {}) => ({ dispositivo: "dev1", passType: PASS, serial: "s1", authorization: AUTH, cuerpo: { pushToken: PUSH }, ...extra });

  it("201 la primera vez, 200 si ya estaba", async () => {
    expect((await registrar(deps, args())).status).toBe(201);
    expect((await registrar(deps, args())).status).toBe(200);
    expect(deps.registrarPase).toHaveBeenCalledWith({ dispositivo: "dev1", pushToken: PUSH, passType: PASS, serial: "s1", negocio: "nube" });
  });

  it("401 con token incorrecto, sin cabecera, otro passType o serial inexistente", async () => {
    expect((await registrar(deps, args({ authorization: "ApplePass malo" }))).status).toBe(401);
    expect((await registrar(deps, args({ authorization: null }))).status).toBe(401);
    expect((await registrar(deps, args({ authorization: TOKEN }))).status).toBe(401);
    expect((await registrar(deps, args({ passType: "pass.otro" }))).status).toBe(401);
    expect((await registrar(deps, args({ serial: "nope" }))).status).toBe(401);
    // El token de un pase no sirve para otro.
    expect((await registrar(deps, args({ serial: "s2" }))).status).toBe(401);
    expect(deps.registrarPase).not.toHaveBeenCalled();
  });

  it("400 con pushToken o dispositivo inválidos", async () => {
    expect((await registrar(deps, args({ cuerpo: {} }))).status).toBe(400);
    expect((await registrar(deps, args({ cuerpo: { pushToken: "no hex!" } }))).status).toBe(400);
    expect((await registrar(deps, args({ dispositivo: "../../x" }))).status).toBe(400);
  });
});

describe("desregistrar", () => {
  it("200 con token válido, 401 sin él", async () => {
    const base = { dispositivo: "dev1", passType: PASS, serial: "s1" };
    expect((await desregistrar(deps, { ...base, authorization: AUTH })).status).toBe(200);
    expect(deps.borrarRegistro).toHaveBeenCalledWith(base);
    expect((await desregistrar(deps, { ...base, authorization: "ApplePass x" })).status).toBe(401);
    expect((await desregistrar(deps, { ...base, dispositivo: "" })).status).toBe(400);
  });
});

// El CRM se entera aquí de las dos fechas que no puede saber de ninguna otra
// forma: cuándo el pase entró en un Wallet y cuándo salió del último.
describe("instalación del pase (CRM)", () => {
  const reg = (dispositivo) => ({ dispositivo, passType: PASS, serial: "s1", authorization: AUTH, cuerpo: { pushToken: PUSH } });

  it("apunta el alta una sola vez, aunque el pase esté en dos iPhone", async () => {
    await registrar(deps, reg("dev1"));
    expect(deps.clientes.s1.instalado).toBe("2026-09-10T10:00:00.000Z");
    expect(deps.addEvento).toHaveBeenCalledWith("s1", "instalado", expect.any(String), { negocio: "nube", actor: "apple" });

    deps.addEvento.mockClear();
    await registrar(deps, reg("dev2"));
    expect(deps.addEvento).not.toHaveBeenCalled(); // ya estaba instalado: no es noticia
  });

  it("la baja solo cuenta al salir del ÚLTIMO iPhone", async () => {
    await registrar(deps, reg("dev1"));
    await registrar(deps, reg("dev2"));

    await desregistrar(deps, { dispositivo: "dev1", passType: PASS, serial: "s1", authorization: AUTH });
    expect(deps.clientes.s1.desinstalado).toBeFalsy(); // le queda otro teléfono

    await desregistrar(deps, { dispositivo: "dev2", passType: PASS, serial: "s1", authorization: AUTH });
    expect(deps.clientes.s1.desinstalado).toBe("2026-09-20T10:00:00.000Z");
    expect(deps.addEvento).toHaveBeenCalledWith("s1", "desinstalado", expect.any(String), { negocio: "nube", actor: "apple" });
  });

  it("volver a añadirlo borra la fecha de baja y conserva la del alta", async () => {
    await registrar(deps, reg("dev1"));
    await desregistrar(deps, { dispositivo: "dev1", passType: PASS, serial: "s1", authorization: AUTH });
    await registrar(deps, reg("dev1"));
    expect(deps.clientes.s1.desinstalado).toBeNull();
    expect(deps.clientes.s1.instalado).toBe("2026-09-10T10:00:00.000Z");
  });
});

describe("pasesActualizados", () => {
  beforeEach(async () => {
    deps.registros.push({ dispositivo: "dev1", serial: "s1" }, { dispositivo: "dev1", serial: "s2" });
  });

  it("sin tag devuelve todos con lastUpdated = el más reciente", async () => {
    const r = await pasesActualizados(deps, { dispositivo: "dev1", passType: PASS, desde: null });
    expect(r.status).toBe(200);
    expect(r.json.serialNumbers.sort()).toEqual(["s1", "s2"]);
    expect(r.json.lastUpdated).toBe(String(Date.parse("2026-09-02T10:00:00.000Z")));
  });

  it("con tag devuelve solo los posteriores; 204 si no hay", async () => {
    const tag = String(Date.parse("2026-09-01T10:00:00.000Z"));
    const r = await pasesActualizados(deps, { dispositivo: "dev1", passType: PASS, desde: tag });
    expect(r.json.serialNumbers).toEqual(["s2"]);
    const nada = await pasesActualizados(deps, { dispositivo: "dev1", passType: PASS, desde: r.json.lastUpdated });
    expect(nada.status).toBe(204);
  });

  it("tag no numérico se trata como 0; passType ajeno 404", async () => {
    expect((await pasesActualizados(deps, { dispositivo: "dev1", passType: PASS, desde: "abc" })).json.serialNumbers).toHaveLength(2);
    expect((await pasesActualizados(deps, { dispositivo: "dev1", passType: "pass.otro" })).status).toBe(404);
    expect((await pasesActualizados(deps, { dispositivo: "dev2", passType: PASS })).status).toBe(204);
  });
});

describe("paseActual", () => {
  it("devuelve el pkpass con Last-Modified", async () => {
    const r = await paseActual(deps, { passType: PASS, serial: "s1", authorization: AUTH });
    expect(r.status).toBe(200);
    expect(r.body.toString()).toBe("PKPASS");
    expect(r.headers["content-type"]).toBe("application/vnd.apple.pkpass");
    expect(r.headers["last-modified"]).toBe(new Date("2026-09-01T10:00:00.000Z").toUTCString());
  });

  it("401 sin token válido y 404 si el negocio no existe", async () => {
    expect((await paseActual(deps, { passType: PASS, serial: "s1", authorization: "ApplePass x" })).status).toBe(401);
    deps.getNegocio = async () => null;
    expect((await paseActual(deps, { passType: PASS, serial: "s1", authorization: AUTH })).status).toBe(404);
    expect(deps.generarPkpass).not.toHaveBeenCalled();
  });
});

describe("registrarLogs", () => {
  it("registra como mucho 50 líneas recortadas", () => {
    const logs = Array.from({ length: 60 }, (_, i) => `error ${i} ${"x".repeat(600)}`);
    expect(registrarLogs(deps, { cuerpo: { logs } }).status).toBe(200);
    expect(deps.log).toHaveBeenCalledTimes(50);
    expect(deps.log.mock.calls[0][0].length).toBeLessThanOrEqual(515);
    expect(registrarLogs(deps, { cuerpo: null }).status).toBe(200);
  });

  it("quita saltos de línea para que no se puedan inventar líneas de log", () => {
    registrarLogs(deps, { cuerpo: { logs: ["uno\n[apple-wallet] falso\r\u0000fin"] } });
    expect(deps.log).toHaveBeenCalledWith("[apple-wallet] uno [apple-wallet] falso fin");
  });
});
