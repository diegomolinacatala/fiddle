import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  normalizarPlanes, validarPlanes, conPlan, tiene, conAvisosAvanzados, conAbierto, promoDe, cupoDe, quedaCupo,
  PLANES_DE_PARTIDA, IDS_PLAN, FUNCIONES, PLAN_POR_DEFECTO,
} from "@/lib/planes";
import { componerNegocio } from "@/lib/negocios";
import { camposDelPase, ubicacionesApple } from "@/lib/apple/pase";
import { estadoDeTienda } from "@/lib/horario";
import { conPlantilla } from "@/lib/plantilla";
import { negocioDeTarjeta } from "@/lib/tarjeta";
import { fueraDelPlan } from "@/lib/campanas";
import { pestanasDe } from "@/app/[negocio]/crm/pestanas";

// ============================================================================
// PLANES (lib/planes.js): qué deja cada plan, el límite de tarjetas y que una
// tienda sin plan (como La Delicantería antes de elegirlo) no pierda nada.
// ============================================================================

const store = await import("@/lib/store");
const { emitirPase, TiendaLlena } = await import("@/lib/wallet");

const planes = normalizarPlanes(null);
const base = componerNegocio("nube", null);
const enPlan = (plan, extra = {}) => conPlan({ ...base, ...extra, plan }, planes);
const cliente = { serial: "s1", sellos: 2, premios: 0, codigo: "K7M", auth_token: "x".repeat(24) };

describe("los planes de partida", () => {
  it("Esencial sin nada y con 750 tarjetas; Plus con estadísticas y promos; Pro con todo", () => {
    expect(planes.esencial.maxTarjetas).toBe(750);
    expect(Object.values(planes.esencial.funciones).every((v) => v === false)).toBe(true);
    expect(Object.entries(planes.plus.funciones).filter(([, v]) => v).map(([k]) => k).sort()).toEqual(["estadisticas", "promos"]);
    expect(planes.plus.maxTarjetas).toBeNull();
    expect(Object.values(planes.pro.funciones).every((v) => v === true)).toBe(true);
    expect(planes.pro.maxTarjetas).toBeNull();
  });

  it("sin plan es Pro: una tienda de antes no pierde nada", () => {
    expect(PLAN_POR_DEFECTO).toBe("pro");
    const sinPlan = conPlan({ ...base, plan: null }, planes);
    expect(sinPlan.planId).toBe("pro");
    expect(sinPlan.cupo).toBeNull();
    for (const f of FUNCIONES) expect(tiene(sinPlan, f.id)).toBe(true);
    // Sin `funciones` (no pasó por el store), tampoco se quita nada.
    expect(tiene({}, "promos")).toBe(true);
  });

  it("lo guardado manda sobre lo de partida, y lo que no se entiende se queda como estaba", () => {
    const p = normalizarPlanes({
      esencial: { maxTarjetas: 300, margen: 20, funciones: { promos: true } },
      plus: { maxTarjetas: 0, margen: -5, funciones: { estadisticas: "sí" } },
      pro: { maxTarjetas: null },
    });
    expect(p.esencial).toMatchObject({ maxTarjetas: 300, margen: 20 });
    expect(p.esencial.funciones.promos).toBe(true);
    expect(p.esencial.funciones.estadisticas).toBe(false);
    // Un 0 no deja a nadie sin tarjetas; un margen negativo, tampoco.
    expect(p.plus.maxTarjetas).toBe(PLANES_DE_PARTIDA.plus.maxTarjetas);
    expect(p.plus.margen).toBe(0);
    expect(p.plus.funciones.estadisticas).toBe(true);
    expect(p.pro.maxTarjetas).toBeNull();
  });
});

describe("validarPlanes (lo que manda el admin)", () => {
  const entero = () => Object.fromEntries(IDS_PLAN.map((id) => [id, { ...planes[id] }]));

  it("acepta los tres planes enteros", () => {
    const r = validarPlanes(entero());
    expect(r.error).toBeUndefined();
    expect(Object.keys(r.planes)).toEqual(IDS_PLAN);
  });

  it("rechaza un límite que no es un número entero mayor que 0, o una función sin decir", () => {
    expect(validarPlanes({ ...entero(), esencial: { ...planes.esencial, maxTarjetas: 0 } }).error).toMatch(/límite/);
    expect(validarPlanes({ ...entero(), esencial: { ...planes.esencial, maxTarjetas: 12.5 } }).error).toMatch(/límite/);
    expect(validarPlanes({ ...entero(), esencial: { ...planes.esencial, margen: -1 } }).error).toMatch(/margen/);
    const sinPromos = { ...planes.plus.funciones };
    delete sinPromos.promos;
    expect(validarPlanes({ ...entero(), plus: { ...planes.plus, funciones: sinPromos } }).error).toMatch(/Promociones/);
    expect(validarPlanes({ esencial: planes.esencial }).error).toMatch(/Falta el plan/);
  });
});

