import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as store from "@/lib/store";

// Backend de ficheros (demo) en un directorio temporal por test.
let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-store-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const nuevo = (serial, negocio = "nube") => store.crearCliente({ serial, negocio, authToken: `tok-${serial}`.padEnd(20, "x") });

describe("negocios", () => {
  it("compone preset + config guardada, con ubicaciones", async () => {
    expect(await store.getNegocio("nope")).toBeNull();
    expect(await store.getNegocio("toString")).toBeNull();
    const base = await store.getNegocio("nube");
    expect(base).toMatchObject({ slug: "nube", nombre: "Nube Café", meta: 8, ubicaciones: [] });

    const g = await store.saveNegocio("nube", { meta: 5, ubicaciones: [{ lat: 1, lng: 2 }] });
    expect(g).toMatchObject({ meta: 5, premio: "café gratis", ubicaciones: [{ lat: 1, lng: 2 }] });
    expect(await store.getNegocio("nube")).toMatchObject({ meta: 5 });
    expect((await store.listNegocios()).map((n) => n.slug)).toEqual(["nube", "fade", "forno"]);
    expect(await store.saveNegocio("nope", {})).toBeNull();
  });
});

describe("clientes", () => {
  it("crea, lee, guarda nombre y marca actualizado", async () => {
    const c = await nuevo("s1");
    expect(c).toMatchObject({ serial: "s1", negocio: "nube", sellos: 0, nombre: null });
    expect(c.auth_token).toMatch(/^tok-s1/);

    await new Promise((r) => setTimeout(r, 5));
    expect(await store.saveCliente({ ...c, sellos: 2 })).toBe(true);
    expect(await store.guardarNombre("s1", "Marta")).toBe(true);
    const leido = await store.getCliente("s1");
    expect(leido).toMatchObject({ sellos: 2, nombre: "Marta" });
    expect(Date.parse(leido.actualizado)).toBeGreaterThan(Date.parse(c.actualizado));

    // Guardar sellos no toca el nombre.
    await store.saveCliente({ serial: "s1", sellos: 3, premios: 0 });
    expect((await store.getCliente("s1")).nombre).toBe("Marta");
    expect(await store.saveCliente({ serial: "nope", sellos: 1, premios: 0 })).toBe(false);
    expect(await store.guardarNombre("nope", "x")).toBe(false);
    expect(await store.getCliente("nope")).toBeNull();
    expect(await store.getCliente(undefined)).toBeNull();
  });

  it("guardado optimista: dos canjes a la vez, solo uno gana", async () => {
    await nuevo("s1");
    await store.saveCliente({ serial: "s1", sellos: 8, premios: 0 });
    const leidoPorCajaA = await store.getCliente("s1");
    const leidoPorCajaB = await store.getCliente("s1");
    const canje = (leido) => store.saveCliente({ ...leido, sellos: 0, premios: leido.premios + 1 }, { esperado: leido });
    const [a, b] = await Promise.all([canje(leidoPorCajaA), canje(leidoPorCajaB)]);
    expect([a, b].sort()).toEqual([false, true]);
    expect(await store.getCliente("s1")).toMatchObject({ sellos: 0, premios: 1 });
  });

  it("clientePublico no expone el token", async () => {
    const c = await nuevo("s1");
    expect(store.clientePublico(c)).not.toHaveProperty("auth_token");
    expect(store.clientePublico(c)).not.toHaveProperty("ww_serial");
  });

  it("lista por negocio y toca solo los de ese negocio", async () => {
    await nuevo("a", "nube");
    await nuevo("b", "fade");
    expect((await store.listClientes("nube")).map((c) => c.serial)).toEqual(["a"]);
    expect(await store.listClientes()).toHaveLength(2);

    const antesB = (await store.getCliente("b")).actualizado;
    await new Promise((r) => setTimeout(r, 5));
    await store.tocarClientesDeNegocio("nube");
    expect(Date.parse((await store.getCliente("a")).actualizado)).toBeGreaterThan(Date.parse(antesB));
    expect((await store.getCliente("b")).actualizado).toBe(antesB);
  });
});

