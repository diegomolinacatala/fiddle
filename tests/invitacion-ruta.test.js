import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// LA INVITACIÓN POR SUS RUTAS (docs/AUDITORIA-ACCESOS.md, lote 1)
// ----------------------------------------------------------------------------
// POST /api/invitacion: vale / incompleto / desconocido / usado / caducado, cada
// rechazo con su `codigo` y su aviso en el log SIN el token; fijar las dos
// contraseñas deja la sesión y queda en la auditoría; si la base falla a medias
// el enlace sigue vivo (M1). GET /api/admin/invitacion: el estado que pinta la
// ficha, y crear queda apuntado.
// ============================================================================

// `guardarAcceso` de verdad, pero con un fallo de la base cuando el test lo pida.
vi.mock("@/lib/store", async (original) => {
  const real = await original();
  return { ...real, guardarAcceso: vi.fn((...a) => real.guardarAcceso(...a)) };
});

const store = await import("@/lib/store");
const { nuevaInvitacion, estadoInvitacion, enlacesFiables } = await import("@/lib/invitaciones");
const { comprobarAcceso } = await import("@/lib/accesos");
const { firmarSesion } = await import("@/lib/auth");
const ruta = await import("@/app/api/invitacion/route.js");
const admin = await import("@/app/api/admin/invitacion/route.js");

const CLAVES = { manager: "la del dueño 2026", caja: "caja de la tienda" };
const DIA = 86400000;

let dir;
let warn;
let error;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "invitacion-ruta-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APP_URL", "https://sellos.app");
  vi.stubEnv("VERCEL_ENV", "");
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function pedir(url, { metodo = "POST", cuerpo, ip = "1.2.3.4", como } = {}) {
  const headers = { "x-forwarded-for": ip };
  if (cuerpo) headers["content-type"] = "application/json";
  return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
}
const leer = async (r) => ({ status: r.status, data: await r.json(), cookies: r.cookies.getAll() });
const comprobar = async (token, ip) => leer(await ruta.POST(pedir("/api/invitacion", { cuerpo: { token }, ip })));
const aceptar = async (token, claves = CLAVES, ip) => leer(await ruta.POST(pedir("/api/invitacion", { cuerpo: { token, ...claves }, ip })));
const comoAdmin = async () => ({ cookie: `sesion=${await firmarSesion("plataforma", "admin")}` });
const estado = async (slug = "nube") =>
  leer(await admin.GET(new NextRequest(`http://x/api/admin/invitacion?slug=${slug}`, { headers: await comoAdmin() })));
const crear = async (slug = "nube") =>
  leer(await admin.POST(new NextRequest("http://x/api/admin/invitacion", {
    method: "POST", headers: { ...(await comoAdmin()), "content-type": "application/json" }, body: JSON.stringify({ slug }),
  })));
const auditoria = async (accion) => (await store.listAuditoria("nube")).filter((a) => a.accion === accion);

