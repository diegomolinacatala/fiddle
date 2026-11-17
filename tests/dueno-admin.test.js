import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// La tarjeta del dueño desde el admin: encender, apagar y cambiar la llave.
const store = await import("@/lib/store");
const { firmarSesion } = await import("@/lib/auth");
const ruta = await import("@/app/api/admin/dueno/route.js");
const { resumenTarjeta, conLlaveNueva } = await import("@/lib/dueno/tarjeta");

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "dueno-admin-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function llamar(metodo, { cuerpo, qs = "" } = {}) {
  const headers = { cookie: `sesion=${await firmarSesion("plataforma", "admin")}`, "content-type": "application/json" };
  const req = new NextRequest(`http://x/api/admin/dueno${qs}`, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const r = await ruta[metodo](req);
  return { status: r.status, data: await r.json() };
}
const guardada = async (slug = "nube") => (await store.getNegocio(slug)).tarjetaDueno;
const encender = (slug = "nube") => llamar("PUT", { cuerpo: { slug, activa: true } });

describe("resumenTarjeta y conLlaveNueva", () => {
  it("sin tarjeta, apagada y sin iPhone", () => {
    expect(resumenTarjeta({})).toEqual({ activa: false, iphones: 0 });
  });
  it("cuenta los iPhone y exige serial y token", () => {
    const t = { activa: true, serial: "s", token: "t", dispositivos: [{ id: "a" }, { id: "b" }] };
    expect(resumenTarjeta({ tarjetaDueno: t })).toEqual({ activa: true, iphones: 2 });
    expect(resumenTarjeta({ tarjetaDueno: { ...t, token: "" } }).activa).toBe(false);
  });
  it("la llave nueva es un token de 48 hex y vacía los iPhone", () => {
    const p = conLlaveNueva();
    expect(p.token).toMatch(/^[0-9a-f]{48}$/);
    expect(p.dispositivos).toEqual([]);
    expect(p.token).not.toBe(conLlaveNueva().token);
  });
});

describe("/api/admin/dueno", () => {
  it("encender una tienda sin tarjeta crea serial y token", async () => {
    expect((await llamar("GET", { qs: "?slug=nube" })).data).toEqual({ activa: false, iphones: 0 });
    const r = await encender();
    expect(r).toEqual({ status: 200, data: { activa: true, iphones: 0 } });
    const t = await guardada();
    expect(t.serial).toMatch(/^dueno-nube-[0-9a-f]{16}$/);
    expect(t.token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("apagar y volver a encender conserva serial y token", async () => {
    await encender();
    const antes = await guardada();
    expect((await llamar("PUT", { cuerpo: { slug: "nube", activa: false } })).data.activa).toBe(false);
    expect(await guardada()).toMatchObject({ activa: false, serial: antes.serial, token: antes.token });
    await encender();
    expect(await guardada()).toMatchObject({ activa: true, serial: antes.serial, token: antes.token });
  });

  it("la llave nueva cambia el token, conserva el serial y vacía los iPhone", async () => {
    await encender();
    const antes = await guardada();
    await store.saveNegocio("nube", { tarjetaDueno: { ...antes, dispositivos: [{ id: "a", token: "x", tipo: "p", alta: "2026-01-01" }] } });
    expect((await llamar("GET", { qs: "?slug=nube" })).data.iphones).toBe(1);
    const r = await llamar("POST", { cuerpo: { slug: "nube", accion: "llave" } });
    expect(r).toEqual({ status: 200, data: { activa: true, iphones: 0 } });
    const despues = await guardada();
    expect(despues.serial).toBe(antes.serial);
    expect(despues.token).not.toBe(antes.token);
    expect(despues.dispositivos).toEqual([]);
  });

  it("ninguna respuesta lleva token, serial ni dispositivos", async () => {
    const respuestas = [await encender(), await llamar("GET", { qs: "?slug=nube" }), await llamar("POST", { cuerpo: { slug: "nube", accion: "llave" } })];
    for (const { data } of respuestas) {
      expect(Object.keys(data).sort()).toEqual(["activa", "iphones"]);
    }
  });

  it("404 sin tienda o, para la llave, sin tarjeta", async () => {
    expect((await llamar("GET", { qs: "?slug=no-existe" })).status).toBe(404);
    expect((await llamar("PUT", { cuerpo: { slug: "no-existe", activa: true } })).status).toBe(404);
    expect((await llamar("POST", { cuerpo: { slug: "nube", accion: "llave" } })).status).toBe(404);
  });

  it("400 con slug malo, activa que no es booleano o acción desconocida", async () => {
    expect((await llamar("GET", { qs: "?slug=" })).status).toBe(400);
    expect((await llamar("PUT", { cuerpo: { slug: "nube", activa: "si" } })).status).toBe(400);
    expect((await llamar("PUT", { cuerpo: { slug: "nube" } })).status).toBe(400);
    expect((await llamar("POST", { cuerpo: { slug: "nube", accion: "borrar" } })).status).toBe(400);
  });
});
