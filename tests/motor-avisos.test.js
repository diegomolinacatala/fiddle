import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// El motor de verdad contra el store de ficheros, con el reloj parado a mano:
// visitas en días concretos, un pase instalado y el tiempo avanzando.
const store = await import("@/lib/store");
const motor = await import("@/lib/motorAvisos");

// Valencia en septiembre = UTC+2.
const valencia = (fecha, hora) => new Date(`${fecha}T${hora}:00+02:00`);

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-avisos-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  vi.stubEnv("WALLETWALLET_API_KEY", "");
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
/** Cliente de La Delicantería con la tarjeta en un teléfono y visitas esos días (a las 9:00). */
async function cliente(visitas = [], { instalado = true, sellos = 0, alta = "2026-08-01" } = {}) {
  vi.setSystemTime(valencia(alta, "09:00"));
  n += 1;
  const serial = `serial-${n}`;
  await store.crearCliente({ serial, negocio: "delicanteria", authToken: "t".repeat(24) });
  if (instalado) {
    await store.registrarPase({ dispositivo: `web-${n}`, pushToken: "{}", passType: "web", serial, negocio: "delicanteria" });
  }
  for (const dia of visitas) {
    vi.setSystemTime(valencia(dia, "09:00"));
    await store.addEvento(serial, "sellar", "Sello", { negocio: "delicanteria", actor: "caja" });
    await store.registrarVisita(serial);
  }
  if (sellos) await store.saveCliente({ serial, sellos });
  return serial;
}

async function pasada(fecha, hora) {
  vi.setSystemTime(valencia(fecha, hora));
  return motor.repasarTodas();
}

const envioDe = (r, regla) => r.find((x) => x.negocio === "delicanteria").envios.find((e) => e.regla === regla);

describe("te echamos de menos (21 días, a las 12:00)", () => {
  it("sale a su hora, una sola vez, y deja rastro en la ficha", async () => {
    const serial = await cliente(["2026-08-28", "2026-09-01"]);

    expect(envioDe(await pasada("2026-09-24", "11:45"), "te-echamos-de-menos")).toBeUndefined();

    const r = await pasada("2026-09-24", "12:10");
    expect(envioDe(r, "te-echamos-de-menos")).toMatchObject({ destinatarios: 1 });
    const c = await store.getCliente(serial);
    expect(c.mensaje).toBe("Hace unas semanas que no te vemos. ¿Un café esta semana? Tu tarjeta sigue sumando.");
    expect((await store.listEventos(serial)).find((e) => e.tipo === "campana").actor).toBe("automatico");

    // El reloj vuelve a pasar: nada nuevo.
    expect(envioDe(await pasada("2026-09-24", "12:25"), "te-echamos-de-menos")).toMatchObject({ destinatarios: 0 });
    expect(envioDe(await pasada("2026-09-28", "12:05"), "te-echamos-de-menos")).toMatchObject({ destinatarios: 0 });
  });

  it("el domingo y los festivos no sale nada", async () => {
    await cliente(["2026-09-01"]);
    const domingo = await pasada("2026-09-27", "12:10");
    expect(domingo.find((x) => x.negocio === "delicanteria").envios).toEqual([]);
  });

  it("si vuelve y deja de venir otra vez, se le vuelve a decir", async () => {
    const serial = await cliente(["2026-08-01"]);
    await pasada("2026-09-01", "12:05");
    expect((await store.getCliente(serial)).mensaje).toBeTruthy();

    vi.setSystemTime(valencia("2026-09-02", "09:00"));
    await store.registrarVisita(serial); // vino: el mensaje se retira solo
    expect((await store.getCliente(serial)).mensaje).toBeNull();

    expect(envioDe(await pasada("2026-09-24", "12:05"), "te-echamos-de-menos")).toMatchObject({ destinatarios: 1 });
  });

  it("sin la tarjeta en el teléfono no hay a dónde mandarlo", async () => {
    await cliente(["2026-09-01"], { instalado: false });
    expect(envioDe(await pasada("2026-09-24", "12:05"), "te-echamos-de-menos")).toMatchObject({ destinatarios: 0 });
  });
});

