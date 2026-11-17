import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  leerTarea, leerEtiquetas, idDeEtiqueta, ordenEntre, porColumna, repartir, tintaSobre, esDe, personasDe,
  ETIQUETAS_DE_PARTIDA, COLORES_ETIQUETA, COLUMNAS, MAX_TITULO,
} from "@/lib/tareas";
import * as store from "@/lib/store";
import { firmarSesion } from "@/lib/auth";

const etiquetas = ETIQUETAS_DE_PARTIDA;

describe("lo que se acepta de una tarea", () => {
  it("al crear: título obligatorio y lo demás de partida", () => {
    expect(leerTarea({ titulo: "  Llamar   a la tienda " }, { etiquetas })).toEqual({
      tarea: { titulo: "Llamar a la tienda", nota: null, etiqueta: null, quien: null, columna: "pendiente" },
    });
    expect(leerTarea({ titulo: "   " }, { etiquetas }).error).toMatch(/qué hay que hacer/);
    expect(leerTarea({ titulo: "x".repeat(MAX_TITULO + 1) }, { etiquetas }).error).toBeTruthy();
    expect(leerTarea(null, { etiquetas }).error).toBeTruthy();
    expect(leerTarea([], { etiquetas }).error).toBeTruthy();
  });

  it("quién, etiqueta y columna solo de su lista", () => {
    const base = { titulo: "a" };
    expect(leerTarea({ ...base, quien: "ambos", etiqueta: "marketing", columna: "esperando" }, { etiquetas }).tarea)
      .toMatchObject({ quien: "ambos", etiqueta: "marketing", columna: "esperando" });
    expect(leerTarea({ ...base, quien: "pepe" }, { etiquetas }).error).toBeTruthy();
    expect(leerTarea({ ...base, etiqueta: "borrada" }, { etiquetas }).error).toMatch(/ya no existe/);
    expect(leerTarea({ ...base, columna: "archivo" }, { etiquetas }).error).toBeTruthy();
    expect(leerTarea({ ...base, orden: "1" }, { etiquetas }).error).toBeTruthy();
    expect(leerTarea({ ...base, orden: Infinity }, { etiquetas }).error).toBeTruthy();
  });

  it("al cambiar: solo lo que venga, y algo tiene que venir", () => {
    expect(leerTarea({ columna: "hecha", orden: 5 }, { etiquetas, parcial: true })).toEqual({ tarea: { columna: "hecha", orden: 5 } });
    expect(leerTarea({ etiqueta: null }, { etiquetas, parcial: true })).toEqual({ tarea: { etiqueta: null } });
    expect(leerTarea({}, { etiquetas, parcial: true }).error).toBeTruthy();
    expect(leerTarea({ titulo: "" }, { etiquetas, parcial: true }).error).toBeTruthy();
  });
});

