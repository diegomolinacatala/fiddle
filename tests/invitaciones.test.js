import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { nuevaInvitacion, leerInvitacion, aceptarInvitacion, DIAS_VALIDA } from "@/lib/invitaciones";
import { comprobarAcceso, nuevaClave } from "@/lib/accesos";
import { problemaClaveElegida } from "@/lib/claves";
import { firmarSesion, verificarSesion } from "@/lib/auth";
import { borrarNegocio, marcarTutorial, tutorialesVistos, listAuditoria } from "@/lib/store";
import { reglaDeRuta } from "@/lib/acceso";
import * as rutaInvitacion from "@/app/api/invitacion/route.js";
import * as rutaAdmin from "@/app/api/admin/invitacion/route.js";

const tokenDe = (url) => url.split("#")[1];
const CLAVES = { manager: "la del dueño 2026", caja: "caja de la tienda" };

async function pedir(url, cuerpo, como) {
  const headers = { "content-type": "application/json" };
  if (como) headers.cookie = `sesion=${await firmarSesion(...como)}`;
  return new NextRequest(`http://x${url}`, { method: "POST", headers, body: JSON.stringify(cuerpo) });
}

describe("invitación a una tienda", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "invitaciones-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("APP_URL", "https://sellos.app");
    // Como en producción: sin "contraseña = usuario".
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USUARIOS_DEMO", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("el enlace lleva el token tras # y en la base solo queda su huella", async () => {
    const { url, caduca } = await nuevaInvitacion("nube");
    expect(url).toMatch(/^https:\/\/sellos\.app\/invitacion#[A-Za-z0-9_-]{43}$/);
    expect(Date.parse(caduca) - Date.now()).toBeGreaterThan((DIAS_VALIDA - 1) * 86400000);
    const guardado = readFileSync(path.join(dir, "invitaciones.json"), "utf8");
    expect(guardado).not.toContain(tokenDe(url));
    expect(await leerInvitacion(tokenDe(url))).toMatchObject({ ok: true, usuarios: { manager: "nube", caja: "nube-caja" } });
  });

  it("fija las dos contraseñas, las de antes dejan de valer y el enlace no sirve dos veces", async () => {
    const generada = await nuevaClave("nube", "manager");
    const token = tokenDe((await nuevaInvitacion("nube")).url);

    expect(await aceptarInvitacion(token, CLAVES)).toEqual({ ok: true, negocio: "nube", alcance: "alta" });
    expect(await comprobarAcceso("nube", CLAVES.manager)).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(await comprobarAcceso("nube-caja", CLAVES.caja)).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(await comprobarAcceso("nube", generada.clave)).toBeNull();
    // La de la caja no abre el manager.
    expect(await comprobarAcceso("nube", CLAVES.caja)).toBeNull();

    expect(await aceptarInvitacion(token, CLAVES)).toMatchObject({ ok: false, motivo: expect.stringMatching(/ya se usó/) });
  });

  it("caduca, y un enlace nuevo anula el anterior", async () => {
    const viejo = tokenDe((await nuevaInvitacion("nube")).url);
    const tarde = Date.now() + (DIAS_VALIDA + 1) * 86400000;
    expect(await leerInvitacion(viejo, tarde)).toMatchObject({ ok: false, motivo: expect.stringMatching(/caducado/) });

    const nuevo = tokenDe((await nuevaInvitacion("nube")).url);
    expect(await leerInvitacion(viejo)).toMatchObject({ ok: false });
    expect(await leerInvitacion(nuevo)).toMatchObject({ ok: true });
    // El de otra tienda no se toca.
    const otra = tokenDe((await nuevaInvitacion("fade")).url);
    await nuevaInvitacion("nube");
    expect(await leerInvitacion(otra)).toMatchObject({ ok: true });
  });

  it("rechaza contraseñas flojas o iguales entre sí, sin gastar el enlace", async () => {
    const token = tokenDe((await nuevaInvitacion("nube")).url);
    expect(await aceptarInvitacion(token, { manager: "corta", caja: CLAVES.caja })).toMatchObject({ ok: false, campo: "manager" });
    expect(await aceptarInvitacion(token, { manager: CLAVES.manager, caja: CLAVES.manager })).toMatchObject({ ok: false, campo: "caja" });
    expect(await aceptarInvitacion(token, CLAVES)).toMatchObject({ ok: true });
  });

  it("las elegidas van tal cual: una con forma de generada («micafeteria1») ya no vale también en mayúsculas", async () => {
    // Hasta el 15-10-2026 se aplanaba como "MICA-FETE-RIA1" y entraba igual con «MICAFETERIA1»
    // o «mi ca fe teria1»: menos entropía y una sorpresa para el dueño (lib/claves.js).
    const token = tokenDe((await nuevaInvitacion("nube")).url);
    await aceptarInvitacion(token, { manager: "micafeteria1", caja: CLAVES.caja });
    expect(await comprobarAcceso("nube", "micafeteria1")).toMatchObject({ rol: "manager" });
    expect(await comprobarAcceso("nube", "MICAFETERIA1")).toBeNull();
    expect(await comprobarAcceso("nube-caja", "CAJA DE LA TIENDA")).toBeNull();
  });

  describe("enlace solo para la contraseña del dueño (alcance «manager»)", () => {
    it("fija solo la suya: la caja sigue con la que tenía, y no puede elegir la de la caja", async () => {
      const caja = await nuevaClave("nube", "caja");
      const generada = await nuevaClave("nube", "manager");
      const { url, alcance } = await nuevaInvitacion("nube", { alcance: "manager" });
      expect(alcance).toBe("manager");
      const token = tokenDe(url);
      expect(await leerInvitacion(token)).toMatchObject({ ok: true, alcance: "manager", usuarios: { manager: "nube", caja: "nube-caja" } });

      expect(await aceptarInvitacion(token, { manager: caja.clave })).toMatchObject({ ok: false, campo: "manager", motivo: expect.stringMatching(/caja/) });
      expect(await aceptarInvitacion(token, { manager: "corta" })).toMatchObject({ ok: false, campo: "manager" });
      // Sin la de la caja en el cuerpo: no hace falta, y si viene se ignora.
      expect(await aceptarInvitacion(token, { manager: "la nueva del dueño" })).toEqual({ ok: true, negocio: "nube", alcance: "manager" });
      expect(await comprobarAcceso("nube", "la nueva del dueño")).toMatchObject({ rol: "manager" });
      expect(await comprobarAcceso("nube", generada.clave)).toBeNull();
      expect(await comprobarAcceso("nube-caja", caja.clave)).toMatchObject({ rol: "caja" });
      expect(await aceptarInvitacion(token, { manager: "otra más larga" })).toMatchObject({ ok: false, motivo: expect.stringMatching(/ya se usó/) });
    });

    it("un alcance inventado no se crea; uno de antes de la columna cuenta como alta", async () => {
      await expect(nuevaInvitacion("nube", { alcance: "caja" })).rejects.toThrow(/Alcance/);
      const token = tokenDe((await nuevaInvitacion("nube")).url);
      expect(await leerInvitacion(token)).toMatchObject({ ok: true, alcance: "alta" });
    });
  });

  describe("por la ruta: queda apuntado quién creó el enlace y que se aceptó", () => {
    it("el admin con su nombre al crearlo; el dueño, como manager, al usarlo", async () => {
      vi.stubEnv("NODE_ENV", "test"); // la ruta firma la sesión del dueño con el secreto de demo
      const creada = await rutaAdmin.POST(await pedir("/api/admin/invitacion", { slug: "nube", alcance: "manager" }, ["plataforma", "admin", Date.now(), { usuario: "diego" }]));
      expect(creada.status).toBe(200);
      const d = await creada.json();
      expect(d).toMatchObject({ alcance: "manager", usuarios: { manager: "nube" } });
      expect((await rutaAdmin.POST(await pedir("/api/admin/invitacion", { slug: "nube", alcance: "caja" }, ["plataforma", "admin"]))).status).toBe(400);

      const token = tokenDe(d.url);
      const leida = await rutaInvitacion.POST(await pedir("/api/invitacion", { token }));
      expect(await leida.json()).toMatchObject({ nombre: "Nube Café", alcance: "manager", usuarios: { manager: "nube" } });

      const aceptada = await rutaInvitacion.POST(await pedir("/api/invitacion", { token, manager: "la nueva del dueño" }));
      expect(aceptada.status).toBe(200);
      expect(await aceptada.json()).toEqual({ ok: true, destino: "/nube/manager" });
      const cookie = aceptada.headers.get("set-cookie");
      expect(await verificarSesion(/sesion=([^;]+)/.exec(cookie)[1])).toMatchObject({ negocio: "nube", rol: "manager", usuario: "nube" });

      const apuntado = (await listAuditoria("nube")).filter((a) => a.accion === "invitacion");
      expect(apuntado.map((a) => [a.usuario, a.rol, a.detalle])).toEqual([
        ["nube", "manager", "aceptada manager"],
        ["diego", "admin", "creada manager"],
      ]);
    });
  });

  it("tokens rotos o inventados no valen", async () => {
    expect(await leerInvitacion("")).toMatchObject({ ok: false });
    expect(await leerInvitacion("x".repeat(43))).toMatchObject({ ok: false, motivo: expect.stringMatching(/no vale/) });
  });

  it("borrar la tienda se lleva sus invitaciones y tutoriales", async () => {
    const token = tokenDe((await nuevaInvitacion("nube")).url);
    await marcarTutorial({ usuario: "nube", negocio: "nube", recorrido: "manager" });
    await marcarTutorial({ usuario: "fade", negocio: "fade", recorrido: "manager" });
    await borrarNegocio("nube");
    expect(await leerInvitacion(token)).toMatchObject({ ok: false });
    expect(await tutorialesVistos("nube")).toEqual([]);
    expect(await tutorialesVistos("fade")).toEqual(["manager"]);
  });

  it("/invitacion y su API son públicas; 'invitacion' no puede ser una tienda", () => {
    expect(reglaDeRuta("/invitacion", new URLSearchParams())).toEqual({ tipo: "publica" });
    expect(reglaDeRuta("/api/invitacion", new URLSearchParams(), "POST")).toEqual({ tipo: "publica" });
    expect(reglaDeRuta("/api/admin/invitacion", new URLSearchParams(), "POST")).toEqual({ tipo: "admin" });
  });
});

describe("contraseña elegida", () => {
  it("larga, distinta del usuario y no un carácter repetido", () => {
    expect(problemaClaveElegida("corta", "nube")).toMatch(/al menos/);
    expect(problemaClaveElegida("aaaaaaaaaaaa", "nube")).toMatch(/repetido/);
    expect(problemaClaveElegida("nube-cajaXX", "nube-cajaxx")).toMatch(/usuario/);
    expect(problemaClaveElegida("un café por favor", "nube")).toBeNull();
  });
});
