import { describe, it, expect, afterEach, vi } from "vitest";
import {
  firmarSesion, verificarSesion, puedeAcceder, claveDe, varClave, varPin, usuarioDe, usuariosDemo,
  resolverUsuario, verificarAcceso, secretoSesion, igualSeguro, TTL_SEGUNDOS,
} from "@/lib/auth";

afterEach(() => vi.unstubAllEnvs());

describe("usuarios", () => {
  it("el usuario dice negocio y rol", () => {
    expect(resolverUsuario("nube")).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(resolverUsuario("NUBE ")).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(resolverUsuario("nube-caja")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(resolverUsuario("fade-manager")).toMatchObject({ negocio: "fade", rol: "manager" });
    // Victor y Diego no son de ninguna tienda: son de la plataforma.
    expect(resolverUsuario("victor")).toMatchObject({ negocio: "plataforma", rol: "admin", usuario: "victor" });
    expect(resolverUsuario("Diego ")).toMatchObject({ rol: "admin", usuario: "diego" });
    expect(resolverUsuario("nube caja")).toBeNull();
    expect(resolverUsuario("")).toBeNull();
    expect(usuarioDe("nube", "caja")).toBe("nube-caja");
    expect(usuarioDe("nube", "manager")).toBe("nube");
  });
});

describe("contraseñas", () => {
  it("en pruebas la contraseña puede ser igual que el usuario", () => {
    expect(usuariosDemo()).toBe(true);
    expect(verificarAcceso("nube", "nube")).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(verificarAcceso("nube-caja", "nube-caja")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(verificarAcceso("nube", "otra")).toBeNull();
    expect(verificarAcceso("nube", "")).toBeNull();
  });

  it("lee CLAVE_<SLUG>_<ROL> y también el nombre antiguo PIN_", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAVE_NUBE_CAJA", "s3creta");
    vi.stubEnv("PIN_FADE_MANAGER", "778899");
    expect(varClave("fade-room", "manager")).toBe("CLAVE_FADE_ROOM_MANAGER");
    expect(varPin("fade-room", "manager")).toBe("PIN_FADE_ROOM_MANAGER");
    expect(claveDe("nube", "caja")).toBe("s3creta");
    expect(verificarAcceso("nube-caja", "s3creta")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(verificarAcceso("fade", "778899")).toMatchObject({ negocio: "fade", rol: "manager" });
  });

  it("en producción no valen los accesos de prueba salvo con USUARIOS_DEMO=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(usuariosDemo()).toBe(false);
    expect(claveDe("nube", "caja")).toBeNull();
    expect(verificarAcceso("nube", "nube")).toBeNull();

    vi.stubEnv("USUARIOS_DEMO", "1");
    expect(usuariosDemo()).toBe(true);
    expect(verificarAcceso("nube", "nube")).toMatchObject({ negocio: "nube", rol: "manager" });
  });

  it("la contraseña de un rol no sirve para el otro", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAVE_FADE_CAJA", "abc123");
    expect(verificarAcceso("fade-caja", "abc123")).toMatchObject({ negocio: "fade", rol: "caja" });
    expect(verificarAcceso("fade", "abc123")).toBeNull();
  });
});

describe("sesión firmada", () => {
  it("firma y verifica negocio + rol", async () => {
    const token = await firmarSesion("nube", "caja");
    const s = await verificarSesion(token);
    expect(s).toMatchObject({ negocio: "nube", rol: "caja" });
  });

  it("la sesión de caja dura 30 días y la de manager 12 h", async () => {
    const ahora = 1_000_000;
    const caja = await verificarSesion(await firmarSesion("nube", "caja", ahora), ahora);
    const manager = await verificarSesion(await firmarSesion("nube", "manager", ahora), ahora);
    expect(caja.exp - ahora).toBe(TTL_SEGUNDOS.caja * 1000);
    expect(manager.exp - ahora).toBe(TTL_SEGUNDOS.manager * 1000);
  });

  it("rechaza tokens manipulados, caducados o mal formados", async () => {
    const token = await firmarSesion("nube", "caja");
    const [n, , exp, firma] = token.split(".");
    expect(await verificarSesion(`${n}.manager.${exp}.${firma}`)).toBeNull();
    expect(await verificarSesion(`fade.caja.${exp}.${firma}`)).toBeNull();
    expect(await verificarSesion(token, Date.now() + TTL_SEGUNDOS.caja * 1000 + 1)).toBeNull();
    expect(await verificarSesion("basura")).toBeNull();
    expect(await verificarSesion("")).toBeNull();
    expect(await verificarSesion("NUBE.caja.1.x")).toBeNull();
  });

  it("un token firmado con otro secreto no vale", async () => {
    vi.stubEnv("AUTH_SECRET", "secreto-a");
    const token = await firmarSesion("nube", "manager");
    vi.stubEnv("AUTH_SECRET", "secreto-b");
    expect(await verificarSesion(token)).toBeNull();
  });

  it("en producción sin AUTH_SECRET no firma ni verifica", async () => {
    const token = await firmarSesion("nube", "caja");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(secretoSesion()).toBeNull();
    await expect(firmarSesion("nube", "caja")).rejects.toThrow(/AUTH_SECRET/);
    expect(await verificarSesion(token)).toBeNull();
  });

  it("no firma slugs o roles inválidos", async () => {
    await expect(firmarSesion("Nube.x", "caja")).rejects.toThrow();
    await expect(firmarSesion("nube", "jefe")).rejects.toThrow();
  });
});

describe("permisos", () => {
  const caja = { negocio: "nube", rol: "caja" };
  const manager = { negocio: "nube", rol: "manager" };

  it("manager hereda caja de SU negocio", () => {
    expect(puedeAcceder(manager, "nube", "caja")).toBe(true);
    expect(puedeAcceder(manager, "nube", "manager")).toBe(true);
    expect(puedeAcceder(caja, "nube", "caja")).toBe(true);
    expect(puedeAcceder(caja, "nube", "manager")).toBe(false);
  });

  it("una sesión no vale para otro negocio", () => {
    expect(puedeAcceder(manager, "fade", "caja")).toBe(false);
    expect(puedeAcceder(null, "nube", "caja")).toBe(false);
  });

  it("igualSeguro compara bien", () => {
    expect(igualSeguro("abc", "abc")).toBe(true);
    expect(igualSeguro("abc", "abd")).toBe(false);
    expect(igualSeguro("abc", "abcd")).toBe(false);
    expect(igualSeguro(undefined, "a")).toBe(false);
  });
});
