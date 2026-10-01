import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// Las rutas de los avisos con una sesión firmada de verdad. Poner al día los
// pases se espía: guardar el horario o una regla NO debe mover los teléfonos.
vi.mock("@/lib/wallet", async (original) => ({ ...(await original()), notificarNegocio: vi.fn(async () => ({ proveedor: "demo" })) }));

const { notificarNegocio } = await import("@/lib/wallet");
const { firmarSesion } = await import("@/lib/auth");
const store = await import("@/lib/store");
const cron = await import("@/app/api/cron/avisos/route.js");
const autos = await import("@/app/api/automatizaciones/route.js");
const negocioRuta = await import("@/app/api/negocio/route.js");
const negociosRuta = await import("@/app/api/negocios/route.js");

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-rutas-avisos-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  vi.mocked(notificarNegocio).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function pedir(url, { metodo = "GET", cuerpo, como = ["delicanteria", "manager"], cabeceras = {} } = {}) {
  const headers = { ...cabeceras };
  if (como) headers.cookie = `sesion=${await firmarSesion(...como)}`;
  if (cuerpo) headers["content-type"] = "application/json";
  return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
}

describe("/api/cron/avisos", () => {
  it("sin CRON_SECRET está apagado; con el secreto equivocado, fuera", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await cron.GET(await pedir("/api/cron/avisos", { como: null }))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "un-secreto-largo");
    const mal = await pedir("/api/cron/avisos", { como: null, cabeceras: { authorization: "Bearer otro" } });
    expect((await cron.GET(mal)).status).toBe(401);
  });

  it("con el secreto hace una pasada por las tiendas y deja el latido", async () => {
    vi.stubEnv("CRON_SECRET", "un-secreto-largo");
    const r = await cron.GET(await pedir("/api/cron/avisos", { como: null, cabeceras: { authorization: "Bearer un-secreto-largo" } }));
    expect(r.status).toBe(200);
    expect((await r.json()).resultados.map((x) => x.negocio)).toContain("delicanteria");
    expect(await store.ultimoIntento("reloj:avisos")).toBeTruthy();
  });
});

describe("/api/automatizaciones", () => {
  it("solo el manager de esa tienda", async () => {
    expect((await autos.GET(await pedir("/api/automatizaciones?b=delicanteria", { como: null }))).status).toBe(401);
    expect((await autos.GET(await pedir("/api/automatizaciones?b=delicanteria", { como: ["nube", "manager"] }))).status).toBe(403);
    expect((await autos.GET(await pedir("/api/automatizaciones?b=delicanteria", { como: ["delicanteria", "caja"] }))).status).toBe(403);
    const ok = await autos.GET(await pedir("/api/automatizaciones?b=delicanteria"));
    expect(ok.status).toBe(200);
    expect((await ok.json()).negocio.automatizaciones).toHaveLength(6);
  });

  it("guardar valida, guarda y no toca los pases", async () => {
    const { automatizaciones } = await store.getNegocio("delicanteria");
    const mal = await autos.PUT(await pedir("/api/automatizaciones?b=delicanteria", {
      metodo: "PUT", cuerpo: { automatizaciones: [{ ...automatizaciones[0], texto: "Hola {premo}" }] },
    }));
    expect(mal.status).toBe(400);
    expect((await mal.json()).error).toMatch(/premo/);

    const cambiadas = automatizaciones.map((r) => (r.id === "te-echamos-de-menos" ? { ...r, valor: 14, hora: "11:30" } : r));
    const ok = await autos.PUT(await pedir("/api/automatizaciones?b=delicanteria", {
      metodo: "PUT", cuerpo: { automatizaciones: cambiadas, pausaAvisos: 5 },
    }));
    expect(ok.status).toBe(200);
    const n = await store.getNegocio("delicanteria");
    expect(n.automatizaciones.find((r) => r.id === "te-echamos-de-menos")).toMatchObject({ valor: 14, hora: "11:30" });
    expect(n.pausaAvisos).toBe(5);
    expect(notificarNegocio).not.toHaveBeenCalled();
  });

  it("enviar ahora: solo reglas guardadas", async () => {
    const no = await autos.POST(await pedir("/api/automatizaciones?b=delicanteria", { metodo: "POST", cuerpo: { regla: "inventada" } }));
    expect(no.status).toBe(404);
    const si = await autos.POST(await pedir("/api/automatizaciones?b=delicanteria", { metodo: "POST", cuerpo: { regla: "racha" } }));
    expect(si.status).toBe(200);
    expect((await si.json()).envio).toMatchObject({ regla: "racha", destinatarios: 0 });
  });
});

