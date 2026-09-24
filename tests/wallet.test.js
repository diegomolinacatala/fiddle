import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// APNs y WalletWallet se simulan: aquí se prueba la orquestación.
vi.mock("@/lib/apple/apns", () => ({ enviarAvisos: vi.fn() }));
vi.mock("@/lib/walletwallet", async (original) => ({
  ...(await original()),
  createPass: vi.fn(async () => ({ wwSerial: "ww-1", shareUrl: "https://ww/share", applePass: Buffer.from("PK").toString("base64") })),
  updatePass: vi.fn(async () => ({})),
}));

const { enviarAvisos } = await import("@/lib/apple/apns");
const ww = await import("@/lib/walletwallet");
const wallet = await import("@/lib/wallet");
const store = await import("@/lib/store");
const { cadenaDePrueba, otroPassTypeDePrueba, aBase64 } = await import("../scripts/lib/certs.mjs");

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-wallet-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("WALLETWALLET_API_KEY", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  vi.stubEnv("APP_URL", "https://sellos.app");
  vi.mocked(enviarAvisos).mockReset();
  vi.mocked(ww.updatePass).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const cadena = cadenaDePrueba();
function stubApple() {
  vi.stubEnv("APPLE_PASS_TYPE_ID", cadena.passTypeId);
  vi.stubEnv("APPLE_TEAM_ID", cadena.teamId);
  vi.stubEnv("APPLE_PASS_CERT", aBase64(cadena.certPem));
  vi.stubEnv("APPLE_PASS_KEY", aBase64(cadena.keyPem));
  vi.stubEnv("APPLE_WWDR_CERT", aBase64(cadena.wwdrPem));
}

describe("proveedorWallet", () => {
  it("apple > walletwallet > demo", () => {
    expect(wallet.proveedorWallet()).toBe("demo");
    vi.stubEnv("WALLETWALLET_API_KEY", "ww_live_x");
    expect(wallet.proveedorWallet()).toBe("walletwallet");
    stubApple();
    expect(wallet.proveedorWallet()).toBe("apple");
  });
});

describe("emitirPase", () => {
  it("demo: crea cliente con serial uuid y token secreto", async () => {
    const r = await wallet.emitirPase("nube");
    expect(r.proveedor).toBe("demo");
    expect(r.cliente.serial).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.cliente.auth_token).toMatch(/^[0-9a-f]{48}$/);
    expect(r.urlPase).toBe(`https://sellos.app/p/${r.cliente.serial}`);
    expect(await store.getCliente(r.cliente.serial)).toBeTruthy();
  });

  it("walletwallet: guarda ww_serial y devuelve su pkpass", async () => {
    vi.stubEnv("WALLETWALLET_API_KEY", "ww_live_x");
    const r = await wallet.emitirPase("fade");
    expect(r.cliente.ww_serial).toBe("ww-1");
    expect(r.shareUrl).toBe("https://ww/share");
    expect(r.pkpassWalletWallet.toString()).toBe("PK");
  });

  it("negocio desconocido lanza", async () => {
    await expect(wallet.emitirPase("nope")).rejects.toThrow(/desconocido/);
  });
});

