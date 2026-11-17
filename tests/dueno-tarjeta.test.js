import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const store = await import("@/lib/store");
const {
  nuevaTarjeta, tarjetaDe, guardarTarjeta, tiendaDeSerial, slugDeSerial, conDispositivo, sinDispositivo, MAX_DISPOSITIVOS,
} = await import("@/lib/dueno/tarjeta");
const { negocioDelPersonal, negocioDeTarjeta } = await import("@/lib/tarjeta");

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-dueno-tarjeta-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("nuevaTarjeta", () => {
  it("lleva el slug en el serial, 16 hex detrás y un token de 48 hex", () => {
    const t = nuevaTarjeta("la-deli");
    expect(t.activa).toBe(true);
    expect(t.serial).toMatch(/^dueno-la-deli-[0-9a-f]{16}$/);
    expect(t.token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("no repite serial ni token", () => {
    expect(nuevaTarjeta("nube").token).not.toBe(nuevaTarjeta("nube").token);
  });
});

describe("slugDeSerial", () => {
  it("saca el slug aunque lleve guiones", () => {
    expect(slugDeSerial("dueno-la-deli-3f9c2a7b51d04e68")).toBe("la-deli");
    expect(slugDeSerial("dueno-nube-3f9c2a7b51d04e68")).toBe("nube");
  });

  it("rechaza lo que no es un serial de dueño", () => {
    for (const s of ["", null, "8a1f6c2e-0000-4000-8000-000000000001", "dueno-nube-xyz", "dueno--3f9c2a7b51d04e68"]) {
      expect(slugDeSerial(s), String(s)).toBeNull();
    }
  });
});

describe("tarjetaDe", () => {
  it("es null si la tienda no la tiene o está apagada", () => {
    expect(tarjetaDe(null)).toBeNull();
    expect(tarjetaDe({ tarjetaDueno: null })).toBeNull();
    expect(tarjetaDe({ tarjetaDueno: { ...nuevaTarjeta("nube"), activa: false } })).toBeNull();
  });

  it("rellena lo que falte aunque solo haya serial y token", () => {
    const t = tarjetaDe({ tarjetaDueno: nuevaTarjeta("nube") });
    expect(t).toMatchObject({ dispositivos: [], avisados: {}, actualizado: null, estado: null, prueba: null });
  });
});

describe("dispositivos", () => {
  const d = (n) => ({ id: `d${n}`, token: "ab".repeat(10), tipo: "pass.x" });

  it("al registrar el sexto cae el más viejo", () => {
    let lista = [];
    for (let i = 1; i <= MAX_DISPOSITIVOS + 1; i++) {
      lista = conDispositivo(lista, d(i), `2026-11-1${i}T08:00:00.000Z`).dispositivos;
    }
    expect(lista).toHaveLength(MAX_DISPOSITIVOS);
    expect(lista.map((x) => x.id)).toEqual(["d2", "d3", "d4", "d5", "d6"]);
  });

  it("volver a registrar el mismo iPhone no es alta nueva y conserva su fecha de alta", () => {
    const una = conDispositivo([], d(1), "2026-11-10T08:00:00.000Z");
    const otra = conDispositivo(una.dispositivos, { ...d(1), token: "cd".repeat(10) }, "2026-11-12T08:00:00.000Z");
    expect(una.nuevo).toBe(true);
    expect(otra.nuevo).toBe(false);
    expect(otra.dispositivos).toEqual([{ ...d(1), token: "cd".repeat(10), alta: "2026-11-10T08:00:00.000Z" }]);
  });

  it("sinDispositivo quita solo ese iPhone y no muta la lista", () => {
    const lista = [{ ...d(1), alta: "a" }, { ...d(2), alta: "b" }];
    expect(sinDispositivo(lista, { id: "d1", tipo: "pass.x" })).toEqual([{ ...d(2), alta: "b" }]);
    expect(lista).toHaveLength(2);
  });
});

describe("guardar y leer la tarjeta de una tienda", () => {
  it("getNegocio devuelve lo guardado y tiendaDeSerial encuentra la tienda", async () => {
    const t = nuevaTarjeta("nube");
    await guardarTarjeta("nube", t);
    expect((await store.getNegocio("nube")).tarjetaDueno).toMatchObject(t);
    expect((await tiendaDeSerial(t.serial)).slug).toBe("nube");
  });

  it("guardar un trozo conserva el resto", async () => {
    const t = nuevaTarjeta("nube");
    await guardarTarjeta("nube", t);
    await guardarTarjeta("nube", { actualizado: "2026-11-16T08:00:00.000Z" });
    expect((await store.getNegocio("nube")).tarjetaDueno).toMatchObject({ ...t, actualizado: "2026-11-16T08:00:00.000Z" });
  });

  it("tiendaDeSerial no da la tienda con otro serial, de otra tienda ni apagada", async () => {
    const t = nuevaTarjeta("nube");
    await guardarTarjeta("nube", t);
    expect(await tiendaDeSerial("dueno-nube-0000000000000000")).toBeNull();
    expect(await tiendaDeSerial("dueno-fade-0000000000000000")).toBeNull();
    await guardarTarjeta("nube", { activa: false });
    expect(await tiendaDeSerial(t.serial)).toBeNull();
  });

  it("una tienda que nunca la tuvo no la trae", async () => {
    expect((await store.getNegocio("fade")).tarjetaDueno).toBeNull();
  });
});

describe("el token no sale del servidor", () => {
  it("negocioDelPersonal la quita y negocioDeTarjeta no la lleva", async () => {
    await guardarTarjeta("nube", nuevaTarjeta("nube"));
    const negocio = await store.getNegocio("nube");
    expect(negocio.tarjetaDueno).toBeTruthy();
    expect(negocioDelPersonal(negocio)).not.toHaveProperty("tarjetaDueno");
    expect(JSON.stringify(negocioDeTarjeta(negocio))).not.toContain(negocio.tarjetaDueno.token);
  });
});
