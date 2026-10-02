import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { firmarSesion, verificarSesion } from "@/lib/auth";
import { sesionVigente } from "@/lib/sesionVigente";
import { nuevaClave } from "@/lib/accesos";
import { hashClave } from "@/lib/claves";
import { nuevaInvitacion, aceptarInvitacion } from "@/lib/invitaciones";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { datosNegocioNuevo } from "@/lib/validacion";
import { negocioDelPersonal } from "@/lib/tarjeta";
import * as store from "@/lib/store";
import * as clientesRuta from "@/app/api/clientes/route.js";
import * as negocioRuta from "@/app/api/negocio/route.js";
import * as adminNegocios from "@/app/api/admin/negocios/route.js";
import * as estadoRuta from "@/app/api/estado/route.js";
import * as tutorialRuta from "@/app/api/tutorial/route.js";
import * as adminAccesos from "@/app/api/admin/accesos/route.js";
import * as adminCifrar from "@/app/api/admin/cifrar/route.js";
import * as adminCrm from "@/app/api/admin/crm/route.js";
import * as adminInvitacion from "@/app/api/admin/invitacion/route.js";

// Una sesión firmada vale hasta que caduca... salvo que cambien la contraseña o
// la tienda ya no esté. Backend de ficheros de verdad.

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sesion-vigente-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const HACE_UN_RATO = () => Date.now() - 60_000;
const sesion = async (slug, rol, ahora = Date.now()) => verificarSesion(await firmarSesion(slug, rol, ahora));

async function pedir(url, { como, metodo = "GET" } = {}) {
  const headers = como ? { cookie: `sesion=${await firmarSesion(...como)}` } : {};
  return new NextRequest(`http://x${url}`, { method: metodo, headers });
}

describe("sesionVigente", () => {
  it("cambiar la contraseña de la caja saca a quien ya estaba dentro (el móvil perdido)", async () => {
    const perdida = await sesion("nube", "caja", HACE_UN_RATO());
    const manager = await sesion("nube", "manager", HACE_UN_RATO());
    expect(await sesionVigente(perdida)).toBeTruthy(); // sin fila en accesos, vale la firma

    await nuevaClave("nube", "caja");
    expect(await sesionVigente(perdida)).toBeNull();
    // Quien entra con la nueva, dentro; y el manager no se entera.
    expect(await sesionVigente(await sesion("nube", "caja"))).toBeTruthy();
    expect(await sesionVigente(manager)).toBeTruthy();
  });

  it("una tienda archivada o borrada no deja seguir con la sesión de antes, ni si el nombre se reutiliza", async () => {
    const caja = await sesion("nube", "caja");
    await store.archivarNegocio("nube", true);
    expect(await sesionVigente(caja)).toBeNull();
    await store.archivarNegocio("nube", false);
    expect(await sesionVigente(caja)).toBeTruthy();

    const deps = { esSlug, ESTILOS, temaPorDefecto };
    await store.crearNegocio(datosNegocioNuevo({ slug: "pan", nombre: "Pan" }, deps).datos);
    const vieja = await sesion("pan", "caja", HACE_UN_RATO());
    await store.borrarNegocio("pan");
    expect(await sesionVigente(vieja)).toBeNull();
    // Otra tienda "pan": nace con contraseñas nuevas, y la cookie de la de antes no vale.
    await store.crearNegocio(datosNegocioNuevo({ slug: "pan", nombre: "Pan nuevo" }, deps).datos);
    await nuevaClave("pan", "caja");
    expect(await sesionVigente(vieja)).toBeNull();
  });

  it("el dueño que acepta la invitación entra y se queda dentro; quien tuviera la sesión de antes, fuera", async () => {
    vi.stubEnv("APP_URL", "https://sellos.app");
    const anterior = await sesion("nube", "manager", HACE_UN_RATO());
    const token = (await nuevaInvitacion("nube")).url.split("#")[1];
    expect(await aceptarInvitacion(token, { manager: "la del dueño 2026", caja: "caja de la tienda" })).toMatchObject({ ok: true });
    // Lo que hace /api/invitacion justo después: firmar su sesión.
    expect(await sesionVigente(await sesion("nube", "manager"))).toBeTruthy();
    expect(await sesionVigente(anterior)).toBeNull();
  });

  it("una fila de accesos de otra tienda no le cierra la sesión a esta caja", async () => {
    const caja = await sesion("nube", "caja", HACE_UN_RATO());
    const intruso = { usuario: "nube-caja", negocio: "nube-caja", rol: "manager", hash: await hashClave("x"), actualizado: new Date().toISOString() };
    writeFileSync(path.join(dir, "accesos.json"), JSON.stringify({ "nube-caja": intruso }));
    expect(await sesionVigente(caja)).toBe(caja);
  });

  it("el admin no depende de la base", async () => {
    const admin = await sesion("plataforma", "admin");
    expect(await sesionVigente(admin)).toBe(admin);
  });

  it("si la base no responde, vale la firma: una caja sin poder entrar es peor", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(path.join(dir, "accesos.json"), "{ esto no es json");
    const caja = await sesion("nube", "caja");
    expect(await sesionVigente(caja)).toBe(caja);
    error.mockRestore();
  });
});

