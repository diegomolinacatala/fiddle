import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizarUbicaciones, patchNegocio } from "@/lib/validacion";
import { loginBloqueado, anotarFalloLogin, ipDe, MAX_POR_IP, usoExcedido, LIMITES } from "@/lib/limitador";
import { buildPassBody } from "@/lib/walletwallet";
import { googleSaveUrl, hayGoogle } from "@/lib/googlewallet";
import { esNegocio, NEGOCIOS, configDefault } from "@/lib/negocios";
import { appUrl, urlCaja } from "@/lib/url";
import { generarClave } from "../scripts/lib/certs.mjs";

afterEach(() => vi.unstubAllEnvs());

describe("validación del manager", () => {
  it("normalizarUbicaciones", () => {
    expect(normalizarUbicaciones([{ lat: "40.41", lng: "-3.70", texto: "  Hola  " }])).toEqual([{ lat: 40.41, lng: -3.7, texto: "Hola" }]);
    expect(normalizarUbicaciones([])).toEqual([]);
    expect(normalizarUbicaciones([{ lat: 91, lng: 0 }])).toBeNull();
    expect(normalizarUbicaciones([{ lat: "", lng: "" }])).toBeNull();
    expect(normalizarUbicaciones("x")).toBeNull();
    expect(normalizarUbicaciones(Array.from({ length: 11 }, () => ({ lat: 1, lng: 1 })))).toBeNull();
  });

  it("patchNegocio limita y filtra", () => {
    const { patch } = patchNegocio({ meta: 99.6, premio: "  x  ", acciones: ["sellar", "hack", "sellar"], promo: "" }, ["sellar", "canjear"]);
    expect(patch).toEqual({ meta: 50, premio: "x", acciones: ["sellar"], promo: null });
    expect(patchNegocio({ ubicaciones: [{ lat: "a" }] }, []).error).toMatch(/Ubicaciones/);
    expect(patchNegocio(null, []).patch).toEqual({});
  });
});

describe("limitador de login", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-lim-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("bloquea tras MAX_POR_IP fallos de la misma IP en el mismo negocio", async () => {
    for (let i = 0; i < MAX_POR_IP; i++) await anotarFalloLogin("nube", "1.1.1.1");
    expect(await loginBloqueado("nube", "1.1.1.1")).toBe(true);
    expect(await loginBloqueado("nube", "2.2.2.2")).toBe(false);
    expect(await loginBloqueado("fade", "1.1.1.1")).toBe(false);
    expect(await loginBloqueado("nube", "1.1.1.1", Date.now() + 16 * 60 * 1000)).toBe(false);
  });

  it("usoExcedido cuenta y corta al pasar el límite de tap", async () => {
    const resultados = [];
    for (let i = 0; i < LIMITES.tap.max + 1; i++) resultados.push(await usoExcedido("tap", "3.3.3.3"));
    expect(resultados.slice(0, LIMITES.tap.max).every((r) => r === false)).toBe(true);
    expect(resultados.at(-1)).toBe(true);
    expect(await usoExcedido("tap", "4.4.4.4")).toBe(false);
    expect(await usoExcedido("tap", "3.3.3.3", Date.now() + LIMITES.tap.ventanaMs + 1000)).toBe(false);
  });

  it("ipDe usa el primer x-forwarded-for", () => {
    expect(ipDe(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }))).toBe("9.9.9.9");
    expect(ipDe(new Request("http://x", { headers: { "x-real-ip": "8.8.8.8" } }))).toBe("8.8.8.8");
    expect(ipDe(new Request("http://x"))).toBeNull();
  });
});

describe("negocios y url", () => {
  it("esNegocio no acepta propiedades heredadas", () => {
    expect(esNegocio("nube")).toBe(true);
    expect(esNegocio("constructor")).toBe(false);
    expect(esNegocio(null)).toBe(false);
    expect(configDefault("fade").ubicaciones).toEqual([]);
  });

  it("appUrl quita barras finales", () => {
    vi.stubEnv("APP_URL", "https://a.b///");
    expect(appUrl()).toBe("https://a.b");
    expect(urlCaja("s1")).toBe("https://a.b/w/s1");
  });
});

describe("walletwallet buildPassBody", () => {
  const nube = { ...NEGOCIOS.nube, promo: "2x1" };
  it("sellos con nombre y promo", () => {
    const b = buildPassBody({ serial: "s", sellos: 9, premios: 2, nombre: "Ana" }, nube);
    expect(b.headerFields[0]).toEqual({ label: "Cliente", value: "Ana" });
    expect(b.primaryFields[0].value).toBe("8 / 8");
    expect(b.backFields[0].label).toBe("Promoción");
    expect(b.backFields.at(-1)).toEqual({ label: "Canjeados", value: "2" });
  });
  it("cupón usado", () => {
    const b = buildPassBody({ serial: "s", sellos: 0, premios: 1 }, { ...NEGOCIOS.forno, promo: null });
    expect(b.secondaryFields[0].value).toBe("Ya usado");
  });
});

describe("google wallet", () => {
  it("sin credenciales no hay enlace", () => {
    expect(hayGoogle()).toBe(false);
    expect(googleSaveUrl({ serial: "s" }, NEGOCIOS.nube)).toBeNull();
  });

  it("con credenciales genera un JWT RS256 con el objeto del cliente", () => {
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "338800");
    vi.stubEnv("GOOGLE_WALLET_SA_EMAIL", "sa@x.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_WALLET_SA_KEY", generarClave().keyPem.replace(/\n/g, "\\n"));
    const url = googleSaveUrl({ serial: "s1", sellos: 3, premios: 0, nombre: "Ana" }, { ...NEGOCIOS.nube, meta: 8 });
    expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    const payload = JSON.parse(Buffer.from(url.split("/").pop().split(".")[1], "base64url").toString());
    expect(payload.payload.loyaltyObjects[0]).toMatchObject({
      id: "338800.s1", classId: "338800.nube", accountName: "Ana", loyaltyPoints: { balance: { string: "3/8" } },
    });
  });
});
