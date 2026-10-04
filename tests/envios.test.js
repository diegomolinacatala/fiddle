import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  horasParaEnviar, horaValida, horaSugerida, caducidadMomento, cuandoEnvioTexto, instanteLocal,
  repartirPendientes, enviosVisibles, esDestino,
} from "@/lib/envios";

// ============================================================================
// «Enviar a las…»: qué horas se ofrecen, qué acepta el servidor y cómo lo manda
// el reloj. Valencia en octubre = UTC+2; en noviembre, UTC+1.
// ============================================================================

const valencia = (fecha, hora) => new Date(`${fecha}T${hora}:00+02:00`).getTime();

// Horario partido: mañana y tarde. El viernes, solo mañana. Sábado cerrado.
const partido = {
  zona: "Europe/Madrid",
  semana: [
    [{ abre: "09:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:00" }],
    [{ abre: "09:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:00" }],
    [{ abre: "09:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:00" }],
    [{ abre: "09:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:00" }],
    [{ abre: "09:00", cierra: "14:00" }],
    null,
    null,
  ],
  cerrados: [],
};

describe("las horas que se ofrecen", () => {
  it("hoy, de ahora al ÚLTIMO cierre, con el descanso de mediodía dentro; mañana, de la apertura al PRIMER cierre", () => {
    // Martes 6 de octubre de 2026, 12:52.
    const { hoy, manana, motivo } = horasParaEnviar(partido, valencia("2026-10-06", "12:52"));
    expect(motivo).toBeNull();
    expect(hoy[0].hora).toBe("13:00"); // al menos 5 min por delante, en el cuarto siguiente
    expect(hoy.map((h) => h.hora)).toContain("15:30"); // en el descanso, sí
    expect(hoy.at(-1).hora).toBe("19:45");
    expect(manana[0].hora).toBe("09:00");
    expect(manana.at(-1).hora).toBe("13:45"); // la tarde de mañana, no
    expect(manana.every((h) => h.fecha === "2026-10-07")).toBe(true);
    // De 15 en 15, como pasa el reloj.
    expect(hoy.every((h) => h.minutos % 15 === 0)).toBe(true);
  });

  it("antes de abrir, desde que abre; nada a las 7 de la mañana", () => {
    const { hoy } = horasParaEnviar(partido, valencia("2026-10-06", "07:10"));
    expect(hoy[0].hora).toBe("09:00");
  });

  it("después de cerrar, solo mañana; un viernes por la noche, nada (el sábado cierra)", () => {
    expect(horasParaEnviar(partido, valencia("2026-10-06", "21:00")).hoy).toEqual([]);
    expect(horasParaEnviar(partido, valencia("2026-10-09", "21:00"))).toEqual({ hoy: [], manana: [], motivo: "cerrada" });
  });

  it("los festivos cuentan como cerrados", () => {
    const festivo = { ...partido, cerrados: ["2026-10-07"] };
    expect(horasParaEnviar(festivo, valencia("2026-10-06", "21:00")).manana).toEqual([]);
  });

  it("sin horario no hay horas: hace falta saber cuándo abre", () => {
    expect(horasParaEnviar(null)).toEqual({ hoy: [], manana: [], motivo: "sin_horario" });
  });

  it("la hora es la de la tienda, también el día que cambia la hora", () => {
    // 25 de octubre de 2026: a las 3:00 vuelven a ser las 2:00 (UTC+2 -> UTC+1).
    expect(new Date(instanteLocal("2026-10-25", 10 * 60, "Europe/Madrid")).toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(new Date(instanteLocal("2026-10-24", 10 * 60, "Europe/Madrid")).toISOString()).toBe("2026-10-24T08:00:00.000Z");
  });
});

describe("lo que acepta el servidor", () => {
  const ahora = valencia("2026-10-06", "12:52");

  it("una hora de la lista, sí; una de pasado mañana o de la tarde de mañana, no", () => {
    const { hoy, manana } = horasParaEnviar(partido, ahora);
    expect(horaValida(partido, hoy[3].cuando, ahora)).toBe(Date.parse(hoy[3].cuando));
    expect(horaValida(partido, manana[0].cuando, ahora)).toBe(Date.parse(manana[0].cuando));
    expect(horaValida(partido, new Date(valencia("2026-10-07", "18:00")).toISOString(), ahora)).toBeNull();
    expect(horaValida(partido, new Date(valencia("2026-10-08", "10:00")).toISOString(), ahora)).toBeNull();
    expect(horaValida(partido, "mañana", ahora)).toBeNull();
  });

  it("una que se eligió hace un minuto y ya es la de ahora, todavía vale; una de hace una hora, no", () => {
    const elegida = horasParaEnviar(partido, valencia("2026-10-06", "12:52")).hoy[0].cuando; // 13:00
    expect(horaValida(partido, elegida, valencia("2026-10-06", "12:58"))).not.toBeNull();
    expect(horaValida(partido, elegida, valencia("2026-10-06", "14:00"))).toBeNull();
  });

  it("los destinos son los grupos del CRM, todos y «solo ese día»", () => {
    expect(["todos", "momento", "premio_listo", "riesgo"].every(esDestino)).toBe(true);
    expect(esDestino("inventado")).toBe(false);
  });
});

describe("lo que propone «lo que dicen los números»", () => {
  it("si el día es hoy, esa hora; si es mañana, la de mañana; si no, ninguna", () => {
    const martes = valencia("2026-10-06", "10:00"); // dia 1
    expect(horaSugerida(partido, { dia: 1, hora: "16:00" }, martes).cuando).toBe(new Date(valencia("2026-10-06", "16:00")).toISOString());
    expect(horaSugerida(partido, { dia: 2, hora: "10:00" }, martes).cuando).toBe(new Date(valencia("2026-10-07", "10:00")).toISOString());
    // La tarde de mañana no se puede elegir: nada, y la pantalla dice cuándo tocaría.
    expect(horaSugerida(partido, { dia: 2, hora: "17:00" }, martes)).toEqual({ cuando: null, dia: 2, hora: "17:00" });
    expect(horaSugerida(partido, { dia: 4, hora: "10:00" }, martes).cuando).toBeNull();
  });
});

describe("textos y caducidad", () => {
  it("«hoy a las 17:30», «mañana a las 9:00»", () => {
    const ahora = valencia("2026-10-06", "12:52");
    expect(cuandoEnvioTexto(new Date(valencia("2026-10-06", "17:30")).toISOString(), partido, ahora)).toBe("hoy a las 17:30");
    expect(cuandoEnvioTexto(new Date(valencia("2026-10-07", "09:00")).toISOString(), partido, ahora)).toBe("mañana a las 9:00");
  });

  it("«solo ese día» se quita al último cierre, no al de mediodía", () => {
    expect(caducidadMomento(partido, valencia("2026-10-06", "10:00"))).toBe(new Date(valencia("2026-10-06", "20:00")).toISOString());
  });

  it("los que tocan salen de la lista; los «retirar» no los ve el manager", () => {
    const lista = [
      { id: "a", cuando: "2026-10-06T10:00:00Z", destino: "todos", texto: "x" },
      { id: "b", cuando: "2026-10-06T18:00:00Z", destino: "riesgo", texto: "y" },
      { id: "c", cuando: "2026-10-06T18:00:00Z", accion: "retirar", texto: "z", seriales: ["s"] },
      { id: "d", cuando: "2026-10-06T18:00:00Z", destino: "inventado", texto: "malo" },
    ];
    const { tocan, esperan } = repartirPendientes(lista, Date.parse("2026-10-06T12:00:00Z"));
    expect(tocan.map((p) => p.id)).toEqual(["a"]);
    expect(esperan.map((p) => p.id)).toEqual(["b", "c"]);
    expect(enviosVisibles(lista).map((p) => p.id)).toEqual(["a", "b"]);
  });
});

// ------------------------------------------------- con el store y las rutas
vi.mock("@/lib/wallet", async (original) => ({
  ...(await original()),
  notificarNegocio: vi.fn(async () => ({ proveedor: "demo", total: 0 })),
}));

describe("programar, cancelar y que lo mande el reloj", () => {
  let dir;
  let store;
  let rutaEnvios;
  let motor;
  let firmarSesion;
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-envios-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    vi.useFakeTimers({ toFake: ["Date"] });
    store = await import("@/lib/store");
    rutaEnvios = await import("@/app/api/envios/route.js");
    motor = await import("@/lib/motorAvisos");
    ({ firmarSesion } = await import("@/lib/auth"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  async function pedir(metodo, cuerpo) {
    return new NextRequest("http://x/api/envios", {
      method: metodo,
      headers: { cookie: `sesion=${await firmarSesion("delicanteria", "manager")}`, "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  }
  const latido = () => store.registrarIntento(motor.CLAVE_RELOJ);

  async function clienteConPase(serial) {
    await store.crearCliente({ serial, negocio: "delicanteria", authToken: "t".repeat(24) });
    await store.registrarPase({ dispositivo: `web-${serial}`, pushToken: "{}", passType: "web", serial, negocio: "delicanteria" });
  }

  it("sin reloj no deja programar: no saldría nunca", async () => {
    vi.setSystemTime(valencia("2026-10-06", "10:00")); // martes, abre 7:30–18:30
    const r = await rutaEnvios.POST(await pedir("POST", { b: "delicanteria", destino: "momento", texto: "Hola", cuando: new Date(valencia("2026-10-06", "12:00")).toISOString() }));
    expect(r.status).toBe(409);
  });

  it("se programa, se ve, se cancela", async () => {
    vi.setSystemTime(valencia("2026-10-06", "10:00"));
    await latido();
    const cuando = new Date(valencia("2026-10-06", "12:00")).toISOString();
    const r = await rutaEnvios.POST(await pedir("POST", { b: "delicanteria", destino: "premio_listo", texto: "Tu premio te espera", cuando }));
    expect(r.status).toBe(201);
    const { pendientes } = await r.json();
    expect(pendientes).toEqual([expect.objectContaining({ destino: "premio_listo", texto: "Tu premio te espera", cuando })]);
    // Una hora fuera de lo permitido (pasado mañana), no.
    const mal = await rutaEnvios.POST(await pedir("POST", { b: "delicanteria", destino: "premio_listo", texto: "x", cuando: new Date(valencia("2026-10-08", "10:00")).toISOString() }));
    expect(mal.status).toBe(400);

    const fuera = await rutaEnvios.DELETE(await pedir("DELETE", { b: "delicanteria", id: pendientes[0].id }));
    expect((await fuera.json()).pendientes).toEqual([]);
  });

  it("el reloj lo manda a su hora, una vez, a los del grupo DE ESE MOMENTO; «solo ese día» se quita al cerrar", async () => {
    vi.setSystemTime(valencia("2026-10-06", "10:00"));
    await latido();
    await clienteConPase("s-1");
    const cuando = new Date(valencia("2026-10-06", "12:00")).toISOString();
    await rutaEnvios.POST(await pedir("POST", { b: "delicanteria", destino: "momento", texto: "Hoy está tranquilo", cuando }));
    // Se da de alta otro después de programarlo: también le llega.
    await clienteConPase("s-2");

    vi.setSystemTime(valencia("2026-10-06", "11:50"));
    let r = await motor.repasarTodas();
    expect(r.find((x) => x.negocio === "delicanteria").programados).toEqual([]);

    vi.setSystemTime(valencia("2026-10-06", "12:05"));
    r = await motor.repasarTodas();
    expect(r.find((x) => x.negocio === "delicanteria").programados).toEqual([expect.objectContaining({ destino: "momento", destinatarios: 2 })]);
    expect((await store.getCliente("s-1")).mensaje).toBe("Hoy está tranquilo");
    expect((await store.getCliente("s-2")).mensaje).toBe("Hoy está tranquilo");

    // Otra pasada no lo repite.
    vi.setSystemTime(valencia("2026-10-06", "12:20"));
    r = await motor.repasarTodas();
    expect(r.find((x) => x.negocio === "delicanteria").programados).toEqual([]);

    // Al cerrar (18:30) se quita; a quien le llegó otro después, no se le toca.
    await store.guardarMensajes(["s-2"], "Otro mensaje");
    vi.setSystemTime(valencia("2026-10-06", "18:35"));
    r = await motor.repasarTodas();
    expect(r.find((x) => x.negocio === "delicanteria").programados).toEqual([expect.objectContaining({ retirados: 1 })]);
    expect((await store.getCliente("s-1")).mensaje).toBeNull();
    expect((await store.getCliente("s-2")).mensaje).toBe("Otro mensaje");
  });

  it("sale aunque los automáticos estén apagados por el admin: es un envío a mano, con hora", async () => {
    vi.setSystemTime(valencia("2026-10-06", "10:00"));
    await latido();
    await clienteConPase("s-1");
    expect((await store.getNegocio("delicanteria")).avisosAvanzados).toBe(false);
    await rutaEnvios.POST(await pedir("POST", { b: "delicanteria", destino: "todos", texto: "2x1 esta tarde", cuando: new Date(valencia("2026-10-06", "16:00")).toISOString() }));
    vi.setSystemTime(valencia("2026-10-06", "16:02"));
    await motor.repasarTodas();
    expect((await store.getNegocio("delicanteria")).promo).toBe("2x1 esta tarde");
  });
});
