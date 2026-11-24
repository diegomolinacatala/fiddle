import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  normalizarPlanes, validarPlanes, conPlan, tiene, conAvisosAvanzados, conAbierto, promoDe, cupoDe, quedaCupo,
  IDS_PLAN, FUNCIONES, PLAN_POR_DEFECTO, PLAN_DEL_ALTA, planQueLoLleva,
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
  it("Gratis con todo y hasta 50 tarjetas, sin margen; Básico y Pro sin límite; Pro con todo", () => {
    expect(IDS_PLAN).toEqual(["gratis", "basico", "pro"]);
    expect(planes.gratis).toMatchObject({ maxTarjetas: 50, margen: 0 });
    expect(Object.values(planes.gratis.funciones).every((v) => v === true)).toBe(true);
    expect(Object.values(planes.pro.funciones).every((v) => v === true)).toBe(true);
    expect(planes.pro.maxTarjetas).toBeNull();
    expect(PLAN_DEL_ALTA).toBe("gratis");
  });

  it("Básico: sin límite, con promociones y estadísticas y sin lo demás", () => {
    expect(planes.basico).toMatchObject({ nombre: "Básico", maxTarjetas: null, margen: 0 });
    const n = enPlan("basico");
    expect(n.cupo).toBeNull();
    expect(cupoDe(n, 1e6)).toBeNull();
    const llevaBasico = FUNCIONES.filter((f) => tiene(n, f.id)).map((f) => f.id);
    expect(llevaBasico).toEqual(["estadisticas", "promos"]);
  });

  it("«va en el plan X» dice el de pago más barato que lo lleva, nunca Gratis", () => {
    expect(planQueLoLleva(planes, "promos")).toBe("Básico");
    expect(planQueLoLleva(planes, "estadisticas")).toBe("Básico");
    for (const f of ["grupos", "avisosAvanzados", "plantilla", "abierto", "ubicacion"]) expect(planQueLoLleva(planes, f)).toBe("Pro");
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

  it("un plan que ya no existe (Esencial, Plus) es Pro, también ahora que hay Básico: nadie pierde nada", () => {
    for (const viejo of ["esencial", "plus"]) {
      const n = conPlan({ ...base, plan: viejo }, planes);
      expect(n.planId).toBe("pro");
      expect(n.cupo).toBeNull();
    }
    expect(componerNegocio("nube", { slug: "nube", nombre: "Nube", tipo: "sellos", config: { plan: "esencial" } }).plan).toBeNull();
  });

  it("lo guardado manda sobre lo de partida, y lo que no se entiende se queda como estaba", () => {
    const p = normalizarPlanes({
      gratis: { maxTarjetas: 30, margen: 5, funciones: { promos: false } },
      pro: { maxTarjetas: 0, margen: -5, funciones: { estadisticas: "sí" } },
      esencial: { maxTarjetas: 500 },
    });
    expect(p.gratis).toMatchObject({ maxTarjetas: 30, margen: 5 });
    expect(p.gratis.funciones.promos).toBe(false);
    expect(p.gratis.funciones.estadisticas).toBe(true);
    // Un 0 no deja a nadie sin tarjetas; un margen negativo, tampoco.
    expect(p.pro.maxTarjetas).toBeNull();
    expect(p.pro.margen).toBe(0);
    expect(p.pro.funciones.estadisticas).toBe(true);
    // Lo de un plan que ya no existe se ignora.
    expect(Object.keys(p)).toEqual(["gratis", "basico", "pro"]);
    // Lo guardado de antes de Básico (solo gratis y pro) lo deja con lo de partida.
    expect(p.basico.funciones).toEqual(planes.basico.funciones);
  });
});

