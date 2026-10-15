import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { verificarSesion } from "@/lib/auth";
import { listAuditoria } from "@/lib/store";

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

const entrar = (usuario, clave) =>
  login.POST(new NextRequest("http://x/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario, clave }) }));
const sesionDe = (res) => verificarSesion(/sesion=([^;]+)/.exec(res.headers.get("set-cookie"))[1]);

describe("POST /api/login (accesos de prueba: contraseña = usuario)", () => {
  it("el token dice con quién se entró, y el login correcto queda en la auditoría (el admin, con su nombre)", async () => {
    const caja = await entrar("nube-caja", "nube-caja");
    expect(caja.status).toBe(200);
    expect(await sesionDe(caja)).toMatchObject({ negocio: "nube", rol: "caja", usuario: "nube-caja" });
    expect((await listAuditoria("nube"))[0]).toMatchObject({ accion: "login", usuario: "nube-caja", rol: "caja", negocio: "nube" });

    const admin = await entrar("victor", "victor");
    expect(await sesionDe(admin)).toMatchObject({ negocio: "plataforma", rol: "admin", usuario: "victor" });
    expect((await listAuditoria()).find((a) => a.rol === "admin")).toMatchObject({ accion: "login", usuario: "victor", negocio: null });
  });

  it("un fallo no deja fila en la auditoría (va a `intentos`, sin usuario)", async () => {
    expect((await entrar("nube-caja", "mal")).status).toBe(401);
    expect(await listAuditoria("nube")).toEqual([]);
  });
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
