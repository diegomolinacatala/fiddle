import { describe, it, expect, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { cifrar, descifrar, estaCifrado, estadoClaveCifrado } from "@/lib/cifrado";

const CLAVE = randomBytes(32).toString("base64");
const ANA = { serial: "s1", campo: "nombre" };

afterEach(() => vi.unstubAllEnvs());

describe("cifrado de campos", () => {
  it("cifra y descifra; el texto no aparece en lo guardado", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    const guardado = cifrar("Ana", ANA);
    expect(estaCifrado(guardado)).toBe(true);
    expect(guardado).not.toContain("Ana");
    expect(descifrar(guardado, ANA)).toBe("Ana");
  });

  it("el mismo texto cifra distinto cada vez (no se puede ver quién se llama igual)", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    expect(cifrar("Ana", ANA)).not.toBe(cifrar("Ana", ANA));
  });

  it("un valor copiado a otro cliente u otra columna no se descifra", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    const guardado = cifrar("sin lactosa", { serial: "s1", campo: "nota" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(descifrar(guardado, { serial: "s2", campo: "nota" })).toBeNull();
    expect(descifrar(guardado, { serial: "s1", campo: "nombre" })).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("con otra clave no se descifra (y no rompe: devuelve null)", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    const guardado = cifrar("Ana", ANA);
    vi.stubEnv("CIFRADO_CLAVE", randomBytes(32).toString("base64"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(descifrar(guardado, ANA)).toBeNull();
    error.mockRestore();
  });

  it("vacío y null se quedan igual", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    expect(cifrar(null, ANA)).toBeNull();
    expect(cifrar(undefined, ANA)).toBeNull();
    expect(cifrar("", ANA)).toBeNull();
    expect(descifrar(null, ANA)).toBeNull();
  });

  it("los datos de antes (en claro) se siguen leyendo", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    expect(estaCifrado("Ana")).toBe(false);
    expect(descifrar("Ana", ANA)).toBe("Ana");
  });

  it("una nota escrita a mano que empieza por «v1:» no se toma por cifrada", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    for (const nota of ["v1: reservado", "v1:", "v1:abc"]) {
      expect(estaCifrado(nota), nota).toBe(false);
      expect(descifrar(nota, ANA)).toBe(nota);
    }
  });

  it("sin clave se guarda en claro (local y demo) y lo cifrado no se puede leer", () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    const guardado = cifrar("Ana", ANA);
    vi.stubEnv("CIFRADO_CLAVE", "");
    expect(cifrar("Ana", ANA)).toBe("Ana");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(descifrar(guardado, ANA)).toBeNull();
    error.mockRestore();
  });

  it("estadoClaveCifrado: falta, mal formada o lista", () => {
    vi.stubEnv("CIFRADO_CLAVE", "");
    expect(estadoClaveCifrado()).toEqual({ ok: false, problema: "falta" });
    vi.stubEnv("CIFRADO_CLAVE", "corta");
    expect(estadoClaveCifrado()).toEqual({ ok: false, problema: "mal" });
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    expect(estadoClaveCifrado()).toEqual({ ok: true });
  });

  it("una clave mal formada no cifra en silencio: lanza", () => {
    vi.stubEnv("CIFRADO_CLAVE", "corta");
    expect(() => cifrar("Ana", ANA)).toThrow(/CIFRADO_CLAVE/);
  });
});