describe("eventos", () => {
  it("guarda y lista recientes primero", async () => {
    await store.addEvento("s1", "sellar", "uno");
    await new Promise((r) => setTimeout(r, 2));
    await store.addEvento("s1", "sellar", "dos");
    await store.addEvento("s2", "sellar", "otro");
    expect((await store.listEventos("s1")).map((e) => e.mensaje)).toEqual(["dos", "uno"]);
    expect(await store.listEventos("s1", 1)).toHaveLength(1);
  });
});

describe("registros de Apple Wallet", () => {
  const reg = (dispositivo, serial, pushToken = `pt-${dispositivo}`) =>
    store.registrarPase({ dispositivo, pushToken, passType: "pass.x", serial, negocio: "nube" });

  it("registra, evita duplicados y lista pases del dispositivo", async () => {
    await nuevo("s1");
    await nuevo("s2");
    expect(await reg("d1", "s1")).toBe(true);
    expect(await reg("d1", "s1")).toBe(false);
    expect(await reg("d1", "s2")).toBe(true);
    const pases = await store.pasesDeDispositivo({ dispositivo: "d1", passType: "pass.x" });
    expect(pases.map((p) => p.serial).sort()).toEqual(["s1", "s2"]);
    expect(pases[0].actualizado).toBeTruthy();
  });

  it("push tokens por serial o por negocio, sin duplicados", async () => {
    await nuevo("s1");
    await nuevo("s2");
    await reg("d1", "s1");
    await reg("d1", "s2");
    await reg("d2", "s2");
    expect(await store.pushTokens({ seriales: ["s1"] })).toEqual(["pt-d1"]);
    expect((await store.pushTokens({ negocio: "nube" })).sort()).toEqual(["pt-d1", "pt-d2"]);
    expect(await store.pushTokens({ negocio: "fade" })).toEqual([]);
  });

  it("al darse de baja del último pase se borra el dispositivo", async () => {
    await nuevo("s1");
    await reg("d1", "s1");
    await store.borrarRegistro({ dispositivo: "d1", passType: "pass.x", serial: "s1" });
    expect(await store.pasesDeDispositivo({ dispositivo: "d1", passType: "pass.x" })).toEqual([]);
    expect(await store.pushTokens({ negocio: "nube" })).toEqual([]);
  });

  it("borra dispositivos con tokens muertos y sus registros", async () => {
    await nuevo("s1");
    await reg("d1", "s1");
    await reg("d2", "s1");
    await store.borrarDispositivosPorToken(["pt-d1"]);
    expect(await store.pushTokens({ seriales: ["s1"] })).toEqual(["pt-d2"]);
    await store.borrarDispositivosPorToken([]);
  });
});

describe("intentos (límites de uso)", () => {
  it("cuenta intentos por clave dentro de la ventana", async () => {
    const inicio = Date.now() - 1;
    await store.registrarIntento("login:nube:1.2.3.4");
    await store.registrarIntento("login:nube:1.2.3.4");
    await store.registrarIntento("login:fade:1.2.3.4");
    expect(await store.contarIntentos("login:nube:1.2.3.4", inicio)).toBe(2);
    expect(await store.contarIntentos("login:nube:1.2.3.4", Date.now() + 1000)).toBe(0);
  });
});

describe("concurrencia en modo demo", () => {
  it("escrituras simultáneas no se pisan ni corrompen el fichero", async () => {
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.addEvento("s1", "sellar", `e${i}`)));
    await Promise.all(Array.from({ length: 10 }, (_, i) => nuevo(`c${i}`)));
    expect(await store.listEventos("s1", 100)).toHaveLength(25);
    expect(await store.listClientes("nube")).toHaveLength(10);
  });
});

describe("errores de lectura", () => {
  it("un JSON corrupto no se traga en silencio", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(dir, "clientes.json"), "{no es json");
    await expect(store.getCliente("s1")).rejects.toThrow(/clientes\.json/);
  });
});
