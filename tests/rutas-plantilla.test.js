import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// LA PLANTILLA POR LAS RUTAS: el manager lleva la lista, la caja elige quién
// atiende en su móvil y cada sello sale con su nombre (lib/plantilla.js).
// ============================================================================

vi.mock("@/lib/wallet", async (original) => ({
  ...(await original()),
  notificarNegocio: vi.fn(async () => ({ proveedor: "demo" })),
  notificarCliente: vi.fn(async () => ({ proveedor: "demo" })),
}));

const store = await import("@/lib/store");
const { firmarSesion } = await import("@/lib/auth");
const lista = await import("@/app/api/plantilla/route.js");
const quien = await import("@/app/api/plantilla/quien/route.js");
const accion = await import("@/app/api/accion/route.js");
const salir = await import("@/app/api/logout/route.js");
const ficha = await import("@/app/api/cliente/[serial]/route.js");

let dir;
let cliente;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-plantilla-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  cliente = await store.crearCliente({ serial: "8a1f6c2e-0000-4000-8000-000000000002", negocio: "nube", authToken: "t".repeat(32) });
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function pedir(url, { metodo = "GET", cuerpo, como, cookies = {} } = {}) {
  const headers = {};
  const trozos = [];
  if (como) trozos.push(`sesion=${await firmarSesion(...como)}`);
  for (const [k, v] of Object.entries(cookies)) trozos.push(`${k}=${v}`);
  if (trozos.length) headers.cookie = trozos.join("; ");
  if (cuerpo) headers["content-type"] = "application/json";
  return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
}
const leer = async (r) => ({ status: r.status, data: await r.json(), cookies: r.cookies.getAll() });

const manager = ["nube", "manager"];
const caja = ["nube", "caja"];
const sellar = async (opciones) =>
  accion.POST(await pedir("/api/accion", { metodo: "POST", cuerpo: { serial: cliente.serial, accion: "sellar" }, ...opciones }));

describe("la lista, desde el manager", () => {
  it("alta, renombrar, baja y vuelta; queda apuntado sin el nombre", async () => {
    let r = await leer(await lista.POST(await pedir("/api/plantilla?b=nube", { metodo: "POST", cuerpo: { nombre: " Sebas " }, como: manager })));
    expect(r.status).toBe(200);
    expect(r.data.empleado).toMatchObject({ nombre: "Sebas", baja: null });
    const { id } = r.data.empleado;

    r = await leer(await lista.POST(await pedir("/api/plantilla?b=nube", { metodo: "POST", cuerpo: { nombre: "sebas" }, como: manager })));
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/Ya hay alguien/);

    r = await leer(await lista.PUT(await pedir("/api/plantilla?b=nube", { metodo: "PUT", cuerpo: { id, nombre: "Sebastián" }, como: manager })));
    expect(r.data.plantilla).toEqual([expect.objectContaining({ id, nombre: "Sebastián" })]);

    r = await leer(await lista.PUT(await pedir("/api/plantilla?b=nube", { metodo: "PUT", cuerpo: { id, activo: false }, como: manager })));
    expect(r.data.empleado.baja).toBeTruthy();
    expect((await store.getNegocio("nube")).plantilla[0].baja).toBeTruthy();

    r = await leer(await lista.PUT(await pedir("/api/plantilla?b=nube", { metodo: "PUT", cuerpo: { id, activo: true }, como: manager })));
    expect(r.data.empleado.baja).toBeNull();
    r = await leer(await lista.PUT(await pedir("/api/plantilla?b=nube", { metodo: "PUT", cuerpo: { id: "nadie", activo: true }, como: manager })));
    expect(r.status).toBe(400);

    r = await leer(await lista.GET(await pedir("/api/plantilla?b=nube", { como: manager })));
    expect(r.data.plantilla).toHaveLength(1);

    const apuntado = await store.listAuditoria("nube");
    expect(apuntado.filter((a) => a.accion === "plantilla").map((a) => a.detalle)).toEqual([`vuelta ${id}`, `baja ${id}`, `nombre ${id}`, `alta ${id}`]);
    expect(JSON.stringify(apuntado)).not.toMatch(/Sebas/);
  });

  it("la caja no toca la lista", async () => {
    const r = await lista.POST(await pedir("/api/plantilla?b=nube", { metodo: "POST", cuerpo: { nombre: "Yo" }, como: caja }));
    expect(r.status).toBe(403);
  });
});

