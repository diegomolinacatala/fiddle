import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const login = await import("@/app/api/login/route.js");

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-login-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("GET /api/login", () => {
  it("en local enseña los accesos de prueba", async () => {
    const datos = await (await login.GET()).json();
    expect(datos.demo).toBe(true);
    expect(datos.accesos.map((a) => a.usuario)).toContain("delicanteria-caja");
  });

  it("en producción no enseña ninguno, aunque siga puesto USUARIOS_DEMO=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USUARIOS_DEMO", "1");
    expect(await (await login.GET()).json()).toEqual({ demo: false, accesos: [] });
  });
});