describe("etiquetas", () => {
  it("las de partida y la paleta pasan su propia validación", () => {
    expect(leerEtiquetas(ETIQUETAS_DE_PARTIDA)).toEqual({ etiquetas: ETIQUETAS_DE_PARTIDA });
    for (const c of COLORES_ETIQUETA) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("nada de colores sin validar (van a un style) ni nombres repetidos", () => {
    const una = (e) => leerEtiquetas([{ id: "a", nombre: "A", color: "#112233", ...e }]);
    expect(una({ color: "red" }).error).toMatch(/color/);
    expect(una({ color: "#123" }).error).toMatch(/color/);
    expect(una({ color: "#112233;background:url(x)" }).error).toMatch(/color/);
    expect(una({ nombre: " " }).error).toBeTruthy();
    expect(una({ id: "Con Espacios" }).error).toBeTruthy();
    expect(leerEtiquetas([{ id: "a", nombre: "Ventas", color: "#112233" }, { id: "b", nombre: "ventas", color: "#112233" }]).error).toMatch(/Ya hay/);
    expect(leerEtiquetas("x").error).toBeTruthy();
  });

  it("el identificador sale del nombre y no choca", () => {
    expect(idDeEtiqueta("Diseño gráfico", [])).toBe("diseno-grafico");
    expect(idDeEtiqueta("Marketing", ETIQUETAS_DE_PARTIDA)).toBe("marketing-2");
    expect(idDeEtiqueta("!!!", [])).toBe("etiqueta");
  });
});

describe("el orden del tablero", () => {
  it("entre dos, la mitad; en un extremo, un paso; sola, la hora", () => {
    expect(ordenEntre(10, 20)).toBe(15);
    expect(ordenEntre(null, 5000)).toBe(4000);
    expect(ordenEntre(5000, null, 0)).toBe(6000);
    expect(ordenEntre(5000, null, 99999)).toBe(99999); // al final, nunca antes que una creada ahora
    expect(ordenEntre(null, null, 1234)).toBe(1234);
  });

  it("cada columna por su orden; «Hecho» por cuándo se terminó", () => {
    const t = (id, columna, orden, terminada) => ({ id, columna, orden, terminada });
    const c = porColumna([
      t("b", "pendiente", 2), t("a", "pendiente", 1),
      t("vieja", "hecha", 1, "2026-11-01T10:00:00Z"), t("nueva", "hecha", 2, "2026-11-10T10:00:00Z"),
      t("rara", "no-existe", 0),
    ]);
    expect(Object.keys(c)).toEqual(COLUMNAS.map((x) => x.id));
    expect(c.pendiente.map((x) => x.id)).toEqual(["rara", "a", "b"]);
    expect(c.hecha.map((x) => x.id)).toEqual(["nueva", "vieja"]);
  });

  it("«Los dos» cuenta para los dos; sin nadie, para ninguno", () => {
    expect(esDe({ quien: "ambos" }, "victor")).toBe(true);
    expect(esDe({ quien: "diego" }, "victor")).toBe(false);
    expect(esDe({ quien: null }, "diego")).toBe(false);
    expect(personasDe("ambos").map((p) => p.id)).toEqual(["victor", "diego"]);
    expect(personasDe(null)).toEqual([]);
  });
});

describe("tareas en el store y en /api/admin/tareas", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-tareas-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("pasar a «Hecho» apunta cuándo; sacarla lo quita", async () => {
    const t = await store.crearTarea({ titulo: "Subir el logo", columna: "pendiente" }, { autor: "diego" });
    expect(t).toMatchObject({ titulo: "Subir el logo", autor: "diego", terminada: null, quien: null });
    expect(typeof t.orden).toBe("number");

    const hecha = await store.cambiarTarea(t.id, { columna: "hecha" });
    expect(hecha.terminada).toBeTruthy();
    // Moverla dentro de «Hecho» no cambia cuándo se terminó.
    expect((await store.cambiarTarea(t.id, { columna: "hecha", orden: 3 })).terminada).toBe(hecha.terminada);
    expect((await store.cambiarTarea(t.id, { columna: "en_curso" })).terminada).toBeNull();

    expect(await store.cambiarTarea("no-existe", { titulo: "x" })).toBeNull();
    await store.borrarTarea(t.id);
    expect(await store.listTareas()).toEqual([]);
  });

  it("la huella cambia al crear, mover, borrar o tocar las etiquetas, y solo entonces", async () => {
    const huellas = [await store.huellaDeTareas()];
    const t = await store.crearTarea({ titulo: "Una", columna: "pendiente" });
    huellas.push(await store.huellaDeTareas());
    expect(await store.huellaDeTareas()).toBe(huellas.at(-1)); // sin cambios, la misma
    await new Promise((r) => setTimeout(r, 5)); // `actualizado` va al milisegundo
    await store.cambiarTarea(t.id, { columna: "hecha" });
    huellas.push(await store.huellaDeTareas());
    await store.guardarEtiquetasDeTareas([{ id: "web", nombre: "Web", color: "#1098ad" }]);
    huellas.push(await store.huellaDeTareas());
    await store.borrarTarea(t.id);
    huellas.push(await store.huellaDeTareas());
    expect(new Set(huellas).size).toBe(huellas.length);
  });

  it("las etiquetas son las de partida hasta que se guardan otras", async () => {
    expect(await store.etiquetasDeTareas()).toEqual(ETIQUETAS_DE_PARTIDA);
    const otras = [{ id: "web", nombre: "Web", color: "#1098ad" }];
    await store.guardarEtiquetasDeTareas(otras);
    expect(await store.etiquetasDeTareas()).toEqual(otras);
  });

  const pedir = async (metodo, url, cuerpo, como = ["plataforma", "admin", Date.now(), { usuario: "victor" }]) =>
    new NextRequest(`http://x${url}`, {
      method: metodo,
      headers: { cookie: `sesion=${await firmarSesion(...como)}`, ...(cuerpo ? { "content-type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

  it("el admin crea, mueve y borra; la tarea lleva quién la creó", async () => {
    const ruta = await import("@/app/api/admin/tareas/route.js");
    const creada = await (await ruta.POST(await pedir("POST", "/api/admin/tareas", { titulo: "Grabar vídeo", etiqueta: "marketing", quien: "diego" }))).json();
    expect(creada).toMatchObject({ titulo: "Grabar vídeo", etiqueta: "marketing", quien: "diego", autor: "victor", columna: "pendiente" });

    const r = await ruta.PATCH(await pedir("PATCH", `/api/admin/tareas?id=${creada.id}`, { columna: "en_curso", orden: 1 }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ columna: "en_curso", orden: 1 });

    const mal = await ruta.PATCH(await pedir("PATCH", `/api/admin/tareas?id=${creada.id}`, { etiqueta: "inventada" }));
    expect(mal.status).toBe(400);
    expect((await ruta.PATCH(await pedir("PATCH", "/api/admin/tareas?id=otra", { titulo: "x" }))).status).toBe(404);

    const todo = await (await ruta.GET(await pedir("GET", "/api/admin/tareas"))).json();
    expect(todo).toMatchObject({ yo: "victor", etiquetas: ETIQUETAS_DE_PARTIDA, huella: expect.any(String) });
    // La pregunta de cada pocos segundos: solo la huella, la misma que trae el tablero.
    expect(await (await ruta.GET(await pedir("GET", "/api/admin/tareas?huella=1"))).json()).toEqual({ huella: todo.huella });
    expect(todo.tareas.map((t) => t.id)).toEqual([creada.id]);

    expect((await ruta.DELETE(await pedir("DELETE", `/api/admin/tareas?id=${creada.id}`))).status).toBe(200);
    expect(await store.listTareas()).toEqual([]);
  });

  it("las de Claude van aparte hasta que alguien las sube; archivar no borra", async () => {
    const ruta = await import("@/app/api/admin/tareas/route.js");
    const cambiar = async (id, cuerpo) => (await ruta.PATCH(await pedir("PATCH", `/api/admin/tareas?id=${id}`, cuerpo))).json();
    // Así las mete `npm run tareas`: sin autor.
    const deClaude = await store.crearTarea({ titulo: "Del vault", columna: "pendiente" });
    const hechaDeClaude = await store.crearTarea({ titulo: "Ya cerrada", columna: "hecha" });
    const mia = await store.crearTarea({ titulo: "Mía", columna: "pendiente" }, { autor: "diego" });
    let pilas = repartir(await store.listTareas());
    expect(pilas.deClaude.map((t) => t.id)).toEqual([deClaude.id]);
    expect(pilas.tablero.map((t) => t.id).sort()).toEqual([hechaDeClaude.id, mia.id].sort());

    // Subirla al tablero: quién se la queda lo dice la sesión, no el navegador.
    const subida = await cambiar(deClaude.id, { adoptar: true, autor: "diego", columna: "en_curso" });
    expect(subida).toMatchObject({ autor: "victor", columna: "en_curso" });
    expect(subida).not.toHaveProperty("adoptar");
    expect(repartir(await store.listTareas()).deClaude).toEqual([]);

    expect((await ruta.PATCH(await pedir("PATCH", `/api/admin/tareas?id=${mia.id}`, { archivada: "sí" }))).status).toBe(400);
    expect((await cambiar(mia.id, { archivada: true })).archivada).toBeTruthy();
    pilas = repartir(await store.listTareas());
    expect(pilas.archivadas.map((t) => t.id)).toEqual([mia.id]);
    expect(pilas.tablero.some((t) => t.id === mia.id)).toBe(false);
    expect((await cambiar(mia.id, { archivada: false })).archivada).toBeNull();
    expect(repartir(await store.listTareas()).tablero.some((t) => t.id === mia.id)).toBe(true);
  });

  it("la letra de una tarjeta rellena se lee: blanca, u oscura sobre los colores claros", () => {
    expect(tintaSobre("#1c7ed6")).toBe("#ffffff");
    expect(tintaSobre("#495057")).toBe("#ffffff");
    expect(tintaSobre("#f08c00")).toBe("#1c1917");
    expect(tintaSobre("#66a80f")).toBe("#1c1917");
  });

  it("las etiquetas se guardan enteras y validadas", async () => {
    const ruta = await import("@/app/api/admin/tareas/etiquetas/route.js");
    const mala = await ruta.PUT(await pedir("PUT", "/api/admin/tareas/etiquetas", [{ id: "x", nombre: "X", color: "blue" }]));
    expect(mala.status).toBe(400);
    const buenas = [{ id: "web", nombre: "Web", color: "#1098AD" }];
    const r = await ruta.PUT(await pedir("PUT", "/api/admin/tareas/etiquetas", buenas));
    expect(await r.json()).toEqual([{ id: "web", nombre: "Web", color: "#1098ad" }]);
  });
});