describe("validarPlanes (lo que manda el admin)", () => {
  const entero = () => Object.fromEntries(IDS_PLAN.map((id) => [id, { ...planes[id] }]));

  it("acepta los planes enteros", () => {
    const r = validarPlanes(entero());
    expect(r.error).toBeUndefined();
    expect(Object.keys(r.planes)).toEqual(IDS_PLAN);
  });

  it("rechaza un límite que no es un número entero mayor que 0, o una función sin decir", () => {
    expect(validarPlanes({ ...entero(), gratis: { ...planes.gratis, maxTarjetas: 0 } }).error).toMatch(/límite/);
    expect(validarPlanes({ ...entero(), gratis: { ...planes.gratis, maxTarjetas: 12.5 } }).error).toMatch(/límite/);
    expect(validarPlanes({ ...entero(), gratis: { ...planes.gratis, margen: -1 } }).error).toMatch(/margen/);
    const sinPromos = { ...planes.pro.funciones };
    delete sinPromos.promos;
    expect(validarPlanes({ ...entero(), pro: { ...planes.pro, funciones: sinPromos } }).error).toMatch(/Promociones/);
    expect(validarPlanes({ gratis: planes.gratis }).error).toMatch(/Falta el plan/);
  });
});

describe("el límite de tarjetas", () => {
  it("Gratis: avisa al 90 % y a las 50 se cierra (sin margen)", () => {
    const g = enPlan("gratis");
    expect(cupoDe(g, 10).estado).toBe("libre");
    expect(cupoDe(g, 45).estado).toBe("cerca");
    expect(quedaCupo(g, 49)).toBe(true);
    expect(cupoDe(g, 50).estado).toBe("cerrado");
    expect(quedaCupo(g, 50)).toBe(false);
  });

  it("con margen, llega al límite y se cierra con el margen", () => {
    const n = conPlan({ ...base, plan: "gratis" }, normalizarPlanes({ gratis: { maxTarjetas: 500, margen: 50 } })); // 500 + 50
    expect(cupoDe(n, 100).estado).toBe("libre");
    expect(cupoDe(n, 450).estado).toBe("cerca");
    expect(cupoDe(n, 500).estado).toBe("lleno");
    expect(quedaCupo(n, 549)).toBe(true);
    expect(cupoDe(n, 550).estado).toBe("cerrado");
    expect(quedaCupo(n, 550)).toBe(false);
    // Sin límite, siempre.
    expect(cupoDe(enPlan("pro"), 1e6)).toBeNull();
    expect(quedaCupo(enPlan("pro"), 1e6)).toBe(true);
  });
});

