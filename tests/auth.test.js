import { describe, it, expect, afterEach, vi } from "vitest";
import {
  firmarSesion, verificarSesion, rolParaPin, puedeAcceder, pinDe, varPin, secretoSesion, igualSeguro, TTL_SEGUNDOS,
} from "@/lib/auth";

afterEach(() => vi.unstubAllEnvs());

describe("PINs por negocio", () => {
  it("usa PINs de demo fuera de producción", () => {
    expect(rolParaPin("nube", "1234")).toBe("caja");
    expect(rolParaPin("nube", "4321")).toBe("manager");
    expect(rolParaPin("nube", "0000")).toBeNull();
    expect(rolParaPin("nube", "")).toBeNull();
  });

  it("lee PIN_<SLUG>_<ROL> del entorno", () => {
    vi.stubEnv("PIN_NUBE_CAJA", "778899");
    expect(rolParaPin("nube", "778899")).toBe("caja");
    expect(rolParaPin("nube", "1234")).toBeNull();
    expect(varPin("fade-room", "manager")).toBe("PIN_FADE_ROOM_MANAGER");
  });

  it("en producción sin PIN configurado nadie entra", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(pinDe("nube", "caja")).toBeNull();
    expect(rolParaPin("nube", "1234")).toBeNull();
  });

  it("si caja y manager comparten PIN gana manager", () => {
    vi.stubEnv("PIN_FADE_CAJA", "5555");
    vi.stubEnv("PIN_FADE_MANAGER", "5555");
    expect(rolParaPin("fade", "5555")).toBe("manager");
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
    await expect(firmarSesion("nube", "admin")).rejects.toThrow();
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