describe("la racha", () => {
  it("cuatro días seguidos: a la mañana siguiente, promo; al cerrar, se quita", async () => {
    // Lunes a jueves; el viernes 25 por la mañana le llega.
    const serial = await cliente(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"], { alta: "2026-09-21" });

    const r = await pasada("2026-09-25", "08:05");
    expect(envioDe(r, "racha")).toMatchObject({ destinatarios: 1 });
    expect((await store.getCliente(serial)).mensaje).toMatch(/^4 días seguidos viniendo/);

    // El viernes cierra a las 16:30: a las 16:45 la promo de hoy ya no vale.
    const cierre = await pasada("2026-09-25", "16:45");
    expect(cierre.find((x) => x.negocio === "delicanteria").retirados).toBe(1);
    expect((await store.getCliente(serial)).mensaje).toBeNull();
  });

  it("el sábado sale al abrir (8:30), no a las 8:00", async () => {
    await cliente(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"], { alta: "2026-09-22" });
    expect(envioDe(await pasada("2026-09-26", "08:10"), "racha")).toBeUndefined();
    expect(envioDe(await pasada("2026-09-26", "08:35"), "racha")).toMatchObject({ destinatarios: 1 });
  });
});

describe("una sola cosa a la vez", () => {
  it("a quien encaja en dos reglas le llega la primera de la lista", async () => {
    // Cartilla completa y 25 días sin venir: premio pendiente (10:00) y te echamos de menos (12:00).
    const serial = await cliente(["2026-08-30"], { sellos: 8 });
    expect(envioDe(await pasada("2026-09-24", "10:05"), "premio-pendiente")).toMatchObject({ destinatarios: 1 });
    // A las 12:00 le tocaría la otra, pero la pausa de 3 días lo impide.
    expect(envioDe(await pasada("2026-09-24", "12:05"), "te-echamos-de-menos")).toMatchObject({ destinatarios: 0 });
    expect((await store.getCliente(serial)).mensaje).toMatch(/cookie gratis te está esperando/);
  });
});

describe("enviar ahora y la pantalla", () => {
  it("el manager puede mandar una regla fuera de su hora; lo demás se respeta", async () => {
    await cliente(["2026-09-01"]);
    vi.setSystemTime(valencia("2026-09-24", "09:00"));
    const negocio = await store.getNegocio("delicanteria");
    const r = await motor.repasarNegocio(negocio, { soloRegla: "te-echamos-de-menos" });
    expect(r.envios).toEqual([expect.objectContaining({ regla: "te-echamos-de-menos", destinatarios: 1 })]);
    expect((await motor.repasarNegocio(negocio, { soloRegla: "te-echamos-de-menos" })).envios[0].destinatarios).toBe(0);
  });

  it("la pantalla sabe a cuántos les llegaría cada regla y si el reloj anda", async () => {
    await cliente(["2026-09-01"]);
    await cliente(["2026-09-02"], { instalado: false });
    vi.setSystemTime(valencia("2026-09-24", "09:00"));
    let d = await motor.datosAvisos("delicanteria");
    expect(d.conteos["te-echamos-de-menos"]).toEqual({ encajan: 2, llegaria: 1 });
    expect(d.reloj.ultimo).toBeNull();

    await pasada("2026-09-24", "12:05");
    d = await motor.datosAvisos("delicanteria");
    expect(d.reloj.ultimo).toBeTruthy();
    expect(d.historial[0]).toMatchObject({ etiqueta: "Te echamos de menos", automatico: true, destinatarios: 1 });
    expect(d.conteos["te-echamos-de-menos"].llegaria).toBe(0);
  });
});