describe("el interruptor de los avisos automáticos", () => {
  it("empieza apagado; el manager lo enciende y lo apaga sin tocar las reglas", async () => {
    const antes = await (await autos.GET(await pedir("/api/automatizaciones?b=delicanteria"))).json();
    expect(antes.negocio.avisosActivos).toBe(false);

    const on = await autos.PUT(await pedir("/api/automatizaciones?b=delicanteria", { metodo: "PUT", cuerpo: { avisosActivos: true } }));
    expect(on.status).toBe(200);
    const datos = await on.json();
    expect(datos.negocio.avisosActivos).toBe(true);
    expect(datos.negocio.automatizaciones).toEqual(antes.negocio.automatizaciones);

    const off = await autos.PUT(await pedir("/api/automatizaciones?b=delicanteria", { metodo: "PUT", cuerpo: { avisosActivos: false } }));
    expect((await off.json()).negocio.avisosActivos).toBe(false);
  });

  it("un PUT vacío no guarda nada", async () => {
    const r = await autos.PUT(await pedir("/api/automatizaciones?b=delicanteria", { metodo: "PUT", cuerpo: {} }));
    expect(r.status).toBe(400);
  });
});

describe("PUT /api/negocio desde el manager", () => {
  it("pedir el nombre al escanear: apagado de partida, se enciende sin mover los teléfonos", async () => {
    expect((await store.getNegocio("delicanteria")).pedirNombre).toBe(false);
    const r = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", { metodo: "PUT", cuerpo: { pedirNombre: true } }));
    const data = await r.json();
    expect(data.pedirNombre).toBe(true);
    expect(data.aviso).toBeNull();
  });

  it("el horario se guarda sin mover los teléfonos", async () => {
    const { horario } = await store.getNegocio("delicanteria");
    const semana = horario.semana.map((t, i) => (i === 5 ? null : t)); // cierra también los sábados
    const r = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", { metodo: "PUT", cuerpo: { horario: { ...horario, semana } } }));
    expect(r.status).toBe(200);
    expect((await store.getNegocio("delicanteria")).horario.semana[5]).toBeNull();
    expect(notificarNegocio).not.toHaveBeenCalled();
  });

  it("con dos cartillas, el manager cambia nombre, dibujo, meta y premio de cada una, pero no cuántas hay", async () => {
    const r = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", {
      metodo: "PUT",
      cuerpo: { cartillas: [{ meta: 10, premio: "cookie de regalo" }, { meta: 6, premio: "té gratis", nombre: "Tés", marca: "rayo" }, { meta: 3, premio: "otra" }] },
    }));
    expect(r.status).toBe(200);
    const n = await store.getNegocio("delicanteria");
    expect(n.cartillas).toEqual([
      { nombre: "Cookies", marca: "galleta", meta: 10, premio: "cookie de regalo" },
      { nombre: "Tés", marca: "rayo", meta: 6, premio: "té gratis" },
    ]);
    expect(n).toMatchObject({ meta: 10, premio: "cookie de regalo" });
    expect(notificarNegocio).toHaveBeenCalledTimes(1); // esto sí sale en el pase

    const quitar = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", { metodo: "PUT", cuerpo: { cartillas: null } }));
    expect(quitar.status).toBe(200);
    expect((await store.getNegocio("delicanteria")).cartillas).toHaveLength(2);
  });

  it("el editor de la tarjeta cambia nombre, colores y dibujo, y avisa a los teléfonos", async () => {
    const r = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", {
      metodo: "PUT",
      cuerpo: { nombre: "Delicantería", tema: { cardBg: "#101010", ink: "#fafafa", accent: "#00aa55", marca: "taza", banda: "oscura", atras: "Nuevo reverso", pageBg: "url(javascript:x)" } },
    }));
    expect(r.status).toBe(200);
    const n = await store.getNegocio("delicanteria");
    expect(n.nombre).toBe("Delicantería");
    expect(n.tema).toMatchObject({ cardBg: "#101010", ink: "#fafafa", accent: "#00aa55", marca: "taza", banda: "oscura", atras: "Nuevo reverso" });
    expect(n.tema.pageBg).not.toMatch(/javascript/);
    expect(notificarNegocio).toHaveBeenCalledTimes(1);
  });

  it("un nombre vacío o un color raro no se guardan", async () => {
    const vacio = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", { metodo: "PUT", cuerpo: { nombre: "  " } }));
    expect(vacio.status).toBe(400);
    await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", { metodo: "PUT", cuerpo: { tema: { accent: "red; background:url(x)" } } }));
    expect((await store.getNegocio("delicanteria")).tema.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("un horario roto se rechaza con una frase que se entiende", async () => {
    const r = await negocioRuta.PUT(await pedir("/api/negocio?b=delicanteria", { metodo: "PUT", cuerpo: { horario: { semana: [] } } }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Horario no válido/);
  });
});

describe("GET /api/negocios (público)", () => {
  it("solo dice qué tiendas hay: nada de brief, notas, horario ni avisos", async () => {
    const lista = await (await negociosRuta.GET()).json();
    expect(lista).toContainEqual({ slug: "delicanteria", nombre: "La Delicantería" });
    for (const n of lista) expect(Object.keys(n).sort()).toEqual(["nombre", "slug"]);
  });
});
