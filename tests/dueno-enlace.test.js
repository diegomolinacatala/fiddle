import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// EL QR DE LA TARJETA DEL DUEÑO: la llave que caduca y la descarga sin sesión
// ----------------------------------------------------------------------------
// Store de ficheros en un directorio temporal; la firma del .pkpass, APNs, la
// config de Apple y el historial se simulan.
// ============================================================================

const generarPkpassDueno = vi.fn(async () => Buffer.from("pkpass"));
const datosCrm = vi.fn();
vi.mock("@/lib/dueno/firmar", () => ({ generarPkpassDueno: (...a) => generarPkpassDueno(...a) }));
vi.mock("@/lib/apple/apns", () => ({ enviarAvisos: async (tokens) => ({ enviados: tokens.length, invalidos: [], errores: [] }) }));
vi.mock("@/lib/crmDatos", () => ({ datosCrm: (...a) => datosCrm(...a) }));
vi.mock("@/lib/apple/config", async (original) => ({
  ...(await original()),
  configApple: () => ({ passTypeId: "pass.com.fiddle.general", teamId: "TEAM", cert: "c", key: "k", wwdr: "w", tienda: null }),
}));

const store = await import("@/lib/store");
const tarjeta = await import("@/lib/dueno/tarjeta");
const { firmarEnlace, negocioDeEnlace, MINUTOS_ENLACE } = await import("@/lib/dueno/enlace");
const { firmarSesion } = await import("@/lib/auth");
const ruta = await import("@/app/api/dueno/[...ruta]/route");

const DUENO = { negocio: "nube", rol: "manager", usuario: "nube" };
let dir;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-dueno-enlace-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  generarPkpassDueno.mockClear();
  datosCrm.mockReset();
  datosCrm.mockResolvedValue({ eventos: [], metricas: {}, grupos: [], historialCompletoDesde: "2026-07-01T00:00:00.000Z" });
  await tarjeta.guardarTarjeta("nube", tarjeta.nuevaTarjeta("nube"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function pedir(url, metodo = "GET", como = null) {
  const headers = como ? { cookie: `sesion=${await firmarSesion(...como)}` } : {};
  const request = new NextRequest(`http://x${url}`, { method: metodo, headers });
  const params = Promise.resolve({ ruta: url.split("?")[0].replace("/api/dueno/", "").split("/") });
  return ruta[metodo](request, { params });
}
const nube = () => store.getNegocio("nube");

describe("la llave del QR", () => {
  it("vale para su tienda y dice quién la pidió", async () => {
    const { token, hasta } = await firmarEnlace(await nube(), DUENO);
    expect(Date.parse(hasta) - Date.now()).toBeGreaterThan((MINUTOS_ENLACE - 1) * 60_000);
    const r = await negocioDeEnlace(token);
    expect(r.negocio.slug).toBe("nube");
    expect(r.quien).toEqual(DUENO);
  });

  it(`caduca a los ${MINUTOS_ENLACE} minutos`, async () => {
    const { token } = await firmarEnlace(await nube(), DUENO);
    expect(await negocioDeEnlace(token, Date.now() + (MINUTOS_ENLACE + 1) * 60_000)).toBeNull();
  });

  it("«Cambiar la llave» del pase la anula", async () => {
    const { token } = await firmarEnlace(await nube(), DUENO);
    await tarjeta.guardarTarjeta("nube", tarjeta.conLlaveNueva());
    expect(await negocioDeEnlace(token)).toBeNull();
  });

  it("con la tarjeta apagada no vale", async () => {
    const { token } = await firmarEnlace(await nube(), DUENO);
    await tarjeta.guardarTarjeta("nube", { activa: false });
    expect(await negocioDeEnlace(token)).toBeNull();
  });

  it("una llave tocada o inventada no vale", async () => {
    const { token } = await firmarEnlace(await nube(), DUENO);
    expect(await negocioDeEnlace(token.replace(":nube:", ":fade:"))).toBeNull();
    expect(await negocioDeEnlace(`${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`)).toBeNull();
    for (const malo of [null, "", "duenopase:nube", "x.y.z"]) expect(await negocioDeEnlace(malo)).toBeNull();
  });
});

describe("las rutas del QR", () => {
  it("pedir la llave es del manager de esa tienda", async () => {
    expect((await pedir("/api/dueno/enlace?b=nube", "POST")).status).toBe(401);
    expect((await pedir("/api/dueno/enlace?b=nube", "POST", ["fade", "manager"])).status).toBe(403);
    expect((await pedir("/api/dueno/enlace?b=nube", "POST", ["nube", "caja"])).status).toBe(403);
  });

  it("con la llave, el iPhone se baja el pase sin sesión y queda apuntado", async () => {
    const r = await pedir("/api/dueno/enlace?b=nube", "POST", ["nube", "manager"]);
    expect(r.status).toBe(200);
    const { token, minutos } = await r.json();
    expect(minutos).toBe(MINUTOS_ENLACE);
    const pase = await pedir(`/api/dueno/pase?t=${encodeURIComponent(token)}`);
    expect(pase.status).toBe(200);
    expect(pase.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
    const apuntes = await store.listAuditoria("nube");
    expect(apuntes.find((a) => a.detalle === "tarjeta del dueño (QR)")).toMatchObject({ usuario: "nube", rol: "manager", accion: "exportar" });
  });

  it("una llave que no vale da una página que lo dice, no el pase", async () => {
    const r = await pedir("/api/dueno/pase?t=duenopase%3Anube.1.abc");
    expect(r.status).toBe(410);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    expect(await r.text()).toMatch(/ya no vale/);
    expect(generarPkpassDueno).not.toHaveBeenCalled();
  });

  it("sin llave ni sesión, el pase sigue cerrado", async () => {
    expect((await pedir("/api/dueno/pase?b=nube")).status).toBe(401);
  });
});