describe("quién atiende, desde la caja", () => {
  it("sin gente dada de alta no hay que elegir y la caja sella como siempre", async () => {
    const r = await leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: caja })));
    expect(r.data).toEqual({ elegir: false, empleado: null, ultimo: null, plantilla: [], hoy: null });
    const a = await leer(await sellar({ como: caja }));
    expect(a.status).toBe(200);
    expect((await store.listEventos(cliente.serial))[0]).toMatchObject({ actor: "caja", empleado: null });
  });

  it("con gente: hay que elegir, la cookie dura hasta medianoche y cada sello lleva su nombre", async () => {
    await store.saveNegocio("nube", {
      plantilla: [
        { id: "sebas001", nombre: "Sebas", alta: null, baja: null },
        { id: "marta001", nombre: "Marta", alta: null, baja: null },
        { id: "luis0001", nombre: "Luis", alta: null, baja: "2026-01-01T00:00:00Z" },
      ],
    });
    let r = await leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: caja })));
    expect(r.data).toMatchObject({ elegir: true, empleado: null, ultimo: null, hoy: null });
    expect(r.data.plantilla).toEqual([{ id: "sebas001", nombre: "Sebas" }, { id: "marta001", nombre: "Marta" }]);

    // Sin elegir no se sella, y la tarjeta no cambia.
    let a = await leer(await sellar({ como: caja }));
    expect(a.status).toBe(428);
    expect(a.data).toMatchObject({ ok: false, elegir: true });
    expect((await store.getCliente(cliente.serial)).sellos).toBe(0);

    // Alguien de baja no puede atender.
    r = await leer(await quien.POST(await pedir("/api/plantilla/quien?b=nube", { metodo: "POST", cuerpo: { id: "luis0001" }, como: caja })));
    expect(r.status).toBe(400);

    // Sebas elige: dos cookies, la de hoy caduca a la medianoche de la tienda.
    r = await leer(await quien.POST(await pedir("/api/plantilla/quien?b=nube", { metodo: "POST", cuerpo: { id: "sebas001" }, como: caja })));
    expect(r.status).toBe(200);
    const hoy = r.cookies.find((c) => c.name === "quien");
    expect(hoy).toMatchObject({ value: "nube.sebas001", httpOnly: true, path: "/" });
    expect(hoy.maxAge).toBeGreaterThanOrEqual(60);
    expect(hoy.maxAge).toBeLessThanOrEqual(24 * 3600);
    expect(r.cookies.find((c) => c.name === "quien_ultimo")).toMatchObject({ value: "nube.sebas001", maxAge: 90 * 24 * 3600 });

    const cookies = { quien: "nube.sebas001", quien_ultimo: "nube.sebas001" };
    r = await leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: caja, cookies })));
    expect(r.data).toMatchObject({ elegir: false, empleado: { id: "sebas001", nombre: "Sebas" }, hoy: { sellos: 0, clientes: 0 } });

    a = await leer(await sellar({ como: caja, cookies }));
    expect(a.status).toBe(200);
    expect((await store.listEventos(cliente.serial))[0]).toMatchObject({ actor: "caja", empleado: "sebas001" });
    r = await leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: caja, cookies })));
    expect(r.data.hoy).toEqual({ sellos: 1, quitados: 0, premios: 0, clientes: 1 });

    // Mañana (la cookie de hoy ya no está) se propone al último.
    r = await leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: caja, cookies: { quien_ultimo: "nube.sebas001" } })));
    expect(r.data).toMatchObject({ elegir: true, empleado: null, ultimo: { id: "sebas001", nombre: "Sebas" } });

    // La cookie de otra tienda no vale aquí, ni la de alguien dado de baja a media mañana.
    a = await leer(await sellar({ como: caja, cookies: { quien: "fade.sebas001" } }));
    expect(a.status).toBe(428);
    a = await leer(await sellar({ como: caja, cookies: { quien: "nube.luis0001" } }));
    expect(a.status).toBe(428);

    // El dueño no elige: su sello queda como "manager", sin empleado, aunque el móvil tenga cookie.
    a = await leer(await sellar({ como: manager, cookies }));
    expect(a.status).toBe(200);
    expect((await store.listEventos(cliente.serial))[0]).toMatchObject({ actor: "manager", empleado: null });
    r = await leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: manager, cookies })));
    expect(r.data).toMatchObject({ elegir: false, empleado: null });
  });

  it("salir borra quién atiende hoy (no la última vez): quien entre después elige de nuevo", async () => {
    const r = await salir.POST();
    const nombres = r.cookies.getAll().map((c) => [c.name, c.maxAge]);
    expect(nombres).toContainEqual(["sesion", 0]);
    expect(nombres).toContainEqual(["quien", 0]);
    expect(nombres.some(([n]) => n === "quien_ultimo")).toBe(false);
  });

  it("la ficha de la caja no dice quién dio cada sello: eso es del manager", async () => {
    await store.addEvento(cliente.serial, "sellar", "Sello 1/8", { negocio: "nube", actor: "caja", empleado: "sebas001" });
    const r = await leer(await ficha.GET(await pedir(`/api/cliente/${cliente.serial}`, { como: caja }), { params: Promise.resolve({ serial: cliente.serial }) }));
    expect(r.status).toBe(200);
    expect(r.data.eventos[0]).toMatchObject({ tipo: "sellar", actor: "caja" });
    expect(r.data.eventos[0]).not.toHaveProperty("empleado");
  });
});
