import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPublicKey, createVerify } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { construirClase, construirObjeto, idClase, idObjeto } from "@/lib/google/pase";
import { configGoogle, faltanVariablesGoogle } from "@/lib/google/config";
import * as api from "@/lib/google/api";
import { diagnosticoGoogle } from "@/lib/diagnostico";
import { componerNegocio } from "@/lib/negocios";
import { generarClave } from "../scripts/lib/certs.mjs";

const ISSUER = "3388000000022123456";
const APP = "https://fiddle.app";
const { keyPem } = generarClave();
const CONFIG = { issuerId: ISSUER, email: "sa@p.iam.gserviceaccount.com", key: keyPem };
const nube = componerNegocio("nube", null);
const forno = componerNegocio("forno", null);
const cliente = { serial: "55d5c71d-109d-48a7-91f1-6b3fc322e4b9", codigo: "K7M", sellos: 3, premios: 1, nombre: "Ana", mensaje: null };

const decodificar = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

afterEach(() => vi.unstubAllEnvs());

describe("clase y objeto (puros)", () => {
  it("la clase es la tienda: nombre, logo por URL con huella, color y cómo funciona", () => {
    const c = construirClase({ ...nube, ubicaciones: [{ lat: 40.4, lng: -3.7 }] }, { issuerId: ISSUER, appUrl: APP });
    expect(c).toMatchObject({
      id: `${ISSUER}.nube`,
      issuerName: "Nube Café",
      programName: "Nube Café",
      hexBackgroundColor: "#ff5c8a",
      reviewStatus: "UNDER_REVIEW",
      merchantLocations: [{ latitude: 40.4, longitude: -3.7 }],
      textModulesData: [{ id: "como", header: "Cómo funciona", body: nube.tema.atras }],
    });
    expect(c.programLogo.sourceUri.uri).toMatch(new RegExp(`^${APP}/api/imagen/logo\\?b=nube&v=`));
    expect(c).not.toHaveProperty("messages");
  });

  it("la promo va como mensaje de la clase, salvo en la versión 'sin mensajes'", () => {
    const conPromo = { ...nube, promo: "2x1 hoy" };
    expect(construirClase(conPromo, { issuerId: ISSUER, appUrl: APP }).messages)
      .toEqual([{ id: "promo", header: "Promo", body: "2x1 hoy", messageType: "TEXT" }]);
    expect(construirClase(conPromo, { issuerId: ISSUER, appUrl: APP }, { conMensajes: false })).not.toHaveProperty("messages");
  });

  it("el objeto es la tarjeta: puntos, banda con los sellos, código y el mismo texto del premio que Apple", () => {
    const o = construirObjeto(cliente, nube, { issuerId: ISSUER, appUrl: APP });
    expect(o).toMatchObject({
      id: idObjeto(ISSUER, cliente.serial),
      classId: idClase(ISSUER, "nube"),
      state: "ACTIVE",
      accountId: "K7M",
      accountName: "Ana",
      loyaltyPoints: { label: "Sellos", balance: { string: "3/8" } },
      secondaryLoyaltyPoints: { label: "Premios", balance: { int: 1 } },
      barcode: { type: "QR_CODE", value: `${APP}/w/${cliente.serial}`, alternateText: "K7M" },
      textModulesData: [{ id: "premio", header: "Premio", body: "Faltan 5 · café gratis" }],
    });
    expect(o.heroImage.sourceUri.uri).toMatch(/\/api\/imagen\/banda\?b=nube&s=3&v=/);
    expect(o.linksModuleData.uris[0].uri).toBe(`${APP}/p/${cliente.serial}`);
    expect(o).not.toHaveProperty("messages");
  });

  it("sin nombre no hay titular; con campaña, mensaje 'Para ti'", () => {
    const o = construirObjeto({ ...cliente, nombre: null, mensaje: "Vuelve pronto" }, nube, { issuerId: ISSUER, appUrl: APP });
    expect(o).not.toHaveProperty("accountName");
    expect(o.messages).toEqual([{ id: "para-ti", header: "Para ti", body: "Vuelve pronto", messageType: "TEXT" }]);
  });

  it("un cupón usado pasa a caducados, como el pase anulado de Apple", () => {
    const valido = construirObjeto({ ...cliente, premios: 0 }, forno, { issuerId: ISSUER, appUrl: APP });
    const usado = construirObjeto({ ...cliente, premios: 1 }, forno, { issuerId: ISSUER, appUrl: APP });
    expect(valido).toMatchObject({ state: "ACTIVE", loyaltyPoints: { label: "Cupón", balance: { string: "Válido" } } });
    expect(valido).not.toHaveProperty("secondaryLoyaltyPoints");
    expect(usado).toMatchObject({ state: "INACTIVE", loyaltyPoints: { balance: { string: "Usado" } } });
    expect(usado.heroImage.sourceUri.uri).toMatch(/[?&]u=1/);
  });
});

