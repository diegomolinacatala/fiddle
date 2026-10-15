import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generarClave, hashClave, comprobarClave, esElegida } from "@/lib/claves";
import { comprobarAcceso, nuevaClave, cambiarClavePropia, estadoAccesos } from "@/lib/accesos";

describe("claves", () => {
  it("generadas legibles, sin caracteres que se confunden", () => {
    const c = generarClave();
    expect(c).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(generarClave()).not.toBe(c);
  });

  it("se guarda el hash, nunca la clave, y una generada se comprueba aunque se teclee en minúsculas", async () => {
    const hash = await hashClave("K7MP-X3QR-9HTB");
    expect(hash).not.toContain("K7MP");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(esElegida(hash)).toBe(false);
    expect(await comprobarClave("K7MP-X3QR-9HTB", hash)).toBe(true);
    expect(await comprobarClave("k7mp x3qr 9htb", hash)).toBe(true);
    expect(await comprobarClave("k7mpx3qr9htb", hash)).toBe(true);
    expect(await comprobarClave("K7MP-X3QR-9HTC", hash)).toBe(false);
    expect(await comprobarClave("x", "basura")).toBe(false);
  });

  it("una elegida se guarda aparte y se compara tal cual: «micafeteria1» no vale como «MICAFETERIA1»", async () => {
    const hash = await hashClave("micafeteria1", "elegida");
    expect(hash).toMatch(/^scrypt-elegida\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(esElegida(hash)).toBe(true);
    expect(await comprobarClave("micafeteria1", hash)).toBe(true);
    expect(await comprobarClave("  micafeteria1 ", hash)).toBe(true); // los espacios de los lados, no cuentan
    expect(await comprobarClave("MICAFETERIA1", hash)).toBe(false);
    expect(await comprobarClave("mi ca fe teria1", hash)).toBe(false);
    // Una frase con espacios y mayúsculas dentro, exacta.
    const frase = await hashClave("Un café por favor", "elegida");
    expect(await comprobarClave("Un café por favor", frase)).toBe(true);
    expect(await comprobarClave("un café por favor", frase)).toBe(false);
    // Las de antes de distinguirlas ("scrypt$") siguen comparándose como generadas: nadie se queda fuera.
    const deAntes = await hashClave("micafeteria1");
    expect(await comprobarClave("MICAFETERIA1", deAntes)).toBe(true);
    // «café» tecleado en un iPhone (NFD) y en un PC (NFC) es la misma contraseña.
    const nfc = await hashClave("un café por favor", "elegida");
    expect(await comprobarClave("un café por favor", nfc)).toBe(true);
    // Un tipo que no existe no se guarda como nada: ni elegida ni generada.
    await expect(hashClave("lo que sea", "otra")).rejects.toThrow(/Tipo/);
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

  it("en producción, con USUARIOS_DEMO=1, contraseña = usuario sigue sin valer", async () => {
    vi.stubEnv("USUARIOS_DEMO", "1");
    await nuevaClave("nube", "manager");
    expect(await comprobarAcceso("nube", "nube")).toBeNull();
    expect(await comprobarAcceso("nube-caja", "nube-caja")).toBeNull();
    expect(await comprobarAcceso("victor", "victor")).toBeNull();
  });

  it("el estado dice cómo entra cada usuario y si la eligió él, sin enseñar hashes", async () => {
    await nuevaClave("nube", "manager");
    const estado = await estadoAccesos("nube");
    expect(estado.map((a) => [a.usuario, Boolean(a.desde), a.elegida, a.respaldo])).toEqual([
      ["nube", true, false, false],
      ["nube-caja", false, false, true],
    ]);
    expect(JSON.stringify(estado)).not.toContain("scrypt");
  });

  describe("el dueño cambia su contraseña (Ajustes → Tu acceso)", () => {
    it("con la actual bien, la nueva entra y la de antes no; queda como elegida", async () => {
      const generada = await nuevaClave("nube", "manager");
      const r = await cambiarClavePropia("nube", "manager", { actual: generada.clave.toLowerCase(), nueva: "mi cafetería desde 2019" });
      expect(r).toEqual({ ok: true, usuario: "nube" });
      expect(await comprobarAcceso("nube", "mi cafetería desde 2019")).toMatchObject({ negocio: "nube", rol: "manager" });
      expect(await comprobarAcceso("nube", "Mi cafetería desde 2019")).toBeNull(); // elegida: exacta
      expect(await comprobarAcceso("nube", generada.clave)).toBeNull();
      expect((await estadoAccesos("nube")).find((a) => a.rol === "manager").elegida).toBe(true);
    });

    it("con la actual mal no cambia nada, y lo dice en su campo", async () => {
      const generada = await nuevaClave("nube", "manager");
      expect(await cambiarClavePropia("nube", "manager", { actual: "esta no es", nueva: "mi cafetería desde 2019" })).toMatchObject({ ok: false, campo: "actual" });
      expect(await cambiarClavePropia("nube", "manager", { actual: "", nueva: "mi cafetería desde 2019" })).toMatchObject({ ok: false, campo: "actual" });
      expect(await comprobarAcceso("nube", generada.clave)).toMatchObject({ rol: "manager" });
    });

    it("la nueva tiene que valer como elegida, ser distinta de la actual y de la de la caja", async () => {
      const generada = await nuevaClave("nube", "manager");
      const caja = await nuevaClave("nube", "caja");
      const actual = generada.clave;
      expect(await cambiarClavePropia("nube", "manager", { actual, nueva: "corta" })).toMatchObject({ ok: false, campo: "nueva", motivo: expect.stringMatching(/al menos/) });
      expect(await cambiarClavePropia("nube", "manager", { actual, nueva: actual })).toMatchObject({ ok: false, campo: "nueva", motivo: expect.stringMatching(/distinta de la actual/) });
      expect(await cambiarClavePropia("nube", "manager", { actual, nueva: caja.clave })).toMatchObject({ ok: false, campo: "nueva", motivo: expect.stringMatching(/caja/) });
      expect(await comprobarAcceso("nube", actual)).toMatchObject({ rol: "manager" });
      // Y la de la caja sigue siendo la suya: cambiar la del dueño no la toca.
      expect(await cambiarClavePropia("nube", "manager", { actual, nueva: "mi cafetería desde 2019" })).toMatchObject({ ok: true });
      expect(await comprobarAcceso("nube-caja", caja.clave)).toMatchObject({ rol: "caja" });
    });
  });

  it("una fila de otra tienda no abre esta (una tienda «nube-caja» pudo pisar la caja de «nube»)", async () => {
    const intruso = { usuario: "nube-caja", negocio: "nube-caja", rol: "manager", hash: await hashClave("la-del-intruso"), actualizado: new Date().toISOString() };
    writeFileSync(path.join(dir, "accesos.json"), JSON.stringify({ "nube-caja": intruso }));
    expect(await comprobarAcceso("nube-caja", "la-del-intruso")).toBeNull();
    // Cuenta como si no hubiera fila: vale la de Vercel, como antes.
    expect(await comprobarAcceso("nube-caja", "de-vercel")).toMatchObject({ negocio: "nube", rol: "caja" });
  });

  it("si la base falla, cae a la de Vercel en vez de dejar a la caja fuera", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(path.join(dir, "accesos.json"), "{ esto no es json"); // la "base" no se puede leer
    expect(await comprobarAcceso("nube-caja", "de-vercel")).toMatchObject({ rol: "caja" });
    error.mockRestore();
  });
});
