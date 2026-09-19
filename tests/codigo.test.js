import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ALFABETO, codigoAleatorio, codigoDesdeSerial, codigoLibre, normalizarCodigo } from "@/lib/codigo";
import { puntosDe, estadoDe } from "@/lib/resumen";
import * as store from "@/lib/store";

describe("código corto", () => {
  it("normaliza lo que se teclea en la caja", () => {
    expect(normalizarCodigo(" k7m ")).toBe("K7M");
    expect(normalizarCodigo("k-7-m")).toBe("K7M");
    expect(normalizarCodigo("K7")).toBeNull();       // corto
    expect(normalizarCodigo("K7MM")).toBeNull();     // largo
    expect(normalizarCodigo("OIL")).toBeNull();      // fuera del alfabeto (se confunden)
    expect(normalizarCodigo(null)).toBeNull();
  });

  it("sale del serial, es estable y usa solo el alfabeto", () => {
    const uno = codigoDesdeSerial("3f1c2b1a-1111-4222-8333-444455556666");
    expect(uno).toBe(codigoDesdeSerial("3f1c2b1a-1111-4222-8333-444455556666"));
    expect(uno).not.toBe(codigoDesdeSerial("otro-serial"));
    for (const c of [uno, codigoAleatorio()]) {
      expect(c).toHaveLength(3);
      expect([...c].every((x) => ALFABETO.includes(x))).toBe(true);
    }
  });

  it("codigoLibre esquiva los que ya tiene el negocio", () => {
    const preferido = codigoDesdeSerial("s1");
    expect(codigoLibre(new Set(), "s1")).toBe(preferido);
    const otro = codigoLibre(new Set([preferido]), "s1");
    expect(otro).not.toBe(preferido);
    expect(otro).toHaveLength(3);
  });
});

describe("resumen del estado", () => {
  const nube = { tipo: "sellos", meta: 8 };
  const forno = { tipo: "descuento", meta: 1 };
  it("cartilla y cupón cuentan distinto", () => {
    expect(puntosDe({ sellos: 3, premios: 0 }, nube)).toEqual({ label: "Sellos", balance: "3/8" });
    expect(puntosDe({ sellos: 99, premios: 0 }, nube).balance).toBe("8/8"); // no se pasa de la meta
    expect(puntosDe({ sellos: 0, premios: 0 }, forno)).toEqual({ label: "Cupón", balance: "Válido" });
    expect(puntosDe({ sellos: 0, premios: 1 }, forno).balance).toBe("Usado");
    expect(estadoDe({ sellos: 5, premios: 0 }, nube)).toMatchObject({ faltan: 3, completa: false });
    expect(estadoDe({ sellos: 8, premios: 0 }, nube)).toMatchObject({ faltan: 0, completa: true });
  });
});

describe("códigos en el store (modo ficheros)", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-codigo-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  const nuevo = (serial, negocio) => store.crearCliente({ serial, negocio, authToken: `tok-${serial}`.padEnd(20, "x") });

  it("cada cliente nuevo estrena código y se puede buscar por él", async () => {
    const a = await nuevo("s1", "nube");
    const b = await nuevo("s2", "nube");
    expect(a.codigo).toHaveLength(3);
    expect(a.codigo).not.toBe(b.codigo);

    expect((await store.getClientePorCodigo("nube", a.codigo)).serial).toBe("s1");
    expect((await store.getClientePorCodigo("nube", a.codigo.toLowerCase())).serial).toBe("s1");
    expect(await store.getClientePorCodigo("nube", "no")).toBeNull();
    expect(await store.getClientePorCodigo("nope", a.codigo)).toBeNull();
  });

  it("los negocios son independientes: el mismo código en otra tienda es otro cliente", async () => {
    const enNube = await nuevo("s1", "nube");
    const enFade = await nuevo("s1-fade", "fade");
    // El código de nube NO existe en fade (salvo casualidad), y cada búsqueda
    // se queda dentro de su negocio.
    expect((await store.getClientePorCodigo("nube", enNube.codigo)).serial).toBe("s1");
    expect((await store.getClientePorCodigo("fade", enFade.codigo)).serial).toBe("s1-fade");
    const cruzado = await store.getClientePorCodigo("fade", enNube.codigo);
    expect(cruzado === null || cruzado.negocio === "fade").toBe(true);
  });

  it("un cliente antiguo sin código lo deduce de su serial", async () => {
    expect(store.clientePublico({ serial: "x", codigo: "K7M", sellos: 1, premios: 0 }).codigo).toBe("K7M");
    const c = await nuevo("s9", "nube");
    expect(c.codigo).toBe(codigoDesdeSerial("s9")); // sin colisiones, el código sale del serial
  });
});