describe("configuración", () => {
  it("email + clave, o el JSON de la cuenta de servicio (tal cual o en base64)", () => {
    expect(faltanVariablesGoogle()).toHaveLength(3);
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER);
    vi.stubEnv("GOOGLE_WALLET_SA_EMAIL", CONFIG.email);
    vi.stubEnv("GOOGLE_WALLET_SA_KEY", keyPem.replace(/\n/g, "\\n"));
    // La clave se lee como el resto de PEM de la app (leerPem); el salto final da igual.
    const esperada = { ...CONFIG, key: keyPem.trim() };
    const leida = () => { const c = configGoogle(); return { ...c, key: c.key.trim() }; };
    expect(leida()).toEqual(esperada);

    vi.stubEnv("GOOGLE_WALLET_SA_EMAIL", "");
    vi.stubEnv("GOOGLE_WALLET_SA_KEY", "");
    const json = JSON.stringify({ type: "service_account", client_email: CONFIG.email, private_key: keyPem });
    vi.stubEnv("GOOGLE_WALLET_SA_JSON", json);
    expect(leida()).toEqual(esperada);
    vi.stubEnv("GOOGLE_WALLET_SA_JSON", Buffer.from(json).toString("base64"));
    expect(leida()).toEqual(esperada);
  });

  it("diagnóstico: sin configurar no es un fallo; con credenciales pide un token de verdad", async () => {
    expect(await diagnosticoGoogle()).toMatchObject({ ok: false, configurado: false });

    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER);
    expect(await diagnosticoGoogle()).toMatchObject({ ok: false, configurado: true, detalle: expect.stringMatching(/Faltan variables/) });

    vi.stubEnv("GOOGLE_WALLET_SA_EMAIL", CONFIG.email);
    vi.stubEnv("GOOGLE_WALLET_SA_KEY", keyPem);
    expect(await diagnosticoGoogle({ comprobar: async () => "token" })).toMatchObject({ ok: true, detalle: expect.stringContaining(ISSUER) });
    expect(await diagnosticoGoogle({ comprobar: async () => { throw new Error("invalid_grant"); } }))
      .toMatchObject({ ok: false, detalle: expect.stringMatching(/invalid_grant/) });

    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "no-es-un-numero");
    expect((await diagnosticoGoogle({ comprobar: async () => "token" })).detalle).toMatch(/número largo/);
  });
});

describe("JWT y enlace de guardar", () => {
  it("firmarJwt es un RS256 que valida con la clave pública", () => {
    const jwt = api.firmarJwt({ a: 1 }, keyPem);
    const [cab, cuerpo, firma] = jwt.split(".");
    expect(JSON.parse(Buffer.from(cab, "base64url"))).toEqual({ alg: "RS256", typ: "JWT" });
    const ok = createVerify("RSA-SHA256").update(`${cab}.${cuerpo}`).verify(createPublicKey(keyPem), Buffer.from(firma, "base64url"));
    expect(ok).toBe(true);
  });

  it("corto (solo el id: el objeto ya existe) o completo (si la API falló)", () => {
    const corto = api.enlaceGuardar(CONFIG, cliente, nube, { appUrl: APP });
    expect(corto).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    expect(corto.length).toBeLessThan(1800); // el límite práctico de una URL
    const c = decodificar(corto.split("/").pop());
    expect(c).toMatchObject({ iss: CONFIG.email, aud: "google", typ: "savetowallet", origins: [APP] });
    expect(c.payload).toEqual({ loyaltyObjects: [{ id: idObjeto(ISSUER, cliente.serial), classId: idClase(ISSUER, "nube") }] });

    const completo = decodificar(api.enlaceGuardar(CONFIG, cliente, nube, { appUrl: APP, completo: true }).split("/").pop());
    expect(completo.payload.loyaltyClasses[0].id).toBe(idClase(ISSUER, "nube"));
    expect(completo.payload.loyaltyObjects[0].loyaltyPoints.balance.string).toBe("3/8");
  });
});

