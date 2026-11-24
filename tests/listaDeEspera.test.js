import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ============================================================================
// LA LISTA DE ESPERA (lib/listaDeEspera.js): el cliente 51 de una tienda gratis
// deja su correo, y le llega cuando la tienda puede darle la tarjeta. Backend de
// ficheros y un Resend de mentira (fetch).
// ============================================================================

const store = await import("@/lib/store");
const { emitirPase } = await import("@/lib/wallet");
const { validarPlanes, normalizarPlanes } = await import("@/lib/planes");
const { apuntarEnEspera, atenderEspera, atenderTodas, correoDeTarjeta, enlaceDeTienda } = await import("@/lib/listaDeEspera");
const { limpiezaDiaria } = await import("@/lib/limpieza");
const { POST } = await import("@/app/api/espera/route");

const MES = 30 * 86400000;
let dir;
let mandados;

// Nube en Gratis con sitio para 2 tarjetas, y llena.
async function nubeLlena() {
  const r = validarPlanes({ ...normalizarPlanes(null), gratis: { ...normalizarPlanes(null).gratis, maxTarjetas: 2 } });
  await store.guardarPlanes(r.planes);
  await store.saveNegocio("nube", { plan: "gratis" });
  await emitirPase("nube", { origen: "tap" });
  await emitirPase("nube", { origen: "tap" });
}

