import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generarClave, hashClave, comprobarClave } from "@/lib/claves";
import { comprobarAcceso, nuevaClave, estadoAccesos } from "@/lib/accesos";

describe("claves", () => {
  it("generadas legibles, sin caracteres que se confunden", () => {
    const c = generarClave();
    expect(c).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(generarClave()).not.toBe(c);
  });

  it("se guarda el hash, nunca la clave, y se comprueba aunque se teclee en minúsculas", async () => {
    const hash = await hashClave("K7MP-X3QR-9HTB");
    expect(hash).not.toContain("K7MP");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await comprobarClave("K7MP-X3QR-9HTB", hash)).toBe(true);
    expect(await comprobarClave("k7mp x3qr 9htb", hash)).toBe(true);
    expect(await comprobarClave("k7mpx3qr9htb", hash)).toBe(true);
    expect(await comprobarClave("K7MP-X3QR-9HTC", hash)).toBe(false);
    expect(await comprobarClave("x", "basura")).toBe(false);
  });
});

describe("login con contraseñas en la base", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "accesos-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    // Como en producción: sin contraseña = usuario.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USUARIOS_DEMO", "");
    vi.stubEnv("CLAVE_NUBE_CAJA", "de-vercel");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("sin contraseña en la base vale la de Vercel (las tiendas de antes siguen igual)", async () => {
    expect(await comprobarAcceso("nube-caja", "de-vercel")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(await comprobarAcceso("nube-caja", "otra")).toBeNull();
    expect(await comprobarAcceso("nube", "nube")).toBeNull(); // sin modo pruebas
  });

  it("con contraseña en la base solo vale esa: la de Vercel y la anterior dejan de servir", async () => {
    const primera = await nuevaClave("nube", "caja");
    expect(primera.usuario).toBe("nube-caja");
    expect(await comprobarAcceso("nube-caja", primera.clave)).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(await comprobarAcceso("nube-caja", "de-vercel")).toBeNull();

    const segunda = await nuevaClave("nube", "caja");
    expect(await comprobarAcceso("nube-caja", primera.clave)).toBeNull();
    expect(await comprobarAcceso("nube-caja", segunda.clave)).toMatchObject({ rol: "caja" });
    // La del manager es otra cosa: la de la caja no le abre la puerta.
    expect(await comprobarAcceso("nube", segunda.clave)).toBeNull();
  });

  it("el estado dice cómo entra cada usuario, sin enseñar hashes", async () => {
    await nuevaClave("nube", "manager");
    const estado = await estadoAccesos("nube");
    expect(estado.map((a) => [a.usuario, Boolean(a.desde), a.respaldo])).toEqual([
      ["nube", true, false],
      ["nube-caja", false, true],
    ]);
    expect(JSON.stringify(estado)).not.toContain("scrypt");
  });

  it("si la base falla, cae a la de Vercel en vez de dejar a la caja fuera", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(path.join(dir, "accesos.json"), "{ esto no es json"); // la "base" no se puede leer
    expect(await comprobarAcceso("nube-caja", "de-vercel")).toMatchObject({ rol: "caja" });
    error.mockRestore();
  });
});
