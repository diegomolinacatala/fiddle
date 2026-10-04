import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// CADA TIENDA SOLO VE LO SUYO (docs/RGPD.md, 6.1)
// ----------------------------------------------------------------------------
// Todas las rutas del personal, llamadas con la sesión de OTRA tienda (y sin
// sesión), sobre datos de Nube: ninguna puede responder 2xx. Y una lista de
// todas las rutas de /api: una ruta nueva hace fallar el test hasta que se dice
// aquí de qué tipo es. Así no se cuela la próxima que se quede sin guardar.
// ============================================================================

vi.mock("@/lib/wallet", async (original) => ({
  ...(await original()),
  notificarNegocio: vi.fn(async () => ({ proveedor: "demo" })),
  notificarCliente: vi.fn(async () => ({ proveedor: "demo" })),
}));

const store = await import("@/lib/store");
const { firmarSesion } = await import("@/lib/auth");

let dir;
let cliente;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-aislamiento-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  cliente = await store.crearCliente({ serial: "8a1f6c2e-0000-4000-8000-000000000001", negocio: "nube", authToken: "t".repeat(32), nombre: "Ana" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function pedir(url, { metodo = "GET", cuerpo, como }) {
  const headers = {};
  if (como) headers.cookie = `sesion=${await firmarSesion(...como)}`;
  if (cuerpo) headers["content-type"] = "application/json";
  return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
}

const S = () => cliente.serial;
const conSerial = () => ({ params: Promise.resolve({ serial: S() }) });

// [ruta, método, url, cuerpo, ¿lleva params?]
const DEL_PERSONAL = [
  ["accesos/caja", "POST", () => "/api/accesos/caja?b=nube"],
  ["accion", "POST", () => "/api/accion", () => ({ serial: S(), accion: "sellar" })],
  ["automatizaciones", "GET", () => "/api/automatizaciones?b=nube"],
  ["automatizaciones", "PUT", () => "/api/automatizaciones?b=nube", () => ({ avisosActivos: true })],
  ["automatizaciones", "POST", () => "/api/automatizaciones?b=nube", () => ({ regla: "x" })],
  ["cliente/[serial]", "GET", () => `/api/cliente/${S()}`, null, true],
  ["cliente/[serial]", "PUT", () => `/api/cliente/${S()}`, () => ({ nombre: "Otro" }), true],
  ["clientes", "GET", () => "/api/clientes?b=nube"],
  ["crear", "POST", () => "/api/crear?b=nube"],
  ["crm/campana", "POST", () => "/api/crm/campana", () => ({ b: "nube", grupo: "fantasmas", texto: "hola" })],
  ["crm/cliente/[serial]", "GET", () => `/api/crm/cliente/${S()}`, null, true],
  ["crm/cliente/[serial]", "PUT", () => `/api/crm/cliente/${S()}`, () => ({ promos: false, nota: "x" }), true],
  ["crm/cliente/[serial]", "DELETE", () => `/api/crm/cliente/${S()}`, () => ({ codigo: cliente.codigo }), true],
  ["crm/cliente/[serial]/datos", "GET", () => `/api/crm/cliente/${S()}/datos`, null, true],
  ["crm/exportar", "POST", () => "/api/crm/exportar", () => ({ b: "nube", cuantos: 1 })],
  ["crm", "GET", () => "/api/crm?b=nube"],
  ["envios", "POST", () => "/api/envios", () => ({ b: "nube", destino: "fantasmas", texto: "hola", cuando: new Date().toISOString() })],
  ["envios", "DELETE", () => "/api/envios", () => ({ b: "nube", id: "x" })],
  ["logo", "POST", () => "/api/logo?b=nube"],
  ["negocio", "GET", () => "/api/negocio?b=nube"],
  ["negocio", "PUT", () => "/api/negocio?b=nube", () => ({ premio: "nada" })],
  ["promo", "POST", () => "/api/promo", () => ({ b: "nube", texto: "2x1" })],
];

// Del admin: con la sesión de una tienda, fuera.
const DEL_ADMIN = [
  ["admin/accesos", "GET", () => "/api/admin/accesos?slug=nube"],
  ["admin/accesos", "POST", () => "/api/admin/accesos", () => ({ slug: "nube", rol: "caja" })],
  ["admin/cifrar", "POST", () => "/api/admin/cifrar"],
  ["admin/crm", "GET", () => "/api/admin/crm"],
  ["admin/invitacion", "POST", () => "/api/admin/invitacion", () => ({ slug: "nube" })],
  ["admin/negocios", "GET", () => "/api/admin/negocios"],
  ["admin/negocios", "PUT", () => "/api/admin/negocios", () => ({ slug: "nube", legal: { nif: "B1" } })],
  ["admin/negocios", "DELETE", () => "/api/admin/negocios?slug=nube&modo=archivar"],
  ["estado", "GET", () => "/api/estado"],
];

// Públicas a propósito (lib/acceso.js dice por qué cada una) o con su propia llave.
const PUBLICAS = [
  "cron/avisos", "google/guardar/[serial]", "imagen/[tipo]", "invitacion", "login", "logout", "manifest",
  "negocios", "pase/[serial]", "push/[serial]", "salud", "tap", "tarjeta/[serial]", "tarjeta/[serial]/datos",
  "tutorial", "wallet/v1/devices/[dispositivo]/registrations/[passType]/[serial]",
  "wallet/v1/devices/[dispositivo]/registrations/[passType]", "wallet/v1/log", "wallet/v1/passes/[passType]/[serial]",
];

// Todas las rutas, sin importarlas aún (Vite resuelve el patrón al compilar).
const MODULOS = import.meta.glob("../src/app/api/**/route.js");
const rutaDe = (clave) => clave.replace("../src/app/api/", "").replace(/\/route\.js$/, "");
const modulo = (ruta) => MODULOS[`../src/app/api/${ruta}/route.js`]();

describe("una tienda no entra en lo de otra", () => {
  for (const [ruta, metodo, url, cuerpo, params] of DEL_PERSONAL) {
    it(`${metodo} /api/${ruta}: sin sesión o con la de otra tienda, no`, async () => {
      const m = await modulo(ruta);
      for (const como of [null, ["fade", "manager"], ["fade", "caja"]]) {
        const r = await m[metodo](await pedir(url(), { metodo, cuerpo: cuerpo?.(), como }), params ? conSerial() : undefined);
        expect([401, 403], `${metodo} ${ruta} como ${como?.join("/") || "nadie"} dio ${r.status}`).toContain(r.status);
      }
      // Y nada de Nube cambió.
      expect(await store.getCliente(S())).toMatchObject({ nombre: "Ana", sellos: 0, promos_no: null, borrado_en: null });
    });
  }

  for (const [ruta, metodo, url, cuerpo] of DEL_ADMIN) {
    it(`${metodo} /api/${ruta}: solo el admin`, async () => {
      const m = await modulo(ruta);
      const r = await m[metodo](await pedir(url(), { metodo, cuerpo: cuerpo?.(), como: ["nube", "manager"] }));
      expect([401, 403]).toContain(r.status);
    });
  }

  it("todas las rutas de /api están clasificadas aquí", () => {
    const rutas = Object.keys(MODULOS).map(rutaDe);
    expect(rutas.length).toBeGreaterThan(30);
    const conocidas = new Set([...DEL_PERSONAL, ...DEL_ADMIN].map(([r]) => r).concat(PUBLICAS));
    expect(rutas.filter((r) => !conocidas.has(r)), "ruta nueva: añádela a DEL_PERSONAL, DEL_ADMIN o PUBLICAS").toEqual([]);
  });
});
