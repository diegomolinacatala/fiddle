import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// POST /api/login POR SU RUTA (docs/AUDITORIA-ACCESOS.md, lote 1)
// ----------------------------------------------------------------------------
// A dónde manda a cada rol, qué `next` respeta, que un fallo cuenta y al
// undécimo bloquea (también con la contraseña buena), que una tienda archivada
// no entra, y que sin AUTH_SECRET en producción nadie entra (503). En modo
// pruebas la contraseña es el usuario (nube/nube).
// ============================================================================

const store = await import("@/lib/store");
const login = await import("@/app/api/login/route.js");

const SERIAL_NUBE = "8a1f6c2e-0000-4000-8000-000000000001";
const SERIAL_FADE = "8a1f6c2e-0000-4000-8000-000000000002";

let dir;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "login-ruta-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("AUTH_SECRET", "");
  await store.crearCliente({ serial: SERIAL_NUBE, negocio: "nube", authToken: "t".repeat(32) });
  await store.crearCliente({ serial: SERIAL_FADE, negocio: "fade", authToken: "u".repeat(32) });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

async function entrar(cuerpo, ip = "1.2.3.4") {
  const r = await login.POST(new NextRequest("http://x/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(cuerpo),
  }));
  return { status: r.status, data: await r.json(), cookies: Object.fromEntries(r.cookies.getAll().map((c) => [c.name, c])) };
}

describe("a dónde manda", () => {
  it("cada rol a su sitio, con su sesión y sin el nombre de quien atendía antes", async () => {
    const manager = await entrar({ usuario: "nube", clave: "nube" });
    expect(manager.status).toBe(200);
    expect(manager.data).toEqual({ ok: true, negocio: "nube", rol: "manager", destino: "/nube/manager" });
    expect(manager.cookies.sesion).toMatchObject({ value: expect.stringMatching(/^nube\.manager\./), httpOnly: true, sameSite: "lax", path: "/" });
    expect(manager.cookies.quien).toMatchObject({ value: "", maxAge: 0 });

    expect((await entrar({ usuario: "nube-caja", clave: "nube-caja" })).data.destino).toBe("/nube/caja");
    expect((await entrar({ usuario: "Nube-Caja ", clave: "nube-caja" })).data.destino).toBe("/nube/caja");
    expect((await entrar({ usuario: "victor", clave: "victor" })).data).toMatchObject({ rol: "admin", destino: "/admin" });
  });

  it("`next` solo si es de esta tienda; una ficha, si la tarjeta es suya", async () => {
    const con = (next, usuario = "nube") => entrar({ usuario, clave: usuario, next }).then((r) => r.data.destino);
    expect(await con("/nube/caja")).toBe("/nube/caja");
    expect(await con("/nube/crm")).toBe("/nube/crm");
    expect(await con("/fade/caja")).toBe("/nube/manager");
    expect(await con("//evil.com")).toBe("/nube/manager");
    expect(await con("https://evil.com")).toBe("/nube/manager");
    expect(await con(`/w/${SERIAL_NUBE}`, "nube-caja")).toBe(`/w/${SERIAL_NUBE}`);
    expect(await con(`/w/${SERIAL_FADE}`, "nube-caja")).toBe("/nube/caja");
    // El admin va a donde pida.
    expect(await con("/fade/manager", "victor")).toBe("/fade/manager");
  });
});

describe("quién no entra", () => {
  it("contraseña mal: 401 sin decir cuál de los dos falla", async () => {
    const r = await entrar({ usuario: "nube", clave: "otra" });
    expect(r.status).toBe(401);
    expect(r.data.error).toBe("Usuario o contraseña incorrectos");
    expect(r.cookies.sesion).toBeUndefined();
  });

  it("tienda archivada o inexistente, usuario roto: 401", async () => {
    await store.archivarNegocio("nube", true);
    expect((await entrar({ usuario: "nube", clave: "nube" })).status).toBe(401);
    expect((await entrar({ usuario: "nube-caja", clave: "nube-caja" })).status).toBe(401);
    expect((await entrar({ usuario: "inventada", clave: "inventada" })).status).toBe(401);
    expect((await entrar({ usuario: "nube caja", clave: "x" })).status).toBe(401);
    expect((await entrar({})).status).toBe(401);
  });

  it("al undécimo fallo seguido desde la misma IP, 429 aunque la contraseña sea la buena; y lo dice", async () => {
    for (let i = 0; i < 10; i++) expect((await entrar({ usuario: "nube-caja", clave: "mal" }, "5.5.5.5")).status).toBe(401);
    const r = await entrar({ usuario: "nube-caja", clave: "nube-caja" }, "5.5.5.5");
    expect(r.status).toBe(429);
    expect(r.data.error).toMatch(/no se ha comprobado/);
    expect(r.data.error).toMatch(/15 minutos/);
    // Desde otra IP, la tienda sigue entrando; y los fallos de la caja no cuentan contra Fade.
    expect((await entrar({ usuario: "nube-caja", clave: "nube-caja" }, "5.5.5.6")).status).toBe(200);
    expect((await entrar({ usuario: "fade", clave: "fade" }, "5.5.5.5")).status).toBe(200);
  });

  it("en producción sin AUTH_SECRET no entra nadie: 503", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const r = await entrar({ usuario: "nube", clave: "nube" });
    expect(r.status).toBe(503);
    expect(r.data.error).toMatch(/AUTH_SECRET/);
  });
});
