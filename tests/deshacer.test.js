import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// «DESHACER CAMBIOS» EN LA CAJA (lib/deshacer.js): la tarjeta vuelve a como
// estaba al escanearla y lo hecho en la ficha sale del historial, para que
// ninguna cuenta vea una visita que no hubo. Lo de antes de abrirla, se queda.
// ============================================================================

vi.mock("@/lib/wallet", async (original) => ({
  ...(await original()),
  notificarCliente: vi.fn(async () => ({ proveedor: "demo" })),
}));

const store = await import("@/lib/store");
const { firmarSesion } = await import("@/lib/auth");
const { soloVisitas } = await import("@/lib/crm");
const { notificarCliente } = await import("@/lib/wallet");
const { firmarInstantanea, leerInstantanea, MINUTOS_DESHACER_CAMBIOS } = await import("@/lib/deshacer");
const accion = await import("@/app/api/accion/route.js");
const deshacer = await import("@/app/api/accion/deshacer/route.js");

const SERIAL = "8a1f6c2e-0000-4000-8000-000000000003";
let dir;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-deshacer-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  await store.crearCliente({ serial: SERIAL, negocio: "nube", authToken: "t".repeat(32) });
  vi.mocked(notificarCliente).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function pedir(url, cuerpo, como = ["nube", "caja"]) {
  return new NextRequest(`http://x${url}`, {
    method: "POST",
    headers: { cookie: `sesion=${await firmarSesion(...como)}`, "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}
const hacer = async (key) => (await accion.POST(await pedir("/api/accion", { serial: SERIAL, accion: key }))).json();
const deshacerCon = async (instantanea, como) => {
  const r = await deshacer.POST(await pedir("/api/accion/deshacer", { serial: SERIAL, instantanea }, como));
  return { status: r.status, data: await r.json() };
};
const eventos = () => store.listEventos(SERIAL, 50);
// La ficha se abre ahora: lo de la caja llega después, como en el mostrador.
const abrirFicha = async () => {
  await new Promise((r) => setTimeout(r, 5));
  const foto = await firmarInstantanea(await store.getCliente(SERIAL));
  await new Promise((r) => setTimeout(r, 5));
  return foto;
};

describe("deshacer cambios", () => {
  it("deja la tarjeta como al escanearla y la visita no cuenta en ninguna parte", async () => {
    const foto = await abrirFicha();
    await hacer("sellar");
    await hacer("sellar");
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 2, visitas: 1 });
    vi.mocked(notificarCliente).mockClear();

    const { status, data } = await deshacerCon(foto);
    expect(status).toBe(200);
    expect(data).toMatchObject({ ok: true, quitados: 2, cliente: { sellos: 0, visitas: 0, ultima_visita: null } });
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 0, premios: 0, visitas: 0, ultima_visita: null });
    // Solo queda la línea que dice que se deshizo, que no es una visita ni de la caja.
    const quedan = await eventos();
    expect(quedan.map((e) => e.tipo)).toEqual(["deshacer"]);
    expect(quedan[0].mensaje).toBe("Deshechos 2 movimientos de la caja");
    expect(soloVisitas(quedan)).toEqual([]);
    // El teléfono del cliente se pone al día, en silencio (sin `antes`).
    expect(notificarCliente).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notificarCliente).mock.calls[0][2]).toBeUndefined();
  });

  it("un punto y su «−» dejan la cuenta igual, pero la visita también se quita", async () => {
    const foto = await abrirFicha();
    await hacer("sellar");
    await hacer("restar");
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 0, visitas: 1 });
    const { data } = await deshacerCon(foto);
    expect(data).toMatchObject({ ok: true, quitados: 2 });
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 0, visitas: 0, ultima_visita: null });
  });

  it("lo de antes de abrir la ficha se queda, y vuelve el mensaje que sumar la visita quitó", async () => {
    await hacer("sellar");
    await store.guardarMensajes([SERIAL], "Hoy, 2x1");
    const antes = await store.getCliente(SERIAL);
    const foto = await abrirFicha();
    await hacer("sellar");
    await hacer("sellar");
    expect((await store.getCliente(SERIAL)).mensaje).toBeNull();

    await deshacerCon(foto);
    expect(await store.getCliente(SERIAL)).toMatchObject({
      sellos: 1, visitas: antes.visitas, ultima_visita: antes.ultima_visita, mensaje: "Hoy, 2x1",
    });
    expect((await eventos()).map((e) => e.tipo).sort()).toEqual(["deshacer", "sellar"]);
  });

  it("un premio dado se deshace con su cartilla llena otra vez", async () => {
    await store.saveCliente({ ...(await store.getCliente(SERIAL)), sellos: 8 });
    const foto = await abrirFicha();
    await hacer("canjear");
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 0, premios: 1 });
    await deshacerCon(foto);
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 8, premios: 0 });
  });

  it("sin nada hecho no toca nada ni apunta nada", async () => {
    const { data } = await deshacerCon(await abrirFicha());
    expect(data).toMatchObject({ ok: true, quitados: 0 });
    expect(await eventos()).toEqual([]);
    expect(notificarCliente).not.toHaveBeenCalled();
  });

  it("solo vale la instantánea que firmó el servidor, de esa tarjeta y a tiempo", async () => {
    const foto = await abrirFicha();
    await hacer("sellar");
    // Inventada en el navegador: una tarjeta llena que nunca existió.
    const falsa = `${Buffer.from(JSON.stringify({ serial: SERIAL, desde: new Date(0).toISOString(), sellos: 8 })).toString("base64url")}.${Date.now() + 6e4}.00`;
    expect((await deshacerCon(falsa)).status).toBe(410);
    // De otra tarjeta.
    const otra = await store.crearCliente({ serial: "8a1f6c2e-0000-4000-8000-000000000004", negocio: "nube", authToken: "u".repeat(32) });
    expect((await deshacerCon(await firmarInstantanea(otra))).status).toBe(410);
    // Caducada.
    expect(await leerInstantanea(foto, SERIAL, Date.now() + (MINUTOS_DESHACER_CAMBIOS + 1) * 60_000)).toBeNull();
    const { status, data } = await deshacerCon(await firmarInstantanea(await store.getCliente(SERIAL), Date.now() - (MINUTOS_DESHACER_CAMBIOS + 1) * 60_000));
    expect(status).toBe(410);
    expect(data.caducada).toBe(true);
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 1 });
  });

  it("la caja de otra tienda no puede", async () => {
    const foto = await abrirFicha();
    await hacer("sellar");
    expect((await deshacerCon(foto, ["fade", "caja"])).status).toBe(403);
    expect(await store.getCliente(SERIAL)).toMatchObject({ sellos: 1 });
  });
});