describe("POST /api/invitacion: ¿vale el enlace?", () => {
  it("con el token del enlace: la tienda y sus usuarios", async () => {
    const { token } = await nuevaInvitacion("nube");
    const r = await comprobar(token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ nombre: "Nube Café", usuarios: { manager: "nube", caja: "nube-caja" } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("cada rechazo lleva su código y deja un aviso en el log sin el token", async () => {
    const { token } = await nuevaInvitacion("nube");
    const inventado = "x".repeat(43);

    expect(await comprobar("")).toMatchObject({ status: 410, data: { codigo: "incompleto", error: expect.stringMatching(/incompleto/) } });
    expect(await comprobar(undefined)).toMatchObject({ status: 410, data: { codigo: "incompleto" } });
    expect(await comprobar(inventado)).toMatchObject({ status: 410, data: { codigo: "desconocido", error: expect.stringMatching(/no vale/) } });

    // Otro más nuevo lo anula.
    const { token: nuevo } = await nuevaInvitacion("nube");
    expect(await comprobar(token)).toMatchObject({ status: 410, data: { codigo: "desconocido" } });

    // Usado.
    expect((await aceptar(nuevo)).status).toBe(200);
    expect(await comprobar(nuevo)).toMatchObject({ status: 410, data: { codigo: "usada", error: expect.stringMatching(/ya se usó/) } });

    // Caducado: ocho días después.
    const { token: tarde } = await nuevaInvitacion("nube");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (7 + 1) * DIA);
    expect(await comprobar(tarde)).toMatchObject({ status: 410, data: { codigo: "caducada", error: expect.stringMatching(/caducado/) } });

    const avisos = warn.mock.calls.map((c) => c.join(" "));
    expect(avisos).toEqual(expect.arrayContaining([
      "[invitación] rechazada: incompleto", "[invitación] rechazada: desconocido", "[invitación] rechazada: usada", "[invitación] rechazada: caducada",
    ]));
    for (const t of [token, nuevo, tarde, inventado]) expect(avisos.join("\n")).not.toContain(t);
  });
});

describe("POST /api/invitacion: fijar las contraseñas", () => {
  it("las dos quedan, entra como manager y queda en la auditoría", async () => {
    const { token } = await nuevaInvitacion("nube");
    const r = await aceptar(token);
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ ok: true, destino: "/nube/manager" });
    expect(r.cookies.find((c) => c.name === "sesion")?.value).toMatch(/^nube\.manager\./);

    expect(await comprobarAcceso("nube", CLAVES.manager)).toMatchObject({ rol: "manager" });
    expect(await comprobarAcceso("nube-caja", CLAVES.caja)).toMatchObject({ rol: "caja" });
    expect(await auditoria("invitacion")).toEqual([
      expect.objectContaining({ negocio: "nube", usuario: "nube", rol: "manager", accion: "invitacion", detalle: "aceptada" }),
    ]);
  });

  it("una contraseña floja es 400 con su campo, y el enlace sigue vivo", async () => {
    const { token } = await nuevaInvitacion("nube");
    expect(await aceptar(token, { manager: "corta", caja: CLAVES.caja })).toMatchObject({ status: 400, data: { campo: "manager" } });
    expect(await aceptar(token, { manager: CLAVES.manager, caja: CLAVES.manager })).toMatchObject({ status: 400, data: { campo: "caja" } });
    expect((await comprobar(token)).status).toBe(200);
    expect(await auditoria("invitacion")).toEqual([]);
  });

  it("si la base falla a medias, el enlace se reabre y se puede repetir (M1)", async () => {
    const { token } = await nuevaInvitacion("nube");
    // La del manager se guarda; la de la caja, no (Supabase caído un segundo).
    const real = store.guardarAcceso.getMockImplementation();
    store.guardarAcceso.mockImplementationOnce(real).mockRejectedValueOnce(new Error("Supabase caído"));

    expect((await aceptar(token)).status).toBe(500);
    expect(error).toHaveBeenCalled();
    // Reabierto y sin apuntar: el dueño vuelve a pulsar.
    expect((await comprobar(token)).status).toBe(200);
    expect((await estadoInvitacion("nube")).pendiente).toBeTruthy();
    expect(await auditoria("invitacion")).toEqual([]);

    expect((await aceptar(token)).status).toBe(200);
    expect(await comprobarAcceso("nube", CLAVES.manager)).toMatchObject({ rol: "manager" });
    expect(await comprobarAcceso("nube-caja", CLAVES.caja)).toMatchObject({ rol: "caja" });
    expect((await comprobar(token)).data.codigo).toBe("usada");
  });

  it("si el enlace no se puede gastar, no se guarda nada y sigue vivo", async () => {
    const { token } = await nuevaInvitacion("nube");
    const gastar = vi.spyOn(store, "gastarInvitacion").mockRejectedValueOnce(new Error("Supabase caído"));
    expect((await aceptar(token)).status).toBe(500);
    expect(gastar).toHaveBeenCalled();
    expect(await comprobarAcceso("nube", CLAVES.manager)).toBeNull();
    expect((await comprobar(token)).status).toBe(200);
  });

  it("si falla guardar y tampoco se puede reabrir, queda en la auditoría para que el admin cree otro", async () => {
    const { token } = await nuevaInvitacion("nube");
    store.guardarAcceso.mockRejectedValueOnce(new Error("Supabase caído"));
    vi.spyOn(store, "reabrirInvitacion").mockRejectedValueOnce(new Error("sigue caído"));
    expect((await aceptar(token)).status).toBe(500);
    expect((await comprobar(token)).data.codigo).toBe("usada"); // quemado: se ve en la ficha
    expect(await auditoria("invitacion")).toEqual([expect.objectContaining({ negocio: "nube", detalle: "sin_reabrir" })]);
  });

  it("dos peticiones a la vez con el mismo enlace: solo una fija las contraseñas", async () => {
    const { token } = await nuevaInvitacion("nube");
    const otras = { manager: "la del portátil 2026", caja: "caja del portátil" };
    const [a, b] = await Promise.all([aceptar(token), aceptar(token, otras)]);
    const [gana, pierde] = a.status === 200 ? [a, b] : [b, a];
    expect(gana.status).toBe(200);
    expect(pierde).toMatchObject({ status: 410, data: { codigo: "usada" } });
    expect(pierde.cookies.find((c) => c.name === "sesion")).toBeUndefined();
    // Las que quedan son las de la que ganó, las dos.
    const suyas = gana === a ? CLAVES : otras;
    expect(await comprobarAcceso("nube", suyas.manager)).toMatchObject({ rol: "manager" });
    expect(await comprobarAcceso("nube-caja", suyas.caja)).toMatchObject({ rol: "caja" });
    expect(await auditoria("invitacion")).toHaveLength(1);
  });

  it("comprobar un enlace tiene su propio límite, en memoria: al 61 desde la misma IP, 429", async () => {
    const { token } = await nuevaInvitacion("nube");
    for (let i = 0; i < 60; i++) expect((await comprobar(token, "7.7.7.7")).status).toBe(200);
    expect((await comprobar(token, "7.7.7.7")).status).toBe(429);
    expect((await comprobar(token, "7.7.7.8")).status).toBe(200);
  });

  it("más de 20 intentos desde la misma IP en 10 minutos: 429", async () => {
    for (let i = 0; i < 20; i++) expect((await aceptar("", { manager: "x", caja: "y" }, "9.9.9.9")).status).toBe(410);
    expect(await aceptar("", { manager: "x", caja: "y" }, "9.9.9.9")).toMatchObject({ status: 429 });
    // Otra IP sigue pudiendo.
    expect((await aceptar("", { manager: "x", caja: "y" }, "9.9.9.8")).status).toBe(410);
  });
});