describe("lo que esconde un plan sin funciones (si el admin se las quita)", () => {
  // Los dos de partida llevan todo; el admin puede quitarle cosas a uno en Planes.
  const ninguna = Object.fromEntries(FUNCIONES.map((f) => [f.id, false]));
  const sinNada = normalizarPlanes({ gratis: { funciones: ninguna } });
  const soloPromos = normalizarPlanes({ gratis: { funciones: { ...ninguna, estadisticas: true, promos: true } } });
  const conPlanes = (p, extra = {}) => conPlan({ ...base, ...extra, plan: "gratis" }, p);
  const conTodo = { promo: "2x1 hoy", ubicaciones: [{ lat: 39.47, lng: -0.37 }], avisosAvanzados: true, plantillaActiva: true,
    horario: componerNegocio("delicanteria", null).horario };

  it("sin nada: ni promo en la tarjeta, ni ubicación, ni «Abierto hasta…», ni avisos ni plantilla", () => {
    const n = conPlanes(sinNada, conTodo);
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

  it("Básico: la promo en la tarjeta, pero ni ubicación, ni «Abierto hasta…», ni avisos ni plantilla", () => {
    const n = enPlan("basico", conTodo);
    expect(camposDelPase(cliente, n).auxiliaryFields[0]).toMatchObject({ key: "promo", value: "2x1 hoy" });
    expect(promoDe(n)).toBe("2x1 hoy");
    expect(ubicacionesApple(n)).toHaveLength(0);
    expect(conAbierto(n)).toBe(false);
    expect(conAvisosAvanzados(n)).toBe(false);
    expect(conPlantilla(n)).toBe(false);
    expect(fueraDelPlan(n, "todos")).toBeNull();
    expect(fueraDelPlan(n, "en_riesgo")?.status).toBe(403);
    expect(pestanasDe(n.funciones).map(([k]) => k)).toEqual(["resumen", "clientes", "actividad"]);
  });

  it("Pro: todo como siempre", () => {
    const n = enPlan("pro", conTodo);
    expect(camposDelPase(cliente, n).auxiliaryFields[0]).toMatchObject({ key: "promo", value: "2x1 hoy" });
    expect(ubicacionesApple(n)).toHaveLength(1);
    expect(conAvisosAvanzados(n)).toBe(true);
    expect(conPlantilla(n)).toBe(true);
  });

  it("la tarjeta web recibe qué deja su plan, para esconder lo mismo que Wallet", () => {
    expect(negocioDeTarjeta(conPlanes(sinNada, conTodo)).funciones.promos).toBe(false);
  });

  it("enviar: a todos es una promoción y lo demás un grupo", () => {
    expect(fueraDelPlan(conPlanes(sinNada), "todos")?.status).toBe(403);
    expect(fueraDelPlan(conPlanes(soloPromos), "todos")).toBeNull();
    expect(fueraDelPlan(conPlanes(soloPromos), "momento")).toBeNull();
    expect(fueraDelPlan(conPlanes(soloPromos), "en_riesgo")?.status).toBe(403);
    expect(fueraDelPlan(enPlan("pro"), "en_riesgo")).toBeNull();
    expect(fueraDelPlan(enPlan("gratis"), "en_riesgo")).toBeNull();
  });

  it("Clientes: Resumen con estadísticas y Grupos con los grupos; la lista y la Actividad, siempre", () => {
    const claves = (n) => pestanasDe(n.funciones).map(([k]) => k);
    expect(claves(conPlanes(sinNada))).toEqual(["clientes", "actividad"]);
    expect(claves(conPlanes(soloPromos))).toEqual(["resumen", "clientes", "actividad"]);
    expect(claves(enPlan("pro"))).toEqual(["resumen", "grupos", "clientes", "actividad"]);
    expect(claves(enPlan("gratis"))).toEqual(["resumen", "grupos", "clientes", "actividad"]);
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
    const r = validarPlanes({ ...planes, gratis: { ...planes.gratis, maxTarjetas: 2, margen: 1 } });
    await store.guardarPlanes(r.planes);
    await store.saveNegocio("nube", { plan: "gratis" });
    const n = await store.getNegocio("nube");
    expect(n.plan).toBe("gratis");
    expect(n.cupo).toEqual({ max: 2, margen: 1 });
    // Guardar otra cosa no toca el plan ni escribe lo que el plan esconde.
    await store.saveNegocio("nube", { promo: null });
    expect((await store.getNegocio("nube")).plan).toBe("gratis");
  });

  it("con el límite y el margen llenos ya no se da otra, y las que hay siguen", async () => {
    const r = validarPlanes({ ...planes, gratis: { ...planes.gratis, maxTarjetas: 2, margen: 1 } });
    await store.guardarPlanes(r.planes);
    await store.saveNegocio("nube", { plan: "gratis" });
    for (let i = 0; i < 3; i++) await emitirPase("nube", { origen: "tap" });
    expect(await store.contarTarjetas("nube")).toBe(3);
    await expect(emitirPase("nube", { origen: "tap" })).rejects.toBeInstanceOf(TiendaLlena);
    // Otra tienda sin plan elegido (Pro) sigue dando las que quiera.
    await expect(emitirPase("forno", { origen: "tap" })).resolves.toBeTruthy();
  });

  it("solo cuentan las tarjetas en uso: la que nadie guardó ni usó deja sitio pasado su día", async () => {
    const ahora = Date.now();
    const instalada = (await emitirPase("nube", { origen: "tap" })).cliente.serial;
    const usada = (await emitirPase("nube", { origen: "tap" })).cliente.serial;
    await emitirPase("nube", { origen: "tap" }); // escaneó y se fue
    // Recién sacadas, cuentan las tres (aún pueden guardarla).
    expect(await store.contarTarjetas("nube", ahora)).toBe(3);
    // Dos días después: la instalada y la que tiene una visita cuentan; la otra no.
    await store.marcarInstalacion(instalada, true);
    await store.registrarVisita(usada);
    const pasado = ahora + 2 * 86400000;
    expect(await store.contarTarjetas("nube", pasado)).toBe(2);
    // Una que se quitó del Wallet sigue contando: tiene dueño.
    await store.marcarInstalacion(instalada, false);
    expect(await store.contarTarjetas("nube", pasado)).toBe(2);
  });
});
