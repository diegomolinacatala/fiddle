import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// LA PLANTILLA POR LAS RUTAS: el manager lleva la lista, cada empleado se
// identifica con su PIN en su móvil (cookie firmada, lib/quien.js) y cada
// sello sale con su nombre (lib/plantilla.js).
// ============================================================================

vi.mock("@/lib/wallet", async (original) => ({
  ...(await original()),
  notificarNegocio: vi.fn(async () => ({ proveedor: "demo" })),
  notificarCliente: vi.fn(async () => ({ proveedor: "demo" })),
}));

const store = await import("@/lib/store");
const { firmarSesion, firmarTexto } = await import("@/lib/auth");
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

async function pedir(url, { metodo = "GET", cuerpo, como, cookies = {}, ip } = {}) {
  const headers = {};
  const trozos = [];
  if (como) trozos.push(`sesion=${await firmarSesion(...como)}`);
  for (const [k, v] of Object.entries(cookies)) trozos.push(`${k}=${v}`);
  if (trozos.length) headers.cookie = trozos.join("; ");
  if (cuerpo) headers["content-type"] = "application/json";
  if (ip) headers["x-forwarded-for"] = ip;
  return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
}
const leer = async (r) => ({ status: r.status, data: await r.json(), cookies: r.cookies.getAll() });

const manager = ["nube", "manager"];
const caja = ["nube", "caja"];
const sellar = async (opciones) =>
  accion.POST(await pedir("/api/accion", { metodo: "POST", cuerpo: { serial: cliente.serial, accion: "sellar" }, ...opciones }));
const identificar = async (cuerpo, opciones = {}) =>
  leer(await quien.POST(await pedir("/api/plantilla/quien?b=nube", { metodo: "POST", cuerpo, como: caja, ...opciones })));
const estado = async (opciones = {}) => leer(await quien.GET(await pedir("/api/plantilla/quien?b=nube", { como: caja, ...opciones })));

