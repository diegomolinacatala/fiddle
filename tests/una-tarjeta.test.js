import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as store from "@/lib/store";
import { fusionar, unificarTarjeta, clienteVigente } from "@/lib/unaTarjeta";
import { registrar } from "@/lib/apple/servicio";
import { camposDelPase, construirPassJson } from "@/lib/apple/pase";
import { componerNegocio } from "@/lib/negocios";

const nube = componerNegocio("nube", null); // meta 8
const deli = componerNegocio("delicanteria", {
  nombre: "La Delicantería",
  tipo: "sellos",
  config: {
    acciones: ["sellar", "canjear"],
    cartillas: [
      { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
      { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
    ],
  },
});
const c = (o) => ({ sellos: 0, sellos2: 0, premios: 0, guardados: 0, guardados2: 0, visitas: 0, ...o });

describe("fusionar (pura)", () => {
  it("lo normal: la nueva está a cero y se queda con todo lo de la vieja", () => {
    const viejo = c({ serial: "v", codigo: "AAA", sellos: 5, premios: 2, guardados: 1, nombre: "Ana", visitas: 9, origen: "tap", instalado: "2026-09-01" });
    const nuevo = c({ serial: "n", codigo: "BBB", instalado: "2026-09-20" });
    expect(fusionar(viejo, nuevo, nube)).toMatchObject({
      sellos: 5, premios: 2, guardados: 1, codigo: "AAA", nombre: "Ana", visitas: 9, origen: "tap", instalado: "2026-09-01",
    });
  });

  it("si se usaron las dos se suman, y lo que pasa de la meta se guarda como premio", () => {
    expect(fusionar(c({ sellos: 6 }), c({ sellos: 5 }), nube)).toMatchObject({ sellos: 3, guardados: 1 });
    expect(fusionar(c({ sellos: 8 }), c({ sellos: 0 }), nube)).toMatchObject({ sellos: 8, guardados: 0 }); // llena, no guardada
    expect(fusionar(c({ sellos: 8 }), c({ sellos: 8 }), nube)).toMatchObject({ sellos: 8, guardados: 1 });
  });

  it("con dos cartillas, cada una por su lado", () => {
    expect(fusionar(c({ sellos: 3, sellos2: 7, guardados2: 1 }), c({ sellos2: 2 }), deli))
      .toMatchObject({ sellos: 3, sellos2: 1, guardados: 0, guardados2: 2 });
  });

  it("un cupón usado en cualquiera de las dos sigue usado (no se suma)", () => {
    const cupon = { ...nube, tipo: "descuento" };
    expect(fusionar(c({ premios: 1 }), c({ premios: 1 }), cupon).premios).toBe(1);
  });
});

describe("la tarjeta vieja en el Wallet", () => {
  it("queda anulada y dice dónde están los sellos", () => {
    const vieja = { serial: "v", codigo: "AAA", sellos: 0, premios: 0, auth_token: "t".repeat(32), fusionado_en: "n" };
    const pase = construirPassJson(vieja, nube, { passTypeId: "pass.x", teamId: "T", appUrl: "https://f.test" });
    expect(pase.voided).toBe(true);
    expect(camposDelPase(vieja, nube).secondaryFields[0].value).toMatch(/tarjeta nueva/);
  });
});

// Backend de ficheros real: la fusión escribe de verdad.
describe("unificarTarjeta con el store", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "una-tarjeta-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  const alta = (serial) => store.crearCliente({ serial, negocio: "nube", authToken: `tok-${serial}`.padEnd(32, "x") });
  const deps = (avisos = []) => ({
    getCliente: store.getCliente,
    getNegocio: store.getNegocio,
    tarjetaDeDispositivo: store.tarjetaDeDispositivo,
    apuntarTarjetaDeDispositivo: store.apuntarTarjetaDeDispositivo,
    fusionarClientes: store.fusionarClientes,
    addEvento: store.addEvento,
    notificarCliente: async (cliente) => { avisos.push(cliente.serial); },
  });

  it("borra el pase, escanea otra vez sin cookie y vuelve a tener sus sellos", async () => {
    const vieja = await alta("vieja");
    await store.saveCliente({ ...vieja, sellos: 5, guardados: 1 });
    await store.addEvento("vieja", "sellar", "Sello 5/8", { negocio: "nube" });
    await unificarTarjeta(deps(), { dispositivo: "iphone-ana", negocio: "nube", serial: "vieja" });

    const nueva = await alta("nueva");
    const avisos = [];
    const r = await unificarTarjeta(deps(avisos), { dispositivo: "iphone-ana", negocio: "nube", serial: "nueva" });

    expect(r.fusionada).toBe("vieja");
    const ahora = await store.getCliente("nueva");
    expect(ahora).toMatchObject({ sellos: 5, guardados: 1, codigo: vieja.codigo, fusionado_en: null });
    expect(await store.getCliente("vieja")).toMatchObject({ sellos: 0, guardados: 0, fusionado_en: "nueva", codigo: nueva.codigo });
    // El historial se muda con los sellos.
    expect((await store.listEventos("nueva", 20)).map((e) => e.mensaje)).toContain("Sello 5/8");
    // Solo queda UNA tarjeta de la tienda para la caja y el CRM.
    expect((await store.listClientes("nube")).map((x) => x.serial)).toEqual(["nueva"]);
    expect(await store.tarjetaDeDispositivo({ dispositivo: "iphone-ana", negocio: "nube" })).toBe("nueva");
    // Se avisa a las dos: la nueva se llena y la vieja se anula.
    expect(avisos).toEqual(["nueva", "vieja"]);
    // Una cookie o un QR de la vieja llevan a la buena.
    expect((await clienteVigente(store.getCliente, "vieja")).serial).toBe("nueva");
  });

  it("otro iPhone, otra tienda o la misma tarjeta: no se fusiona nada", async () => {
    await alta("a");
    await alta("b");
    await unificarTarjeta(deps(), { dispositivo: "iphone-1", negocio: "nube", serial: "a" });
    expect((await unificarTarjeta(deps(), { dispositivo: "iphone-1", negocio: "nube", serial: "a" })).fusionada).toBeNull();
    expect((await unificarTarjeta(deps(), { dispositivo: "iphone-2", negocio: "nube", serial: "b" })).fusionada).toBeNull();
    expect(await store.getCliente("a")).toMatchObject({ fusionado_en: null });
    expect(await store.getCliente("b")).toMatchObject({ fusionado_en: null });
  });

  it("volver a añadir la vieja (anulada) no deshace nada", async () => {
    await alta("vieja");
    await alta("nueva");
    await unificarTarjeta(deps(), { dispositivo: "i", negocio: "nube", serial: "vieja" });
    await unificarTarjeta(deps(), { dispositivo: "i", negocio: "nube", serial: "nueva" });
    const r = await unificarTarjeta(deps(), { dispositivo: "i", negocio: "nube", serial: "vieja" });
    expect(r.fusionada).toBeNull();
    expect(await store.tarjetaDeDispositivo({ dispositivo: "i", negocio: "nube" })).toBe("nueva");
    expect(await store.getCliente("nueva")).toMatchObject({ fusionado_en: null });
  });

  it("si la caja sella la vieja justo a la vez, no se fusiona (y no se pierde el sello)", async () => {
    const vieja = await alta("vieja");
    await alta("nueva");
    const leida = await store.getCliente("vieja");
    await store.saveCliente({ ...vieja, sellos: 1 }); // la caja, entre medias
    expect(await store.fusionarClientes(leida, await store.getCliente("nueva"), fusionar(leida, await store.getCliente("nueva"), nube))).toBe(false);
    expect(await store.getCliente("vieja")).toMatchObject({ sellos: 1, fusionado_en: null });
  });

  it("nunca lanza: el registro en el Wallet no puede fallar por esto", async () => {
    const roto = { ...deps(), tarjetaDeDispositivo: async () => { throw new Error("base caída"); } };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(unificarTarjeta(roto, { dispositivo: "i", negocio: "nube", serial: "x" })).resolves.toEqual({ fusionada: null });
    error.mockRestore();
  });
});

describe("el web service de Apple lo llama al registrar", () => {
  it("solo cuando el registro es nuevo", async () => {
    const TOKEN = "t".repeat(48);
    const unificarTarjeta = vi.fn(async () => ({ fusionada: null }));
    let ya = false;
    const deps = {
      config: { passTypeId: "pass.x" },
      getCliente: async () => ({ serial: "s1", negocio: "nube", auth_token: TOKEN, instalado: null }),
      registrarPase: async () => { const nuevo = !ya; ya = true; return nuevo; },
      marcarInstalacion: async () => {},
      addEvento: async () => {},
      unificarTarjeta,
    };
    const peticion = { dispositivo: "iphone", passType: "pass.x", serial: "s1", authorization: `ApplePass ${TOKEN}`, cuerpo: { pushToken: "ab".repeat(32) } };
    expect((await registrar(deps, peticion)).status).toBe(201);
    expect((await registrar(deps, peticion)).status).toBe(200);
    expect(unificarTarjeta).toHaveBeenCalledTimes(1);
    expect(unificarTarjeta).toHaveBeenCalledWith({ dispositivo: "iphone", negocio: "nube", serial: "s1" });
  });
});