describe("notificar", () => {
  it("apple: avisa a los iPhone del cliente y limpia tokens muertos", async () => {
    stubApple();
    const { cliente, negocio } = await wallet.emitirPase("nube");
    await store.registrarPase({ dispositivo: "d1", pushToken: "aa11", passType: cadena.passTypeId, serial: cliente.serial, negocio: "nube" });
    await store.registrarPase({ dispositivo: "d2", pushToken: "bb22", passType: cadena.passTypeId, serial: cliente.serial, negocio: "nube" });
    vi.mocked(enviarAvisos).mockResolvedValue({ enviados: 1, invalidos: ["bb22"], errores: [] });

    const r = await wallet.notificarCliente(cliente, negocio);
    expect(r).toEqual({ proveedor: "apple", avisados: 1, web: 0, google: 0 });
    expect(vi.mocked(enviarAvisos).mock.calls[0][0].sort()).toEqual(["aa11", "bb22"]);
    expect(vi.mocked(enviarAvisos).mock.calls[0][1].passTypeId).toBe(cadena.passTypeId);
    expect(await store.pushTokens({ seriales: [cliente.serial] })).toEqual(["aa11"]);
  });

  it("apple: tienda con Pass Type ID propio avisa a cada pase con SU certificado", async () => {
    stubApple();
    const propio = otroPassTypeDePrueba(cadena, "pass.dev.nube");
    vi.stubEnv("APPLE_PASS_TYPE_ID_NUBE", propio.passTypeId);
    vi.stubEnv("APPLE_PASS_CERT_NUBE", aBase64(propio.certPem));
    const { cliente, negocio } = await wallet.emitirPase("nube");
    // Uno instalado antes de tener ID propio (general) y otro después.
    await store.registrarPase({ dispositivo: "d1", pushToken: "aa11", passType: cadena.passTypeId, serial: cliente.serial, negocio: "nube" });
    await store.registrarPase({ dispositivo: "d2", pushToken: "bb22", passType: propio.passTypeId, serial: cliente.serial, negocio: "nube" });
    vi.mocked(enviarAvisos).mockResolvedValue({ enviados: 1, invalidos: [], errores: [] });

    expect(await wallet.notificarCliente(cliente, negocio)).toMatchObject({ avisados: 2 });
    const envios = vi.mocked(enviarAvisos).mock.calls.map(([tokens, c]) => [c.passTypeId, tokens]);
    expect(envios).toEqual(expect.arrayContaining([[propio.passTypeId, ["bb22"]], [cadena.passTypeId, ["aa11"]]]));
    expect(vi.mocked(enviarAvisos).mock.calls.find(([, c]) => c.passTypeId === propio.passTypeId)[1].cert).toBe(propio.certPem);

    vi.mocked(enviarAvisos).mockClear();
    expect(await wallet.notificarNegocio(negocio)).toMatchObject({ total: 2, enviadas: 2 });
    expect(vi.mocked(enviarAvisos)).toHaveBeenCalledTimes(2);
  });

  it("apple: si APNs falla no lanza (el estado ya está guardado)", async () => {
    stubApple();
    const { cliente, negocio } = await wallet.emitirPase("nube");
    await store.registrarPase({ dispositivo: "d1", pushToken: "aa11", passType: cadena.passTypeId, serial: cliente.serial, negocio: "nube" });
    vi.mocked(enviarAvisos).mockRejectedValue(new Error("red caída"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await wallet.notificarCliente(cliente, negocio);
    expect(r).toMatchObject({ proveedor: "apple", avisados: 0, error: "red caída" });
    errorLog.mockRestore();
  });

  it("apple: notificarNegocio marca todos como actualizados y avisa a su negocio", async () => {
    stubApple();
    const { cliente, negocio } = await wallet.emitirPase("nube");
    await store.registrarPase({ dispositivo: "d1", pushToken: "aa11", passType: cadena.passTypeId, serial: cliente.serial, negocio: "nube" });
    vi.mocked(enviarAvisos).mockResolvedValue({ enviados: 1, invalidos: [], errores: [] });
    const antes = (await store.getCliente(cliente.serial)).actualizado;
    await new Promise((r) => setTimeout(r, 5));

    const r = await wallet.notificarNegocio(negocio);
    expect(r).toEqual({ proveedor: "apple", total: 1, enviadas: 1, fallidas: [], web: 0, google: 0 });
    expect(Date.parse((await store.getCliente(cliente.serial)).actualizado)).toBeGreaterThan(Date.parse(antes));
  });

  it("walletwallet: PUT por cliente; demo: no hace nada", async () => {
    vi.stubEnv("WALLETWALLET_API_KEY", "ww_live_x");
    const { cliente, negocio } = await wallet.emitirPase("nube");
    expect(await wallet.notificarCliente(cliente, negocio)).toEqual({ proveedor: "walletwallet", avisados: 1, web: 0, google: 0 });
    expect(await wallet.notificarNegocio(negocio)).toMatchObject({ proveedor: "walletwallet", total: 1, enviadas: 1 });

    vi.stubEnv("WALLETWALLET_API_KEY", "");
    ww.updatePass.mockClear();
    expect(await wallet.notificarCliente(cliente, negocio)).toEqual({ proveedor: "demo", avisados: 0, web: 0, google: 0 });
    expect(await wallet.notificarNegocio(negocio)).toMatchObject({ proveedor: "demo", enviadas: 0 });
    expect(ww.updatePass).not.toHaveBeenCalled();
  });
});
