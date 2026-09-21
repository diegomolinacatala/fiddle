import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Cliente de Supabase falso: registra cada cadena de llamadas (from/select/eq/...)
// y devuelve la respuesta que el test encole para esa tabla.
const llamadas = [];
const respuestas = new Map(); // tabla -> [respuesta, ...]

function consulta(tabla) {
  const cadena = [];
  llamadas.push({ tabla, cadena });
  const resultado = () => (respuestas.get(tabla)?.shift() ?? { data: null, error: null });
  const proxy = new Proxy({}, {
    get(_, metodo) {
      if (metodo === "then") return (ok, ko) => Promise.resolve(resultado()).then(ok, ko);
      return (...args) => { cadena.push([metodo, ...args]); return proxy; };
    },
  });
  return proxy;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t) => consulta(t) }) }));
const store = await import("@/lib/store");

const encolar = (tabla, ...rs) => respuestas.set(tabla, [...(respuestas.get(tabla) || []), ...rs]);
const metodos = (i) => llamadas[i].cadena.map((c) => c[0]);

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "service");
  llamadas.length = 0;
  respuestas.clear();
});
afterEach(() => vi.unstubAllEnvs());

describe("store con Supabase", () => {
  it("getNegocio compone config guardada; saveNegocio hace upsert", async () => {
    encolar("negocios", { data: { config: { meta: 4, ubicaciones: [{ lat: 1, lng: 2 }] } }, error: null });
    expect(await store.getNegocio("nube")).toMatchObject({ slug: "nube", meta: 4, ubicaciones: [{ lat: 1, lng: 2 }] });
    expect(metodos(0)).toEqual(["select", "eq", "maybeSingle"]);

    encolar("negocios", { data: null, error: null }, { data: null, error: null });
    const g = await store.saveNegocio("fade", { premio: "barba" });
    expect(g.premio).toBe("barba");
    const upsert = llamadas.at(-1).cadena[0];
    expect(upsert[0]).toBe("upsert");
    expect(upsert[1]).toMatchObject({ slug: "fade", nombre: "Fade Room", tipo: "sellos", config: { premio: "barba", meta: 6 } });
  });

  it("los errores de Supabase se lanzan con contexto", async () => {
    encolar("clientes", { data: null, error: { message: "boom" } });
    await expect(store.getCliente("s1")).rejects.toThrow("Supabase leer cliente: boom");
  });

  it("crearCliente mira los códigos del negocio e inserta; saveCliente marca actualizado", async () => {
    await store.crearCliente({ serial: "s1", negocio: "nube", authToken: "t".repeat(48) });
    // Antes de insertar pregunta qué códigos cortos tiene YA ese negocio (y solo ese).
    expect(llamadas[0].cadena).toEqual([["select", "serial, codigo"], ["eq", "negocio", "nube"]]);
    expect(llamadas[1].cadena[0][1]).toMatchObject({
      serial: "s1", negocio: "nube", auth_token: "t".repeat(48), sellos: 0, codigo: expect.any(String),
    });

    encolar("clientes", { data: [{ serial: "s1" }], error: null });
    expect(await store.saveCliente({ serial: "s1", sellos: 2, premios: 0 })).toBe(true);
    const [update, eq, select] = llamadas[2].cadena;
    expect(update[1]).toMatchObject({ sellos: 2, premios: 0, actualizado: expect.any(String) });
    expect(update[1]).not.toHaveProperty("nombre");
    expect(eq).toEqual(["eq", "serial", "s1"]);
    expect(select).toEqual(["select", "serial"]);
  });

  it("saveCliente optimista filtra por el estado leído y detecta conflicto", async () => {
    encolar("clientes", { data: [], error: null });
    const ok = await store.saveCliente({ serial: "s1", sellos: 0, premios: 1 }, { esperado: { sellos: 8, premios: 0 } });
    expect(ok).toBe(false);
    expect(llamadas[0].cadena.slice(1)).toEqual([["eq", "serial", "s1"], ["eq", "sellos", 8], ["eq", "premios", 0], ["select", "serial"]]);

    encolar("clientes", { data: [{ serial: "s1" }], error: null });
    expect(await store.guardarNombre("s1", "Ana")).toBe(true);
    expect(llamadas[1].cadena[0][1]).toMatchObject({ nombre: "Ana" });
    expect(llamadas[1].cadena[0][1]).not.toHaveProperty("sellos");
  });

  it("registrarPase: upsert sin duplicados; nuevo solo si devuelve fila", async () => {
    encolar("dispositivos", { data: null, error: null });
    encolar("registros", { data: [{ serial: "s1" }], error: null });
    expect(await store.registrarPase({ dispositivo: "d1", pushToken: "ab", passType: "p", serial: "s1", negocio: "nube" })).toBe(true);
    expect(llamadas.map((l) => l.tabla)).toEqual(["dispositivos", "registros"]);
    expect(llamadas[1].cadena[0]).toEqual([
      "upsert",
      { dispositivo: "d1", pass_type: "p", serial: "s1", negocio: "nube" },
      { onConflict: "dispositivo,pass_type,serial", ignoreDuplicates: true },
    ]);

    // Registro repetido (o simultáneo): ON CONFLICT DO NOTHING no devuelve filas.
    encolar("dispositivos", { data: null, error: null });
    encolar("registros", { data: [], error: null });
    expect(await store.registrarPase({ dispositivo: "d1", pushToken: "ab", passType: "p", serial: "s1", negocio: "nube" })).toBe(false);
  });

  it("borrarRegistro borra el dispositivo si no le quedan pases y avisa si fue el último", async () => {
    // borrar · contar los del dispositivo (0 -> se borra) · contar los del pase (0 -> era el último)
    encolar("registros", { data: null, error: null }, { data: null, count: 0, error: null }, { data: null, count: 0, error: null });
    encolar("dispositivos", { data: null, error: null });
    expect(await store.borrarRegistro({ dispositivo: "d1", passType: "p", serial: "s1" })).toEqual({ ultimo: true });
    expect(llamadas.map((l) => l.tabla)).toEqual(["registros", "registros", "dispositivos", "registros"]);

    llamadas.length = 0;
    // Al dispositivo le quedan pases y al pase le quedan teléfonos: no se borra nada más.
    encolar("registros", { data: null, error: null }, { data: null, count: 2, error: null }, { data: null, count: 1, error: null });
    expect(await store.borrarRegistro({ dispositivo: "d1", passType: "p", serial: "s1" })).toEqual({ ultimo: false });
    expect(llamadas.map((l) => l.tabla)).toEqual(["registros", "registros", "registros"]);
  });

  it("pasesDeDispositivo y pushTokens usan los joins por FK", async () => {
    encolar("registros", { data: [{ serial: "s1", clientes: { actualizado: "2026-01-01" } }, { serial: "huerfano", clientes: null }], error: null });
    expect(await store.pasesDeDispositivo({ dispositivo: "d1", passType: "p" })).toEqual([{ serial: "s1", actualizado: "2026-01-01" }]);
    expect(llamadas[0].cadena[0]).toEqual(["select", "serial, clientes(actualizado)"]);

    encolar("registros", { data: [{ dispositivos: { push_token: "a" } }, { dispositivos: { push_token: "a" } }, { dispositivos: null }], error: null });
    expect(await store.pushTokens({ negocio: "nube" })).toEqual(["a"]);
    expect(llamadas[1].cadena).toEqual([["select", "serial, dispositivo, dispositivos(push_token)"], ["eq", "negocio", "nube"]]);
  });

  it("borrarDispositivos borra por id (los registros caen en cascada)", async () => {
    await store.borrarDispositivos(["web-1", "web-2"]);
    expect(llamadas[0]).toEqual({ tabla: "dispositivos", cadena: [["delete"], ["in", "id", ["web-1", "web-2"]]] });
    llamadas.length = 0;
    await store.borrarDispositivos([]);
    expect(llamadas).toHaveLength(0);
  });

  it("destinosDeAviso filtra por canal (Apple, web, Google) y devuelve serial y dispositivo", async () => {
    encolar("registros", {
      data: [{ serial: "s1", dispositivo: "web-1", dispositivos: { push_token: "{}" } }, { serial: "s2", dispositivo: "web-2", dispositivos: null }],
      error: null,
    });
    expect(await store.destinosDeAviso({ seriales: ["s1", "s2"], passType: "web" }))
      .toEqual([{ serial: "s1", dispositivo: "web-1", token: "{}" }]);
    expect(llamadas[0].cadena).toEqual([
      ["select", "serial, dispositivo, dispositivos(push_token)"], ["in", "serial", ["s1", "s2"]], ["eq", "pass_type", "web"],
    ]);
  });

  it("contarIntentos devuelve count (0 si no hay)", async () => {
    encolar("intentos", { data: null, count: 3, error: null }, { data: null, count: 0, error: null });
    expect(await store.contarIntentos("login:nube:ip", 0)).toBe(3);
    expect(await store.contarIntentos("login:nube:ip", 0)).toBe(0);
    await store.registrarIntento("tap:ip");
    expect(llamadas.at(-1)).toMatchObject({ tabla: "intentos", cadena: [["insert", { clave: "tap:ip" }]] });
  });

  it("listClientes filtra por negocio y normaliza", async () => {
    encolar("clientes", { data: [{ serial: "s1", negocio: "nube", sellos: 1, premios: 0, auth_token: "x", creado: "c" }], error: null });
    const lista = await store.listClientes("nube");
    expect(lista[0]).toMatchObject({ serial: "s1", nombre: null, actualizado: "c" });
    expect(metodos(0)).toEqual(["select", "order", "eq"]);
  });
});
