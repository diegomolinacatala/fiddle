import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { leerAlta, slugDeNombre, metrosEntre, METROS_MISMO_LOCAL } from "@/lib/alta";

// ============================================================================
// ALTA SOLA (lib/alta.js y /api/alta): los datos que vale, el slug y que la ruta
// deja la tienda en el plan Gratis con su ubicación y su invitación.
// ============================================================================

const bueno = {
  tienda: "Café Ñandú & Co", nombre: "Ana Pérez", email: "Ana@Cafe.es", telefono: "652 28 42 00",
  lugar: { lat: 39.4699, lng: -0.3763, direccion: "Calle Mayor 1, Valencia" }, acepto: true,
};

describe("leerAlta", () => {
  it("acepta el formulario completo y pone el email en minúsculas", () => {
    const { datos, errores } = leerAlta(bueno);
    expect(errores).toBeNull();
    expect(datos).toMatchObject({ tienda: "Café Ñandú & Co", nombre: "Ana Pérez", email: "ana@cafe.es" });
    expect(datos.lugar).toMatchObject({ lat: 39.4699, lng: -0.3763 });
  });

  it("dice qué campo falla, uno por uno", () => {
    const { datos, errores } = leerAlta({ tienda: " ", nombre: "", email: "no", telefono: "12", lugar: null, acepto: false });
    expect(datos).toBeNull();
    expect(Object.keys(errores).sort()).toEqual(["acepto", "email", "lugar", "nombre", "telefono", "tienda"]);
  });

  it("sin aceptar no pasa, aunque lo demás esté bien", () => {
    expect(leerAlta({ ...bueno, acepto: "true" }).errores).toHaveProperty("acepto");
  });

  it("un lugar fuera de rango no vale", () => {
    expect(leerAlta({ ...bueno, lugar: { lat: 99, lng: 0 } }).errores).toHaveProperty("lugar");
  });

  it("aguanta un cuerpo que no es un objeto", () => {
    expect(leerAlta(null).errores).toBeTruthy();
  });
});

describe("slugDeNombre y metrosEntre", () => {
  it("quita acentos y signos", () => {
    expect(slugDeNombre("Café Ñandú & Co")).toBe("cafe-nandu-y-co");
  });
  it("un nombre sin letras cae a «tienda»", () => {
    expect(slugDeNombre("!!!")).toBe("tienda");
  });
  it("mide metros y distingue el mismo local de otro", () => {
    const a = { lat: 39.4699, lng: -0.3763 };
    expect(metrosEntre(a, a)).toBe(0);
    expect(metrosEntre(a, { lat: 39.4699, lng: -0.3762 })).toBeLessThan(METROS_MISMO_LOCAL);
    expect(metrosEntre(a, { lat: 39.4709, lng: -0.3763 })).toBeGreaterThan(METROS_MISMO_LOCAL);
  });
});

describe("POST /api/alta", () => {
  let dir;
  let ruta;
  let store;
  let n = 0;
  // Cada llamada, desde una IP distinta: el límite es de 3 por hora y conexión.
  const llamar = (cuerpo, cabeceras = {}) =>
    ruta.POST(new Request("http://localhost/api/alta", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++n}`, ...cabeceras },
      body: JSON.stringify(cuerpo),
    }));

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "fiddle-alta-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.resetModules();
    store = await import("@/lib/store");
    ruta = await import("@/app/api/alta/route");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("crea la tienda en plan Gratis con su alta, su ubicación y la invitación", async () => {
    const r = await llamar(bueno);
    const d = await r.json();
    expect(r.status).toBe(201);
    expect(d.slug).toBe("cafe-nandu-y-co");
    expect(d.ir).toMatch(/^\/invitacion#.{20,}/);
    const tienda = await store.getNegocio(d.slug);
    expect(tienda.plan).toBe("gratis");
    // Lo que la web promete en Gratis, ya encendido para la tienda (cada regla sigue apagada).
    expect(tienda.avisosAvanzados).toBe(true);
    expect(tienda.plantillaActiva).toBe(true);
    expect(tienda.ubicaciones).toEqual([{ lat: 39.4699, lng: -0.3763 }]);
    expect(tienda.alta).toMatchObject({ nombre: "Ana Pérez", email: "ana@cafe.es", lugar: { direccion: "Calle Mayor 1, Valencia" } });
  });

  it("con un diseño elegido, lleva su color y el premio de su icono", async () => {
    const r = await llamar({ ...bueno, eleccion: { cartillas: 2, paleta: "rojo", icono: "galleta" } });
    const tienda = await store.getNegocio((await r.json()).slug);
    expect(tienda.tema.cardBg).toBe("#c4293a");
    expect(tienda.premio).toBe("cookie gratis");
    expect(tienda.cartillas ?? null).toBeNull();
  });

  it("un nombre repetido sale con -2", async () => {
    const a = await (await llamar(bueno)).json();
    const b = await (await llamar(bueno)).json();
    expect(a.slug).toBe("cafe-nandu-y-co");
    expect(b.slug).toBe("cafe-nandu-y-co-2");
  });

  it("el campo trampa responde bien y no crea nada", async () => {
    const r = await llamar({ ...bueno, web: "http://spam.example" });
    expect(r.status).toBe(200);
    expect((await store.listNegocios()).some((x) => x.slug === "cafe-nandu-y-co")).toBe(false);
  });

  it("desde otro sitio web (cross-site) da 403", async () => {
    const r = await llamar(bueno, { "sec-fetch-site": "cross-site" });
    expect(r.status).toBe(403);
  });

  it("datos malos dan 400 con los errores", async () => {
    const r = await llamar({ ...bueno, email: "no" });
    const d = await r.json();
    expect(r.status).toBe(400);
    expect(d.errores).toHaveProperty("email");
    expect(d.error).toBe(d.errores.email);
  });

  it("a la cuarta desde la misma conexión, 429", async () => {
    const ip = { "x-forwarded-for": "9.9.9.9" };
    for (let i = 0; i < 3; i++) expect((await llamar({ ...bueno, tienda: `Bar ${i}` }, ip)).status).toBe(201);
    expect((await llamar({ ...bueno, tienda: "Bar 9" }, ip)).status).toBe(429);
  });
});
