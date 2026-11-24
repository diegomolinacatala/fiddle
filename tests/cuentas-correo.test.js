import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// ENTRAR CON CORREO (dueño) O CON EL USUARIO ELEGIDO (caja)
// ----------------------------------------------------------------------------
// lib/accesos.js (`login`), lib/codigos.js, /api/login y /api/recuperar. Como en
// producción: sin «contraseña = usuario» y con el buzón de mentira de los tests.
// ============================================================================

vi.mock("@/lib/correo", async () => (await import("./correoFalso.js")).modulo);
// `after` (lo que va tras contestar) solo existe dentro de una petición de Next: aquí,
// se apunta y se espera a mano.
const tras = [];
vi.mock("next/server", async (original) => ({ ...(await original()), after: (fn) => { tras.push(Promise.resolve().then(fn)); } }));
const acabar = async () => { await Promise.all(tras.splice(0)); };
const { ultimoCodigo, buzon } = await import("./correoFalso.js");
const store = await import("@/lib/store");
const { hashClave } = await import("@/lib/claves");
const { buscarAcceso, comprobarAcceso, usuarioCajaOcupado, correoLibre, slugChocaConLogin, problemaUsuarioCaja, estadoAccesos, nuevaClave } = await import("@/lib/accesos");
const { nuevoCodigo, comprobarCodigo, limpiarCodigo } = await import("@/lib/codigos");
const { verificarSesion } = await import("@/lib/auth");
const login = await import("@/app/api/login/route.js");
const recuperar = await import("@/app/api/recuperar/route.js");

const EMAIL = "ana@nube.es";