describe("el límite de tarjetas", () => {
  it("avisa al 90 %, llega al límite y se cierra con el margen", () => {
    const n = enPlan("esencial"); // 750 + 50
    expect(cupoDe(n, 100).estado).toBe("libre");
    expect(cupoDe(n, 675).estado).toBe("cerca");
    expect(cupoDe(n, 750).estado).toBe("lleno");
    expect(quedaCupo(n, 799)).toBe(true);
    expect(cupoDe(n, 800).estado).toBe("cerrado");
    expect(quedaCupo(n, 800)).toBe(false);
    // Sin límite, siempre.
    expect(cupoDe(enPlan("pro"), 1e6)).toBeNull();
    expect(quedaCupo(enPlan("pro"), 1e6)).toBe(true);
  });
});

describe("lo que esconde cada plan", () => {
  const conTodo = { promo: "2x1 hoy", ubicaciones: [{ lat: 39.47, lng: -0.37 }], avisosAvanzados: true, plantillaActiva: true,
    horario: componerNegocio("delicanteria", null).horario };

  it("Esencial: ni promo en la tarjeta, ni ubicación, ni «Abierto hasta…», ni avisos ni plantilla", () => {
    const n = enPlan("esencial", conTodo);
    expect(promoDe(n)).toBeNull();
    expect(camposDelPase(cliente, n).auxiliaryFields).toEqual([]);
    expect(ubicacionesApple(n)).toEqual([]);
    expect(conAbierto(n)).toBe(false);
    expect(estadoDeTienda(n, Date.now())).toBeNull();
    expect(conAvisosAvanzados(n)).toBe(false);
    expect(conPlantilla(n)).toBe(false);
    // Lo guardado sigue ahí: no se borra nada.
    expect(n.promo).toBe("2x1 hoy");
    expect(n.avisosAvanzados).toBe(true);
    expect(n.plantillaActiva).toBe(true);
  });

  it("Pro: todo como siempre", () => {
    const n = enPlan("pro", conTodo);
    expect(camposDelPase(cliente, n).auxiliaryFields[0]).toMatchObject({ key: "promo", value: "2x1 hoy" });
    expect(ubicacionesApple(n)).toHaveLength(1);
    expect(conAvisosAvanzados(n)).toBe(true);
    expect(conPlantilla(n)).toBe(true);
  });

  it("la tarjeta web recibe qué deja su plan, para esconder lo mismo que Wallet", () => {
    expect(negocioDeTarjeta(enPlan("esencial", conTodo)).funciones.promos).toBe(false);
  });

  it("enviar: a todos es una promoción y lo demás un grupo", () => {
    expect(fueraDelPlan(enPlan("esencial"), "todos")?.status).toBe(403);
    expect(fueraDelPlan(enPlan("plus"), "todos")).toBeNull();
    expect(fueraDelPlan(enPlan("plus"), "momento")).toBeNull();
    expect(fueraDelPlan(enPlan("plus"), "en_riesgo")?.status).toBe(403);
    expect(fueraDelPlan(enPlan("pro"), "en_riesgo")).toBeNull();
  });

  it("Clientes: Resumen con estadísticas y Grupos con los grupos; la lista y la Actividad, siempre", () => {
    const claves = (plan) => pestanasDe(enPlan(plan).funciones).map(([k]) => k);
    expect(claves("esencial")).toEqual(["clientes", "actividad"]);
    expect(claves("plus")).toEqual(["resumen", "clientes", "actividad"]);
    expect(claves("pro")).toEqual(["resumen", "grupos", "clientes", "actividad"]);
  });
});

describe("dar tarjetas con el límite (backend de ficheros)", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "fiddle-planes-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "");
    store.olvidarPlanes();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    store.olvidarPlanes();
    rmSync(dir, { recursive: true, force: true });
  });

  it("los planes se guardan en la plataforma y la tienda los lleva al leerla", async () => {
    const r = validarPlanes({ ...planes, esencial: { ...planes.esencial, maxTarjetas: 2, margen: 1 } });
    await store.guardarPlanes(r.planes);
    await store.saveNegocio("nube", { plan: "esencial" });
    const n = await store.getNegocio("nube");
    expect(n.plan).toBe("esencial");
    expect(n.cupo).toEqual({ max: 2, margen: 1 });
    // Guardar otra cosa no toca el plan ni escribe lo que el plan esconde.
    await store.saveNegocio("nube", { promo: null });
    expect((await store.getNegocio("nube")).plan).toBe("esencial");
  });

  it("con el límite y el margen llenos ya no se da otra, y las que hay siguen", async () => {
    const r = validarPlanes({ ...planes, esencial: { ...planes.esencial, maxTarjetas: 2, margen: 1 } });
    await store.guardarPlanes(r.planes);
    await store.saveNegocio("nube", { plan: "esencial" });
    for (let i = 0; i < 3; i++) await emitirPase("nube", { origen: "tap" });
    expect(await store.contarTarjetas("nube")).toBe(3);
    await expect(emitirPase("nube", { origen: "tap" })).rejects.toBeInstanceOf(TiendaLlena);
    // Otra tienda sin plan elegido (Pro) sigue dando las que quiera.
    await expect(emitirPase("forno", { origen: "tap" })).resolves.toBeTruthy();
  });
});
