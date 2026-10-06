import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as store from "@/lib/store";
import { construirPassJson } from "@/lib/apple/pase";
import { construirObjeto } from "@/lib/google/pase";
import { registrar, desregistrar, paseActual } from "@/lib/apple/servicio";
import { SEMILLAS, componerNegocio } from "@/lib/negocios";

// Dar de baja las tarjetas de una tienda (store.anularTarjetas + purgarAnuladas):
// en los teléfonos no se pueden borrar, así que se anulan y la fila vacía aguanta
// mientras un iPhone pueda venir a por la versión anulada.

describe("store: anular y purgar (ficheros)", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-baja-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  const nuevo = (serial, negocio = "nube") => store.crearCliente({ serial, negocio, authToken: `tok-${serial}`.padEnd(20, "x"), nombre: "Ana" });

  it("vacía las de la tienda, borra las que no están en un iPhone y deja las demás", async () => {
    await nuevo("iphone");
    await nuevo("web");
    await nuevo("google");
    await nuevo("nada");
    await nuevo("otra", "fade");
    await store.saveCliente({ serial: "iphone", sellos: 4, premios: 1 });
    await store.addEvento("iphone", "sello", "+1", { negocio: "nube" });
    await store.registrarPase({ dispositivo: "dev1", pushToken: "pt", passType: "pass.x", serial: "iphone", negocio: "nube" });
    // El mismo iPhone tiene también una de otra tienda: su dispositivo se queda.
    await store.registrarPase({ dispositivo: "dev1", pushToken: "pt", passType: "pass.x", serial: "otra", negocio: "fade" });
    await store.registrarPase({ dispositivo: "web-1", pushToken: "{}", passType: "web", serial: "web", negocio: "nube" });
    await store.registrarPase({ dispositivo: "google-google", pushToken: "obj", passType: "google", serial: "google", negocio: "nube" });

    const anuladas = await store.anularTarjetas("nube");
    expect(anuladas.map((c) => c.serial).sort()).toEqual(["google", "iphone", "nada", "web"]);
    expect(anuladas.find((c) => c.serial === "iphone")).toMatchObject({ sellos: 0, premios: 0, nombre: null });
    expect(anuladas.every((c) => c.anulado_en)).toBe(true);

    // Para todos menos el web service, ya no existen.
    expect(await store.getCliente("iphone")).toBeNull();
    expect(await store.getCliente("iphone", { incluirAnuladas: true })).toMatchObject({ sellos: 0, auth_token: expect.any(String) });
    expect(await store.listClientes("nube")).toEqual([]);
    expect(await store.listEventos("iphone")).toEqual([]);
    // Las de otra tienda, ni tocarlas.
    expect(await store.getCliente("otra")).toMatchObject({ nombre: "Ana" });
    // Otra vez no anula nada nuevo.
    expect(await store.anularTarjetas("nube")).toEqual([]);

    expect(await store.purgarAnuladas({ negocio: "nube" })).toBe(3);
    expect(await store.getCliente("iphone", { incluirAnuladas: true })).not.toBeNull();
    for (const s of ["web", "google", "nada"]) expect(await store.getCliente(s, { incluirAnuladas: true })).toBeNull();
    // Sus suscripciones se van con ellas; el iPhone sigue ahí.
    expect(await store.destinosDeAviso({ passType: "web" })).toEqual([]);
    expect(await store.destinosDeAviso({ passType: "google" })).toEqual([]);
    expect(await store.destinosDeAviso({ seriales: ["iphone"] })).toHaveLength(1);
    expect(await store.purgarAnuladas({ negocio: "nube" })).toBe(0);

    // El iPhone la quita: ya no hace falta.
    await store.borrarRegistro({ dispositivo: "dev1", passType: "pass.x", serial: "iphone" });
    expect(await store.purgarAnuladas()).toBe(1);
    expect(await store.getCliente("iphone", { incluirAnuladas: true })).toBeNull();
    expect(await store.destinosDeAviso({ seriales: ["otra"] })).toHaveLength(1);
  });

  it("a los 30 días se borra aunque siga en un iPhone", async () => {
    await nuevo("iphone");
    await store.registrarPase({ dispositivo: "dev1", pushToken: "pt", passType: "pass.x", serial: "iphone", negocio: "nube" });
    await store.anularTarjetas("nube");
    expect(await store.purgarAnuladas()).toBe(0);
    vi.useFakeTimers({ now: Date.now() + 31 * 24 * 60 * 60 * 1000, toFake: ["Date"] });
    try {
      expect(await store.purgarAnuladas()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
    expect(await store.destinosDeAviso({})).toEqual([]);
  });
});

describe("el pase anulado", () => {
  const anulada = { serial: "3f1c2b1a-1111-4222-8333-444455556666", codigo: "K7M", sellos: 0, premios: 0, auth_token: "a".repeat(48), anulado_en: "2026-10-06T10:00:00.000Z" };

  it("Apple: voided, dice que ya no vale (y suena)", () => {
    const p = construirPassJson(anulada, { ...SEMILLAS.nube, promo: null, ubicaciones: [] }, { passTypeId: "pass.x", teamId: "T", appUrl: "https://a" });
    expect(p.voided).toBe(true);
    expect(p.storeCard.secondaryFields).toEqual([expect.objectContaining({ label: "TARJETA ANULADA", changeMessage: "%@" })]);
    expect(p.storeCard.backFields[0].value).toContain("Nube Café");
  });

  it("Google: caducada", () => {
    expect(construirObjeto(anulada, componerNegocio("nube", null), { issuerId: "1", appUrl: "https://a" }).state).toBe("INACTIVE");
  });
});

describe("web service de Apple con una anulada", () => {
  const TOKEN = "t".repeat(48);
  const AUTH = `ApplePass ${TOKEN}`;
  let deps;
  beforeEach(() => {
    deps = {
      configDe: (passType) => (passType === "pass.x" ? { passTypeId: "pass.x" } : null),
      getCliente: async (s) => (s === "s1" ? { serial: "s1", negocio: "vieja", auth_token: TOKEN, anulado_en: "2026-10-06T10:00:00.000Z", actualizado: "2026-10-06T10:00:00.000Z" } : null),
      getNegocio: async () => null, // archivada: para lo demás no existe
      getNegocioDeAnulada: async (slug) => ({ slug }),
      registrarPase: vi.fn(async () => true),
      borrarRegistro: vi.fn(async () => ({ ultimo: true })),
      purgarAnuladas: vi.fn(async () => 1),
      marcarInstalacion: vi.fn(),
      addEvento: vi.fn(),
      generarPkpass: vi.fn(async () => Buffer.from("PKPASS")),
    };
  });

  it("sirve el pase anulado aunque la tienda esté archivada", async () => {
    const r = await paseActual(deps, { passType: "pass.x", serial: "s1", authorization: AUTH });
    expect(r.status).toBe(200);
    expect(deps.generarPkpass).toHaveBeenCalled();
  });

  it("no se vuelve a registrar", async () => {
    const r = await registrar(deps, { dispositivo: "dev1", passType: "pass.x", serial: "s1", authorization: AUTH, cuerpo: { pushToken: "ab".repeat(32) } });
    expect(r.status).toBe(401);
    expect(deps.registrarPase).not.toHaveBeenCalled();
  });

  it("al quitarla se purga, sin apuntar una baja en el CRM", async () => {
    const r = await desregistrar(deps, { dispositivo: "dev1", passType: "pass.x", serial: "s1", authorization: AUTH });
    expect(r.status).toBe(200);
    expect(deps.purgarAnuladas).toHaveBeenCalledWith({ negocio: "vieja" });
    expect(deps.addEvento).not.toHaveBeenCalled();
    expect(deps.marcarInstalacion).not.toHaveBeenCalled();
  });
});