// Google simulado: responde según el método y la ruta, y apunta cada llamada.
function googleFalso({ clase = 200, objeto = 200 } = {}) {
  const llamadas = [];
  const respuesta = (status, json = {}) => ({ ok: status < 300, status, json: async () => json });
  const f = vi.fn(async (url, init = {}) => {
    // El del token va como formulario; el resto, JSON.
    const cuerpo = init.body && !String(url).includes("oauth2") ? JSON.parse(init.body) : init.body;
    llamadas.push({ metodo: init.method, url: String(url), cuerpo });
    if (String(url).includes("oauth2")) return respuesta(200, { access_token: "tok", expires_in: 3600 });
    if (init.method === "PUT" && url.includes("/loyaltyClass/")) return respuesta(clase);
    if (init.method === "PUT" && url.includes("/loyaltyObject/")) return respuesta(objeto);
    return respuesta(200, {});
  });
  return { f, llamadas };
}

describe("API REST (con Google simulado)", () => {
  beforeEach(() => api.olvidarEstado());

  it("el token se pide una vez y se reutiliza", async () => {
    const { f, llamadas } = googleFalso();
    expect(await api.tokenDeAcceso(CONFIG, { fetch: f, ahora: 1e12 })).toBe("tok");
    expect(await api.tokenDeAcceso(CONFIG, { fetch: f, ahora: 1e12 + 60_000 })).toBe("tok");
    expect(llamadas).toHaveLength(1);
    const assertion = new URLSearchParams(llamadas[0].cuerpo).get("assertion");
    expect(decodificar(assertion)).toMatchObject({ iss: CONFIG.email, scope: "https://www.googleapis.com/auth/wallet_object.issuer" });
  });

  it("asegurarClase: crea si no existe (404 -> POST) y no repite si nada cambió", async () => {
    const { f, llamadas } = googleFalso({ clase: 404 });
    await api.asegurarClase(CONFIG, nube, { fetch: f, appUrl: APP });
    expect(llamadas.slice(1).map((l) => `${l.metodo} ${l.url.split("/v1/")[1]}`)).toEqual([
      `PUT loyaltyClass/${ISSUER}.nube`,
      "POST loyaltyClass",
    ]);
    await api.asegurarClase(CONFIG, nube, { fetch: f, appUrl: APP });
    expect(llamadas).toHaveLength(3); // la segunda vez, ni una llamada
  });

  it("actualizarObjeto: pide aviso si toca y dice false si el cliente nunca lo guardó", async () => {
    const { f, llamadas } = googleFalso();
    expect(await api.actualizarObjeto(CONFIG, cliente, nube, { fetch: f, appUrl: APP, notificar: true })).toBe(true);
    const put = llamadas.find((l) => l.url.includes("/loyaltyObject/"));
    expect(put.cuerpo).toMatchObject({ notifyPreference: "NOTIFY_ON_UPDATE", loyaltyPoints: { balance: { string: "3/8" } } });

    const g404 = googleFalso({ objeto: 404 });
    expect(await api.actualizarObjeto(CONFIG, cliente, nube, { fetch: g404.f, appUrl: APP })).toBe(false);
    expect(g404.llamadas.some((l) => l.metodo === "POST" && l.url.endsWith("/loyaltyObject"))).toBe(false);
  });

  it("guardarObjeto crea el objeto si no existe; los errores de Google se lanzan con su mensaje", async () => {
    const { f, llamadas } = googleFalso({ objeto: 404 });
    expect(await api.guardarObjeto(CONFIG, cliente, nube, { fetch: f, appUrl: APP })).toBe(idObjeto(ISSUER, cliente.serial));
    expect(llamadas.at(-1)).toMatchObject({ metodo: "POST", url: expect.stringMatching(/\/loyaltyObject$/) });

    api.olvidarEstado();
    const roto = vi.fn(async (url) => (String(url).includes("oauth2")
      ? { ok: true, status: 200, json: async () => ({ access_token: "t" }) }
      : { ok: false, status: 400, json: async () => ({ error: { message: "Invalid hexBackgroundColor" } }) }));
    await expect(api.guardarObjeto(CONFIG, cliente, nube, { fetch: roto, appUrl: APP })).rejects.toThrow(/Invalid hexBackgroundColor/);
  });

  it("campaña: objeto sin mensajes y luego addMessage con aviso (sin duplicarlo)", async () => {
    const { f, llamadas } = googleFalso();
    await api.avisarObjeto(CONFIG, { ...cliente, mensaje: "Vuelve" }, nube, "Para ti", "Vuelve", { fetch: f, appUrl: APP });
    const put = llamadas.find((l) => l.metodo === "PUT" && l.url.includes("/loyaltyObject/"));
    expect(put.cuerpo).not.toHaveProperty("messages");
    const add = llamadas.at(-1);
    expect(add.url).toMatch(/\/loyaltyObject\/.+\/addMessage$/);
    expect(add.cuerpo).toEqual({ message: { id: "para-ti", header: "Para ti", body: "Vuelve", messageType: "TEXT_AND_NOTIFY" } });
  });

  it("promo: la clase sin mensajes y addMessage con aviso a todos", async () => {
    const { f, llamadas } = googleFalso();
    await api.avisarClase(CONFIG, { ...nube, promo: "2x1" }, "Promo", "2x1", { fetch: f, appUrl: APP });
    const put = llamadas.find((l) => l.metodo === "PUT");
    expect(put.cuerpo).not.toHaveProperty("messages");
    expect(llamadas.at(-1)).toMatchObject({
      url: expect.stringMatching(/\/loyaltyClass\/.+\/addMessage$/),
      cuerpo: { message: { id: "promo", body: "2x1", messageType: "TEXT_AND_NOTIFY" } },
    });
  });
});