describe("las API con una sesión que ya no vale", () => {
  it("la caja con la contraseña cambiada se queda sin la lista de clientes", async () => {
    const antes = HACE_UN_RATO();
    const cookie = `sesion=${await firmarSesion("nube", "caja", antes)}`;
    const lista = () => clientesRuta.GET(new NextRequest("http://x/api/clientes?b=nube", { headers: { cookie } }));
    expect((await lista()).status).toBe(200);
    await nuevaClave("nube", "caja");
    expect((await lista()).status).toBe(401);
  });

  it("tampoco marca el recorrido de bienvenida", async () => {
    const cookie = `sesion=${await firmarSesion("nube", "caja", HACE_UN_RATO())}`;
    await nuevaClave("nube", "caja");
    const r = await tutorialRuta.GET(new NextRequest("http://x/api/tutorial?recorrido=caja", { headers: { cookie } }));
    expect(r.status).toBe(401);
  });
});

describe("el admin, también en cada handler", () => {
  it("una caja o un manager no pasan aunque el middleware se despiste", async () => {
    expect((await adminNegocios.GET(await pedir("/api/admin/negocios"))).status).toBe(401);
    expect((await adminNegocios.GET(await pedir("/api/admin/negocios", { como: ["nube", "caja"] }))).status).toBe(403);
    expect((await adminNegocios.GET(await pedir("/api/admin/negocios", { como: ["nube", "manager"] }))).status).toBe(403);
    expect((await adminNegocios.GET(await pedir("/api/admin/negocios", { como: ["plataforma", "admin"] }))).status).toBe(200);
  });

  it("todos los handlers de /api/admin, uno a uno", async () => {
    const handlers = [
      ["accesos GET", adminAccesos.GET], ["accesos POST", adminAccesos.POST],
      ["cifrar POST", adminCifrar.POST], ["crm GET", adminCrm.GET],
      ["invitacion POST", adminInvitacion.POST],
      ["negocios GET", adminNegocios.GET], ["negocios POST", adminNegocios.POST],
      ["negocios PUT", adminNegocios.PUT], ["negocios DELETE", adminNegocios.DELETE],
    ];
    for (const [nombre, handler] of handlers) {
      const r = await handler(await pedir("/api/admin/x?slug=nube", { como: ["nube", "manager"], metodo: nombre.split(" ")[1] }));
      expect(r.status, nombre).toBe(403);
    }
  });

  it("el estado de las integraciones es de la plataforma: el manager de una tienda no lo ve", async () => {
    expect((await estadoRuta.GET(await pedir("/api/estado", { como: ["nube", "manager"] }))).status).toBe(403);
  });
});

describe("lo que recibe el personal de su tienda", () => {
  it("todo menos el brief y los comentarios del admin", async () => {
    await store.saveNegocio("nube", { brief: "Para Claude: el dueño es muy exigente", notas: { "apple.premio": "esto debería ser X" } });
    const r = await negocioRuta.GET(await pedir("/api/negocio?b=nube", { como: ["nube", "caja"] }));
    expect(r.status).toBe(200);
    const n = await r.json();
    expect(n.nombre).toBeTruthy();
    expect(n).not.toHaveProperty("brief");
    expect(n).not.toHaveProperty("notas");
    expect(negocioDelPersonal(null)).toBeNull();
  });
});