describe("la lista, desde el manager", () => {
  it("alta, renombrar, baja y vuelta; queda apuntado sin el nombre", async () => {
    let r = await leer(await lista.POST(await pedir("/api/plantilla?b=nube", { metodo: "POST", cuerpo: { nombre: " Sebas " }, como: manager })));
    expect(r.status).toBe(200);
    expect(r.data.empleado).toEqual({ id: expect.any(String), nombre: "Sebas", alta: expect.any(String), baja: null, tienePin: false });
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
    expect(JSON.stringify(r.data)).not.toContain("pin\":\"");

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
    const r = await estado();
    expect(r.data).toEqual({ elegir: false, empleado: null, ultimo: null, plantilla: [], hoy: null });
    const a = await leer(await sellar({ como: caja }));
    expect(a.status).toBe(200);
    expect((await store.listEventos(cliente.serial))[0]).toMatchObject({ actor: "caja", empleado: null });
  });

  it("con gente: PIN la primera vez, cookie firmada que se renueva, y cada sello con su nombre", async () => {
    await store.saveNegocio("nube", {
      plantilla: [
        { id: "sebas001", nombre: "Sebas", alta: null, baja: null },
        { id: "marta001", nombre: "Marta", alta: null, baja: null },
        { id: "luis0001", nombre: "Luis", alta: null, baja: "2026-01-01T00:00:00Z" },
      ],
    });
    let r = await estado();
    expect(r.data).toMatchObject({ elegir: true, empleado: null, ultimo: null, hoy: null });
    expect(r.data.plantilla).toEqual([{ id: "sebas001", nombre: "Sebas", tienePin: false }, { id: "marta001", nombre: "Marta", tienePin: false }]);

    // Sin identificarse no se sella, y la tarjeta no cambia.
    let a = await leer(await sellar({ como: caja }));
    expect(a.status).toBe(428);
    expect(a.data).toMatchObject({ ok: false, elegir: true });
    expect((await store.getCliente(cliente.serial)).sellos).toBe(0);

    // Alguien de baja no puede atender; sin PIN hay que elegir uno, y que valga.
    expect((await identificar({ id: "luis0001", nuevoPin: "2468" })).status).toBe(400);
    r = await identificar({ id: "sebas001" });
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/cifras/);
    expect((await identificar({ id: "sebas001", nuevoPin: "1111" })).status).toBe(400);
    expect((await identificar({ id: "sebas001", pin: "2468" })).status).toBe(400); // aún no tiene: hay que crearlo

    // Sebas elige su PIN: dos cookies; la firmada dura dos horas y no lleva el PIN.
    r = await identificar({ id: "sebas001", nuevoPin: "2468" });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ ok: true, creado: true, empleado: { id: "sebas001", tienePin: true } });
    const firmada = r.cookies.find((c) => c.name === "quien");
    expect(firmada).toMatchObject({ httpOnly: true, path: "/", maxAge: 2 * 3600 });
    expect(firmada.value).toMatch(/^nube\.sebas001\.[0-9a-f]{12}\.\d+\.[0-9a-f]{64}$/);
    expect(firmada.value).not.toContain("2468");
    expect(r.cookies.find((c) => c.name === "quien_ultimo")).toMatchObject({ value: "nube.sebas001", maxAge: 90 * 24 * 3600 });
    expect((await store.getNegocio("nube")).plantilla[0].pin).toMatch(/^scrypt\$/);
    const token = firmada.value;

    // Con la cookie: la caja sabe quién es, lo de hoy, y cada uso la renueva.
    const cookies = { quien: token, quien_ultimo: "nube.sebas001" };
    r = await estado({ cookies });
    expect(r.data).toMatchObject({ elegir: false, empleado: { id: "sebas001", nombre: "Sebas", tienePin: true }, hoy: { sellos: 0, clientes: 0 } });
    expect(r.cookies.find((c) => c.name === "quien")).toMatchObject({ maxAge: 2 * 3600 });

    a = await leer(await sellar({ como: caja, cookies }));
    expect(a.status).toBe(200);
    expect(a.cookies.find((c) => c.name === "quien")).toMatchObject({ maxAge: 2 * 3600 });
    expect((await store.listEventos(cliente.serial))[0]).toMatchObject({ actor: "caja", empleado: "sebas001" });
    r = await estado({ cookies });
    expect(r.data.hoy).toEqual({ sellos: 1, quitados: 0, premios: 0, clientes: 1 });

    // Pasadas las dos horas (sin cookie firmada) se le pide solo el PIN al último.
    r = await estado({ cookies: { quien_ultimo: "nube.sebas001" } });
    expect(r.data).toMatchObject({ elegir: true, empleado: null, ultimo: { id: "sebas001", nombre: "Sebas", tienePin: true } });

    // Con PIN puesto no se cambia desde la caja; el malo da 401; el bueno entra.
    expect((await identificar({ id: "sebas001", nuevoPin: "1357" })).status).toBe(400);
    r = await identificar({ id: "sebas001", pin: "0000" });
    expect(r.status).toBe(401);
    r = await identificar({ id: "sebas001", pin: "2468" });
    expect(r.status).toBe(200);
    expect(r.cookies.find((c) => c.name === "quien").value).toMatch(/^nube\.sebas001\./);

    // Forjada o tocada, no: otra tienda, firma rota, otra huella de PIN, sin PIN, de baja.
    const dentroDe = Date.now() + 60_000;
    for (const falsa of [
      "fade.sebas001.abcdef012345",
      token.slice(0, -2),
      await firmarTexto("nube.sebas001.otrahuella01", dentroDe),
      await firmarTexto("nube.marta001.sin", dentroDe),
      await firmarTexto("nube.luis0001.sin", dentroDe),
    ]) {
      a = await leer(await sellar({ como: caja, cookies: { quien: falsa } }));
      expect(a.status, falsa).toBe(428);
    }

    // Cinco fallos seguidos: 15 minutos sin poder intentarlo, aunque el PIN sea el bueno.
    for (let i = 0; i < 4; i += 1) expect((await identificar({ id: "sebas001", pin: "9999" })).status).toBe(401);
    expect((await identificar({ id: "sebas001", pin: "2468" })).status).toBe(429);
    // Marta no está bloqueada por los fallos de Sebas.
    expect((await identificar({ id: "marta001", nuevoPin: "8642" })).status).toBe(200);

    // El manager le quita el PIN: la cookie de todos sus móviles deja de valer y elige otro.
    r = await leer(await lista.PUT(await pedir("/api/plantilla?b=nube", { metodo: "PUT", cuerpo: { id: "sebas001", quitarPin: true }, como: manager })));
    expect(r.status).toBe(200);
    expect(r.data.empleado.tienePin).toBe(false);
    expect((await store.listAuditoria("nube")).some((x) => x.detalle === "pin-quitado sebas001")).toBe(true);
    a = await leer(await sellar({ como: caja, cookies }));
    expect(a.status).toBe(428);
    r = await identificar({ id: "sebas001", nuevoPin: "1357" }, { ip: "9.9.9.9" });
    expect(r.status).toBe(200);
    expect(r.data.creado).toBe(true);
    const nueva = { quien: r.cookies.find((c) => c.name === "quien").value };
    expect((await leer(await sellar({ como: caja, cookies: nueva }))).status).toBe(200);

    // El dueño no se identifica: su sello queda como "manager", sin empleado, aunque el móvil tenga cookie.
    a = await leer(await sellar({ como: manager, cookies: nueva }));
    expect(a.status).toBe(200);
    expect((await store.listEventos(cliente.serial))[0]).toMatchObject({ actor: "manager", empleado: null });
    r = await estado({ como: manager, cookies: nueva });
    expect(r.data).toMatchObject({ elegir: false, empleado: null });
  });

  it("salir borra quién atiende (no la última vez): quien entre después se identifica de nuevo", async () => {
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
    expect(r.data.negocio).not.toHaveProperty("plantilla");
  });
});