describe("GET /api/admin/invitacion: cómo está el enlace", () => {
  it("sin enlaces, nada; crear deja uno pendiente y queda apuntado; usarlo, la fecha", async () => {
    expect((await estado()).data).toEqual({ pendiente: null, caducada: null, ultimaUsada: null, fiable: true, base: "https://sellos.app" });

    const creado = await crear();
    expect(creado.status).toBe(200);
    expect(creado.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(creado.data.url).toBe(`https://sellos.app/invitacion#${creado.data.token}`);
    expect(creado.data).toMatchObject({ fiable: true, dias: 7, usuarios: { manager: "nube", caja: "nube-caja" } });
    expect(await auditoria("invitacion")).toEqual([
      expect.objectContaining({ negocio: "nube", usuario: "admin", rol: "admin", accion: "invitacion", detalle: "creada" }),
    ]);

    let r = (await estado()).data;
    expect(r.pendiente).toEqual({ creado: expect.any(String), caduca: creado.data.caduca });
    expect(r.ultimaUsada).toBeNull();
    // Sin huella ni token: el estado es para contarlo, no para usarlo.
    expect(JSON.stringify(r)).not.toContain(creado.data.token);

    expect((await aceptar(creado.data.token)).status).toBe(200);
    r = (await estado()).data;
    expect(r.pendiente).toBeNull();
    expect(Date.parse(r.ultimaUsada)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("un enlace que caducó sin usarse se dice; otro nuevo lo quita de en medio", async () => {
    const viejo = await crear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 8 * DIA);
    let r = (await estado()).data;
    expect(r.pendiente).toBeNull();
    expect(r.caducada).toEqual({ creado: expect.any(String), caduca: viejo.data.caduca });

    await crear();
    r = (await estado()).data;
    expect(r.caducada).toBeNull();
    expect(r.pendiente).toBeTruthy();
  });

  it("sin slug 400, tienda que no está 404; la de otra tienda no se mezcla", async () => {
    expect((await estado("")).status).toBe(400);
    expect((await estado("no-existe")).status).toBe(404);
    await crear("fade");
    expect((await estado("nube")).data.pendiente).toBeNull();
  });

  it("en la web de dev (Vercel sin base) avisa de que el enlace no va a valer", async () => {
    expect(enlacesFiables()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(enlacesFiables()).toBe(false);
    expect((await estado()).data.fiable).toBe(false);
    expect((await crear()).data.fiable).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "k");
    expect(enlacesFiables()).toBe(true);
  });
});
