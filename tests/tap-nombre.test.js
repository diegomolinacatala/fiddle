import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { nombreDeCliente } from "@/lib/validacion";

// El escaneo pide el nombre antes de dar la tarjeta: /api/tap ya no la crea al
// abrirlo, lo hace el POST del formulario de la página de la tienda.
const tap = await import("@/app/api/tap/route.js");
const store = await import("@/lib/store");
const { cadenaDePrueba, aBase64 } = await import("../scripts/lib/certs.mjs");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/128 Mobile";

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-tap-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  vi.stubEnv("WALLETWALLET_API_KEY", "");
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "");
  vi.stubEnv("CIFRADO_CLAVE", Buffer.alloc(32, 7).toString("base64"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function pedir(ruta, { metodo = "GET", json, form, cookie, ua = IPHONE, cabeceras = {} } = {}) {
  const headers = { "user-agent": ua, ...cabeceras };
  if (cookie) headers.cookie = cookie;
  let body;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(json);
  }
  if (form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  return new NextRequest(`https://sellos.app${ruta}`, { method: metodo, headers, body });
}

const tarjetaDe = (res) => res.cookies.get("tarjeta_nube")?.value;
const cookieDe = (serial) => `tarjeta_nube=${serial}`;
const destino = (res) => res.headers.get("location");

async function alta(nombre = "Marta", opciones = {}) {
  const res = await tap.POST(pedir("/api/tap?b=nube", { metodo: "POST", json: { nombre }, ...opciones }));
  return { res, serial: tarjetaDe(res) };
}

describe("nombreDeCliente", () => {
  it("recorta, junta espacios y quita lo invisible", () => {
    expect(nombreDeCliente("  Marta  ")).toBe("Marta");
    expect(nombreDeCliente("Ana\n\tMaría")).toBe("Ana María");
    expect(nombreDeCliente("‮atram")).toBe("atram");
  });

  it("vacío o sin texto es null", () => {
    for (const v of ["", "   ", "​", null, undefined, 42, {}]) expect(nombreDeCliente(v)).toBeNull();
  });

  it("corta a 48 letras sin partir ninguna", () => {
    expect(nombreDeCliente("x".repeat(60))).toHaveLength(48);
    const largo = nombreDeCliente("𝒜".repeat(60));
    expect(Array.from(largo)).toHaveLength(48);
    expect(largo.endsWith("𝒜")).toBe(true);
  });
});

describe("GET /api/tap", () => {
  it("sin tarjeta lleva a la página de la tienda y no crea nada", async () => {
    const res = await tap.GET(pedir("/api/tap?b=nube"));
    expect(res.status).toBe(302);
    expect(destino(res)).toBe("https://sellos.app/nube");
    expect(tarjetaDe(res)).toBeUndefined();
    expect(await store.listClientes("nube")).toHaveLength(0);
  });

  it("?nuevo=1 llega a la página, que pide el nombre aunque ya tenga una", async () => {
    const { serial } = await alta();
    const res = await tap.GET(pedir("/api/tap?b=nube&nuevo=1", { cookie: cookieDe(serial) }));
    expect(destino(res)).toBe("https://sellos.app/nube?nuevo=1");
  });

  it("con tarjeta devuelve la suya: Android a su tarjeta web", async () => {
    const { serial } = await alta();
    const res = await tap.GET(pedir("/api/tap?b=nube", { cookie: cookieDe(serial), ua: ANDROID }));
    expect(destino(res)).toBe(`https://sellos.app/p/${serial}`);
    expect(tarjetaDe(res)).toBe(serial);
  });

  it("con tarjeta y Apple configurado, el iPhone va directo a su .pkpass", async () => {
    const cadena = cadenaDePrueba();
    vi.stubEnv("APPLE_PASS_TYPE_ID", cadena.passTypeId);
    vi.stubEnv("APPLE_TEAM_ID", cadena.teamId);
    vi.stubEnv("APPLE_PASS_CERT", aBase64(cadena.certPem));
    vi.stubEnv("APPLE_PASS_KEY", aBase64(cadena.keyPem));
    vi.stubEnv("APPLE_WWDR_CERT", aBase64(cadena.wwdrPem));
    const { serial } = await alta();
    const res = await tap.GET(pedir("/api/tap?b=nube", { cookie: cookieDe(serial) }));
    expect(destino(res)).toBe(`https://sellos.app/api/pase/${serial}`);
  });

  it("la tarjeta de otra tienda no cuenta", async () => {
    const { serial } = await alta();
    const res = await tap.GET(pedir("/api/tap?b=fade", { cookie: `tarjeta_fade=${serial}` }));
    expect(destino(res)).toBe("https://sellos.app/fade");
  });
});

describe("POST /api/tap", () => {
  it("crea la tarjeta con el nombre, cifrado en la base, y la recuerda", async () => {
    const { res, serial } = await alta("  Marta ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ir: "/nube" });
    expect(await store.getCliente(serial)).toMatchObject({ negocio: "nube", nombre: "Marta", origen: "tap", sellos: 0 });
    const enDisco = JSON.parse(readFileSync(path.join(dir, "clientes.json"), "utf8"))[serial];
    expect(enDisco.nombre).toMatch(/^v1:/);
  });

  it("sin nombre no hay tarjeta: 400 en JSON; el formulario vuelve a la página", async () => {
    const { res } = await alta("   ");
    expect(res.status).toBe(400);
    const form = await tap.POST(pedir("/api/tap?b=nube", { metodo: "POST", form: { nombre: "" } }));
    expect(form.status).toBe(303);
    expect(destino(form)).toBe("https://sellos.app/nube");
    expect(await store.listClientes("nube")).toHaveLength(0);
  });

  it("sin JavaScript: el formulario crea la tarjeta y vuelve a la página", async () => {
    const res = await tap.POST(pedir("/api/tap?b=nube", { metodo: "POST", form: { nombre: "Luis" } }));
    expect(res.status).toBe(303);
    expect(destino(res)).toBe("https://sellos.app/nube");
    expect((await store.getCliente(tarjetaDe(res))).nombre).toBe("Luis");
  });

  it("enviarlo otra vez con la tarjeta ya puesta no crea otra ni cambia el nombre", async () => {
    const { serial } = await alta("Marta");
    const { serial: otra } = await alta("Otra", { cookie: cookieDe(serial) });
    expect(otra).toBe(serial);
    expect(await store.listClientes("nube")).toHaveLength(1);
    expect((await store.getCliente(serial)).nombre).toBe("Marta");
  });

  it("?nuevo=1 da otra tarjeta y la recuerda en su lugar", async () => {
    const { serial } = await alta("Marta");
    const res = await tap.POST(pedir("/api/tap?b=nube&nuevo=1", { metodo: "POST", json: { nombre: "Prueba" }, cookie: cookieDe(serial) }));
    expect(tarjetaDe(res)).not.toBe(serial);
    expect(await store.listClientes("nube")).toHaveLength(2);
  });

  it("desde otra web, no", async () => {
    const { res } = await alta("Marta", { cabeceras: { "sec-fetch-site": "cross-site" } });
    expect(res.status).toBe(403);
    expect(await store.listClientes("nube")).toHaveLength(0);
  });

  it("tienda que no existe: 404", async () => {
    const res = await tap.POST(pedir("/api/tap?b=noexiste", { metodo: "POST", json: { nombre: "Marta" } }));
    expect(res.status).toBe(404);
  });
});