describe("fachada googlewallet (store en ficheros)", () => {
  let dir;
  beforeEach(() => {
    api.olvidarEstado();
    dir = mkdtempSync(path.join(tmpdir(), "sellos-google-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("APP_URL", APP);
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER);
    vi.stubEnv("GOOGLE_WALLET_SA_EMAIL", CONFIG.email);
    vi.stubEnv("GOOGLE_WALLET_SA_KEY", keyPem);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  it("guardar apunta el canal Google (y la instalación); después cada sello actualiza el objeto", async () => {
    const { f, llamadas } = googleFalso();
    vi.stubGlobal("fetch", f);
    const gw = await import("@/lib/googlewallet");
    const store = await import("@/lib/store");
    const wallet = await import("@/lib/wallet");

    const { cliente: c, negocio } = await wallet.emitirPase("nube");
    const url = await gw.prepararGuardado(c, negocio);
    expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    expect(await store.pushTokens({ seriales: [c.serial], passType: "google" })).toEqual([idObjeto(ISSUER, c.serial)]);
    expect((await store.getCliente(c.serial)).instalado).toBeTruthy();

    llamadas.length = 0;
    const r = await wallet.notificarCliente({ ...c, sellos: 1 }, negocio, { antes: c });
    expect(r.google).toBe(1);
    expect(llamadas.find((l) => l.url.includes("/loyaltyObject/")).cuerpo).toMatchObject({ notifyPreference: "NOTIFY_ON_UPDATE" });
  });

  it("si Google falla al crear el objeto, el cliente recibe el enlace completo igualmente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("sin red"); }));
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    const gw = await import("@/lib/googlewallet");
    const wallet = await import("@/lib/wallet");
    const { cliente: c, negocio } = await wallet.emitirPase("nube");
    const url = await gw.prepararGuardado(c, negocio);
    expect(decodificar(url.split("/").pop()).payload).toHaveProperty("loyaltyClasses");
    errores.mockRestore();
  });

  it("un cliente sin Google no genera ni una llamada a Google al sellar", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const wallet = await import("@/lib/wallet");
    const { cliente: c, negocio } = await wallet.emitirPase("nube");
    expect((await wallet.notificarCliente({ ...c, sellos: 1 }, negocio, { antes: c })).google).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
});