const pedir = (cuerpo, { slug = "nube", sitio = "same-origin" } = {}) =>
  new Request(`http://localhost/api/espera?b=${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "sec-fetch-site": sitio, "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify(cuerpo),
  });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fiddle-espera-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "");
  vi.stubEnv("RESEND_API_KEY", "re_prueba");
  vi.stubEnv("CORREO_DESDE", "fiddle <hola@ejemplo.test>");
  vi.stubEnv("APP_URL", "https://fiddle.test");
  store.olvidarPlanes();
  mandados = [];
  vi.stubGlobal("fetch", vi.fn(async (url, opciones) => {
    if (String(url).startsWith("https://api.resend.com/")) {
      mandados.push(JSON.parse(opciones.body));
      return new Response("{}", { status: 200 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  store.olvidarPlanes();
  rmSync(dir, { recursive: true, force: true });
});

describe("apuntarse", () => {
  it("solo si la tienda está llena: con sitio, que la saque ya", async () => {
    expect(await apuntarEnEspera("nube", "ana@correo.test")).toMatchObject({ status: 409, hayCupo: true });
    expect(await store.contarEspera("nube")).toBe(0);
  });

  it("con la tienda llena se guarda el correo, cifrado, una sola vez", async () => {
    vi.stubEnv("CIFRADO_CLAVE", Buffer.alloc(32, 7).toString("base64"));
    await nubeLlena();
    expect(await apuntarEnEspera("nube", "  Ana@Correo.test ")).toEqual({ ok: true });
    expect(await apuntarEnEspera("nube", "ana@correo.test")).toEqual({ ok: true, yaEstaba: true });
    const lista = await store.listEspera("nube");
    expect(lista.map((f) => f.email)).toEqual(["ana@correo.test"]);
    // En el fichero no está en claro.
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(path.join(dir, "espera.json"), "utf8")).not.toContain("ana@correo.test");
  });

  it("un correo que no lo parece, o una tienda que no existe, no", async () => {
    await nubeLlena();
    expect(await apuntarEnEspera("nube", "ana")).toMatchObject({ status: 400 });
    expect(await apuntarEnEspera("no-existe", "ana@correo.test")).toMatchObject({ status: 404 });
  });

  it("la ruta: desde otra web no, y responde lo de la lista", async () => {
    await nubeLlena();
    expect((await POST(pedir({ email: "ana@correo.test" }, { sitio: "cross-site" }))).status).toBe(403);
    const r = await POST(pedir({ email: "ana@correo.test" }));
    expect(r.status).toBe(200);
    expect(await store.contarEspera("nube")).toBe(1);
  });
});

describe("mandar la tarjeta a quien espera", () => {
  it("con la tienda llena no se manda nada; al pasar a Pro, a todos, y se borran", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "ana@correo.test");
    await apuntarEnEspera("nube", "luis@correo.test");
    expect(await atenderEspera("nube")).toMatchObject({ mandados: 0, esperan: 2 });
    expect(mandados).toHaveLength(0);

    await store.saveNegocio("nube", { plan: "pro" });
    expect(await atenderEspera("nube")).toMatchObject({ mandados: 2, esperan: 0 });
    expect(mandados.map((m) => m.to[0])).toEqual(["ana@correo.test", "luis@correo.test"]);
    // A la página de la tienda, no al tap: un antivirus que abre el enlace no saca tarjetas.
    expect(mandados[0].text).toContain("https://fiddle.test/nube");
    expect(mandados[0].text).not.toContain("/api/tap");
    expect(await store.contarEspera("nube")).toBe(0);
  });

  it("una tienda gratis que libera sitio NO escribe: solo Pro (nadie usa una gratis para mandar correos)", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "a@correo.test");
    // Se libera sitio: el límite sube a 3. Sigue siendo Gratis.
    const r = validarPlanes({ ...normalizarPlanes(null), gratis: { ...normalizarPlanes(null).gratis, maxTarjetas: 3 } });
    await store.guardarPlanes(r.planes);
    store.olvidarPlanes();
    expect(await atenderTodas()).toEqual({});
    expect(mandados).toHaveLength(0);
    expect(await store.contarEspera("nube")).toBe(1);
  });

  it("en el orden en que se apuntaron y como mucho los de una pasada; el resto, en la siguiente", async () => {
    await nubeLlena();
    for (const quien of ["a", "b", "c"]) await apuntarEnEspera("nube", `${quien}@correo.test`);
    await store.saveNegocio("nube", { plan: "pro" });
    expect(await atenderEspera("nube", { max: 2 })).toMatchObject({ mandados: 2, esperan: 1 });
    expect(mandados.map((m) => m.to[0])).toEqual(["a@correo.test", "b@correo.test"]);
    expect(await atenderTodas()).toEqual({ nube: { mandados: 1, esperan: 0 } });
    expect(mandados.map((m) => m.to[0])).toEqual(["a@correo.test", "b@correo.test", "c@correo.test"]);
  });

  it("una dirección que Resend rechaza sale de la cola y no tapa a los demás", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "mala@correo.test");
    await apuntarEnEspera("nube", "buena@correo.test");
    await store.saveNegocio("nube", { plan: "pro" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url, opciones) => {
      const correo = JSON.parse(opciones.body);
      if (correo.to[0].startsWith("mala")) return new Response("{}", { status: 422 });
      mandados.push(correo);
      return new Response("{}", { status: 200 });
    }));
    expect(await atenderEspera("nube")).toMatchObject({ mandados: 1, esperan: 0 });
    expect(mandados.map((m) => m.to[0])).toEqual(["buena@correo.test"]);
    expect(await store.contarEspera("nube")).toBe(0);
  });

  it("si dos pasadas atienden la lista a la vez, cada uno recibe un solo correo", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "a@correo.test");
    await apuntarEnEspera("nube", "b@correo.test");
    await store.saveNegocio("nube", { plan: "pro" });
    await Promise.all([atenderEspera("nube"), atenderEspera("nube")]);
    expect(mandados.map((m) => m.to[0]).sort()).toEqual(["a@correo.test", "b@correo.test"]);
  });

  it("sin proveedor de correo no se da a nadie por avisado", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "ana@correo.test");
    await store.saveNegocio("nube", { plan: "pro" });
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await atenderEspera("nube")).toMatchObject({ mandados: 0, esperan: 1, sinCorreo: true });
    expect(await store.contarEspera("nube")).toBe(1);
  });

  it("si Resend falla por algo pasajero (o es nuestra clave), se queda en la lista en su sitio", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "ana@correo.test");
    await store.saveNegocio("nube", { plan: "pro" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [500, 429, 401]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status })));
      expect(await atenderEspera("nube")).toMatchObject({ mandados: 0, esperan: 1 });
      expect((await store.listEspera("nube")).map((f) => f.email)).toEqual(["ana@correo.test"]);
    }
  });

  it("el correo lleva el nombre de la tienda y el enlace del mostrador", () => {
    const c = correoDeTarjeta({ slug: "nube", nombre: "Nube" });
    expect(c.asunto).toContain("Nube");
    expect(c.texto).toContain(enlaceDeTienda("nube"));
    expect(c.texto).toMatch(/borrado/);
  });
});

describe("lo que se borra solo", () => {
  it("a los 6 meses, el correo de quien nunca recibió la tarjeta", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "ana@correo.test");
    expect((await limpiezaDiaria({ forzar: true, ahora: Date.now() + 5 * MES })).esperaBorrados).toBe(0);
    expect((await limpiezaDiaria({ forzar: true, ahora: Date.now() + 7 * MES })).esperaBorrados).toBe(1);
    expect(await store.contarEspera("nube")).toBe(0);
  });

  it("al borrar la tienda, su lista también", async () => {
    await nubeLlena();
    await apuntarEnEspera("nube", "ana@correo.test");
    await store.borrarNegocio("nube");
    expect(await store.contarEspera("nube")).toBe(0);
  });
});