let dir;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "cuentas-correo-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", "secreto-de-los-tests");
  vi.spyOn(console, "error").mockImplementation(() => {});
  buzon.length = 0;
  // Nube ya hizo el cambio: el dueño con su correo y la caja con «barra-nube».
  await store.guardarAcceso({ usuario: "nube", negocio: "nube", rol: "manager", hash: await hashClave("la del dueño 2026", "elegida"), login: EMAIL });
  await store.guardarAcceso({ usuario: "nube-caja", negocio: "nube", rol: "caja", hash: await hashClave("caja de la tienda", "elegida"), login: "barra-nube" });
  // Fade no: entra con los de siempre.
  await store.guardarAcceso({ usuario: "fade", negocio: "fade", rol: "manager", hash: await hashClave("la de fade 2026", "elegida") });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const peticion = (url, cuerpo, ip = "1.2.3.4") =>
  new NextRequest(`http://x${url}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(cuerpo) });
const leer = async (r) => ({ status: r.status, data: await r.json(), sesion: await verificarSesion(r.cookies.get("sesion")?.value) });
const entrar = async (usuario, clave) => leer(await login.POST(peticion("/api/login", { usuario, clave })));
async function pedirRecuperar(cuerpo, ip) {
  const r = await leer(await recuperar.POST(peticion("/api/recuperar", cuerpo, ip)));
  await acabar();
  return r;
}

describe("con qué se entra", () => {
  it("el dueño con su correo (da igual mayúsculas y espacios) y la caja con su usuario; la sesión lleva el usuario de siempre", async () => {
    expect(await entrar(" ANA@nube.es ", "la del dueño 2026")).toMatchObject({ status: 200, data: { destino: "/nube/manager" }, sesion: { negocio: "nube", rol: "manager", usuario: "nube" } });
    expect(await entrar("barra-nube", "caja de la tienda")).toMatchObject({ status: 200, data: { destino: "/nube/caja" }, sesion: { negocio: "nube", rol: "caja", usuario: "nube-caja" } });
  });

  it("con login, el nombre de siempre ya no abre; sin login, sigue valiendo", async () => {
    expect((await entrar("nube", "la del dueño 2026")).status).toBe(401);
    expect((await entrar("nube-caja", "caja de la tienda")).status).toBe(401);
    expect(await entrar("fade", "la de fade 2026")).toMatchObject({ status: 200, sesion: { negocio: "fade", rol: "manager" } });
  });

  it("un correo que no es de nadie o la contraseña de otro rol no entran", async () => {
    expect((await entrar("nadie@nube.es", "la del dueño 2026")).status).toBe(401);
    expect((await entrar(EMAIL, "caja de la tienda")).status).toBe(401);
    expect((await entrar("barra-nube", "la del dueño 2026")).status).toBe(401);
  });

  it("cambiar la contraseña de la caja desde Ajustes no le quita su usuario", async () => {
    const { clave } = await nuevaClave("nube", "caja");
    expect(await comprobarAcceso("barra-nube", clave)).toMatchObject({ negocio: "nube", rol: "caja" });
    expect((await estadoAccesos("nube")).map((a) => [a.rol, a.login])).toEqual([["manager", EMAIL], ["caja", "barra-nube"]]);
    expect((await estadoAccesos("fade")).map((a) => a.login)).toEqual([null, null]);
  });

  it("si la base no responde, buscar por login no tumba el nombre de siempre", async () => {
    vi.spyOn(store, "getAccesoPorLogin").mockRejectedValueOnce(new Error("Supabase caído"));
    expect(await buscarAcceso("fade")).toMatchObject({ negocio: "fade", rol: "manager" });
  });
});

describe("los nombres nuevos", () => {
  it("el usuario de la caja: forma, único y nunca el de siempre de otra tienda", async () => {
    expect(problemaUsuarioCaja("ab")).toBeTruthy();
    expect(problemaUsuarioCaja("barra nube")).toBeTruthy();
    expect(problemaUsuarioCaja("ana@nube.es")).toBeTruthy();
    expect(problemaUsuarioCaja("Barra.Fade_1")).toBeNull();
    expect(await usuarioCajaOcupado("barra-nube", "fade")).toBeTruthy(); // de otra caja
    expect(await usuarioCajaOcupado("barra-nube", "nube")).toBeNull(); // el suyo
    expect(await usuarioCajaOcupado("nube", "fade")).toBeTruthy(); // otra tienda
    expect(await usuarioCajaOcupado("nube-caja", "fade")).toBeTruthy();
    expect(await usuarioCajaOcupado("fade-caja", "fade")).toBeNull(); // el de siempre de su caja
    expect(await usuarioCajaOcupado("victor", "fade")).toBeTruthy();
    expect(await usuarioCajaOcupado("barra-fade", "fade")).toBeNull();
  });

  it("un correo, una cafetería", async () => {
    expect(await correoLibre("Ana@Nube.es", "nube")).toEqual({ email: EMAIL, problema: null });
    expect((await correoLibre(EMAIL, "fade")).problema).toMatch(/otra cafetería/);
    expect((await correoLibre("no es correo", "fade")).problema).toBeTruthy();
  });

  it("una tienda nueva no puede llamarse como el usuario que eligió una caja", async () => {
    expect(await slugChocaConLogin("barra-nube")).toBe(true);
    expect(await slugChocaConLogin("barra")).toBe(false);
    // `barra-manager` lleva al dueño de `barra`: si una caja se llama así, `barra` no puede existir.
    await store.guardarAcceso({ usuario: "fade-caja", negocio: "fade", rol: "caja", hash: await hashClave("caja de fade 1", "elegida"), login: "barra-manager" });
    expect(await slugChocaConLogin("barra")).toBe(true);
  });
});

describe("el código del correo", () => {
  it("vale para su propósito y su correo, en sus minutos", async () => {
    const ahora = Date.now();
    const { reto, codigo } = await nuevoCodigo("Ana@Nube.es", "recuperar", ahora);
    expect(codigo).toMatch(/^\d{6}$/);
    expect(reto).not.toContain(codigo);
    expect(await comprobarCodigo(reto, `${codigo.slice(0, 3)} ${codigo.slice(3)}`, "recuperar", ahora)).toEqual({ ok: true, email: EMAIL });
    expect(await comprobarCodigo(reto, codigo, "inv:otra", ahora)).toMatchObject({ ok: false, codigo: "caducado" });
    expect(await comprobarCodigo(reto, codigo, "recuperar", ahora + 16 * 60 * 1000)).toMatchObject({ ok: false, codigo: "caducado" });
    expect(await comprobarCodigo(`${reto.slice(0, -2)}xx`, codigo, "recuperar", ahora)).toMatchObject({ ok: false, codigo: "caducado" });
    expect(limpiarCodigo("12-34 56")).toBe("123456");
  });

  it("muchas peticiones a la vez no prueban más códigos que el tope: el bueno ya llega agotado", async () => {
    const { reto, codigo } = await nuevoCodigo(EMAIL, "recuperar");
    const malo = codigo === "000000" ? "111111" : "000000";
    const r = await Promise.all(Array.from({ length: 20 }, () => comprobarCodigo(reto, malo, "recuperar")));
    expect(r.filter((x) => x.codigo === "mal").length).toBeLessThanOrEqual(8);
    expect(await comprobarCodigo(reto, codigo, "recuperar")).toMatchObject({ ok: false, codigo: "agotado" });
  });
});

describe("POST /api/recuperar", () => {
  it("manda el código al dueño, pone la contraseña nueva, deja dentro y la vieja deja de valer", async () => {
    const pedido = await pedirRecuperar({ email: "Ana@nube.es" });
    expect(pedido).toMatchObject({ status: 200, data: { email: EMAIL } });
    expect(buzon).toHaveLength(1);
    expect(buzon[0]).toMatchObject({ para: EMAIL, asunto: expect.stringMatching(/código/) });
    const codigo = ultimoCodigo(EMAIL);

    expect(await pedirRecuperar({ reto: pedido.data.reto, codigo, clave: "corta" })).toMatchObject({ status: 400, data: { campo: "clave" } });
    expect(await pedirRecuperar({ reto: pedido.data.reto, codigo, clave: "caja de la tienda" })).toMatchObject({ status: 400, data: { campo: "clave" } });
    const hecho = await pedirRecuperar({ reto: pedido.data.reto, codigo, clave: "la nueva del dueño" });
    expect(hecho).toMatchObject({ status: 200, data: { destino: "/nube/manager" }, sesion: { negocio: "nube", rol: "manager" } });
    expect(await comprobarAcceso(EMAIL, "la nueva del dueño")).toBeTruthy();
    expect(await comprobarAcceso(EMAIL, "la del dueño 2026")).toBeNull();
    expect(await comprobarAcceso("barra-nube", "caja de la tienda")).toBeTruthy(); // la caja, igual
    expect((await store.listAuditoria("nube")).some((a) => a.accion === "clave" && a.detalle === "recuperada por correo")).toBe(true);
  });

  it("a un correo que no es de nadie no se le manda nada, pero se contesta igual", async () => {
    const pedido = await pedirRecuperar({ email: "nadie@x.es" });
    expect(pedido).toMatchObject({ status: 200, data: { email: "nadie@x.es", reto: expect.any(String) } });
    expect(buzon).toHaveLength(0);
    expect(await pedirRecuperar({ reto: pedido.data.reto, codigo: "123456", clave: "una contraseña larga" })).toMatchObject({ status: 400, data: { campo: "codigo" } });
  });

  it("un código malo cuenta, y pedir códigos tiene límite por conexión", async () => {
    const pedido = await pedirRecuperar({ email: EMAIL }, "5.5.5.5");
    const malo = ultimoCodigo(EMAIL) === "000000" ? "111111" : "000000";
    expect(await pedirRecuperar({ reto: pedido.data.reto, codigo: malo, clave: "la nueva del dueño" })).toMatchObject({ status: 400, data: { codigoCorreo: "mal" } });
    for (let i = 0; i < 5; i++) await pedirRecuperar({ email: EMAIL }, "5.5.5.5");
    expect((await pedirRecuperar({ email: EMAIL }, "5.5.5.5")).status).toBe(429);
    expect((await pedirRecuperar({ email: EMAIL }, "5.5.5.6")).status).toBe(200);
  });
});
