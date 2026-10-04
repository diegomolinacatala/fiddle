import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// RGPD (docs/RGPD.md): promos solo a quien no dijo que no, borrar a un cliente
// en dos tiempos, la página del cliente, los plazos, la auditoría y las alertas.
// Con el backend de ficheros y sin Apple ni Google: lo que se comprueba es lo
// que decide el código, no lo que hacen los teléfonos.
// ============================================================================

const store = await import("@/lib/store");
const { firmarSesion } = await import("@/lib/auth");
const { camposDelPase, construirPassJson } = await import("@/lib/apple/pase");
const { construirObjeto } = await import("@/lib/google/pase");
const { cambiarPromos, borrarCliente, datosDeCliente } = await import("@/lib/derechos");
const { llaveDe, enlaceGestion, accesoATarjeta } = await import("@/lib/gestion");
const { limpiezaDiaria } = await import("@/lib/limpieza");
const { vigilar, cuerpoDeAlerta } = await import("@/lib/alertas");
const { normalizarLegal, legalCompleto, limiteSinUso, VERSION_AVISO } = await import("@/lib/legal");
const { perfilDe } = await import("@/lib/crm");
const { elegibles } = await import("@/lib/automatizaciones");
const { emitirPase } = await import("@/lib/wallet");
const rutaDatos = await import("@/app/api/tarjeta/[serial]/datos/route.js");
const rutaFicha = await import("@/app/api/crm/cliente/[serial]/route.js");
const rutaFichaDatos = await import("@/app/api/crm/cliente/[serial]/datos/route.js");
const rutaCampana = await import("@/app/api/crm/campana/route.js");

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sellos-rgpd-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("APPLE_PASS_TYPE_ID", "");
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "");
  vi.stubEnv("ALERTAS_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const DIA = 24 * 60 * 60 * 1000;
const nuevo = async (serial, extra = {}) => {
  const c = await store.crearCliente({ serial, negocio: "nube", authToken: `tok-${serial}`.padEnd(24, "x"), ...extra });
  return c;
};

async function pedir(url, { metodo = "POST", cuerpo, como = null, cookies = {}, cabeceras = {} } = {}) {
  const galletas = Object.entries(cookies).map(([k, v]) => `${k}=${v}`);
  if (como) galletas.push(`sesion=${await firmarSesion(...como)}`);
  const headers = { ...cabeceras, ...(galletas.length ? { cookie: galletas.join("; ") } : {}) };
  if (cuerpo) headers["content-type"] = "application/json";
  return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
}
const params = (serial) => ({ params: Promise.resolve({ serial }) });

describe("promos: soft opt-in", () => {
  it("de partida sí; quien dice que no no ve ni la promo ni el «Para ti» en Apple ni en Google", async () => {
    const nube = { ...(await store.getNegocio("nube")), promo: "2x1 hoy" };
    const c = await nuevo("s1");
    expect(c.promos_no).toBeNull();
    const conMensaje = { ...c, mensaje: "Te echamos de menos" };
    expect(camposDelPase(conMensaje, nube).auxiliaryFields).toHaveLength(1);

    const no = { ...conMensaje, promos_no: "2026-10-01T00:00:00Z" };
    expect(camposDelPase(no, nube).auxiliaryFields).toEqual([]);
    expect(construirObjeto(no, nube, { issuerId: "1", appUrl: "https://f.test" })).not.toHaveProperty("messages");
    // Los sellos siguen: el premio está en la cara igual.
    expect(camposDelPase(no, nube).secondaryFields[0].key).toBe("premio");
  });

  it("cambiarPromos guarda cuándo, quita el mensaje puesto y deja el evento con quién", async () => {
    const nube = await store.getNegocio("nube");
    await nuevo("s1");
    await store.guardarMensajes(["s1"], "Vuelve");
    const c = await store.getCliente("s1");
    const despues = await cambiarPromos(c, nube, false, "cliente");
    expect(despues.promos_no).toBeTruthy();
    expect(despues.mensaje).toBeNull();
    const [evento] = await store.listEventos("s1");
    expect(evento).toMatchObject({ tipo: "promos_no", actor: "cliente" });

    const otraVez = await cambiarPromos(despues, nube, true, "manager");
    expect(otraVez.promos_no).toBeNull();
    expect((await store.listEventos("s1"))[0]).toMatchObject({ tipo: "promos_si", actor: "manager" });
  });

  it("guardarMensajes nunca escribe una promo a quien dijo que no (la red bajo campañas y reglas)", async () => {
    await nuevo("si");
    await nuevo("no");
    await store.guardarPromos("no", false);
    expect(await store.guardarMensajes(["si", "no"], "Hola")).toBe(1);
    expect((await store.getCliente("no")).mensaje).toBeNull();
    // Quitar un mensaje sí va a todos.
    expect(await store.guardarMensajes(["si", "no"], null)).toBe(2);
  });

  it("las reglas automáticas y los conteos no cuentan a quien no quiere promos", async () => {
    const nube = await store.getNegocio("nube");
    const base = { serial: "a", negocio: "nube", visitas: 3, creado: new Date(Date.now() - 90 * DIA).toISOString(), ultima_visita: new Date(Date.now() - 40 * DIA).toISOString(), instalado: new Date(Date.now() - 80 * DIA).toISOString() };
    const p = perfilDe(base, nube);
    const sinPromos = perfilDe({ ...base, promos_no: "2026-10-01T00:00:00Z" }, nube);
    expect(p.avisable).toBe(true);
    expect(sinPromos).toMatchObject({ contactable: true, sinPromos: true, avisable: false });
    const regla = { id: "r", disparo: "sin_venir", valor: 21, activa: true };
    const ctx = (perfil) => ({ serial: perfil.serial, perfil, desde: 0, vars: {} });
    expect(elegibles(regla, [ctx(p)])).toHaveLength(1);
    expect(elegibles(regla, [ctx(sinPromos)])).toHaveLength(0);
  });

  it("una campaña a un grupo salta a quien no quiere promos", async () => {
    await nuevo("si");
    await nuevo("no");
    for (const s of ["si", "no"]) {
      await store.registrarPase({ dispositivo: `d-${s}`, pushToken: "ab".repeat(16), passType: "pass.x", serial: s, negocio: "nube" });
      await store.marcarInstalacion(s, true);
    }
    await store.guardarPromos("no", false);
    // Recién sacadas y sin visitas: las dos están en «Sin uso».
    const r = await rutaCampana.POST(await pedir("/api/crm/campana", { cuerpo: { b: "nube", grupo: "fantasmas", texto: "Hola" }, como: ["nube", "manager"] }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.destinatarios).toBe(1);
    expect((await store.getCliente("si")).mensaje).toBe("Hola");
    expect((await store.getCliente("no")).mensaje).toBeNull();
  });

  it("el alta guarda qué aviso de privacidad había", async () => {
    const { cliente } = await emitirPase("nube", { origen: "tap" });
    expect(cliente.aviso_version).toBe(VERSION_AVISO);
  });
});

describe("borrar a un cliente, en dos tiempos", () => {
  it("al momento: vacía, anulada, fuera de la lista, y queda constancia sin datos personales", async () => {
    const nube = await store.getNegocio("nube");
    await nuevo("s1", { nombre: "Ana" });
    await store.guardarNota("s1", "el del perro");
    await store.saveCliente({ serial: "s1", sellos: 5, premios: 1 });
    expect(await borrarCliente(await store.getCliente("s1"), nube, { motivo: "manager" })).toBe(true);

    const c = await store.getCliente("s1");
    expect(c).toMatchObject({ nombre: null, nota: null, sellos: 0, premios: 0, mensaje: null });
    expect(c.borrado_en).toBeTruthy();
    expect(await store.listClientes("nube")).toEqual([]);
    // El pase que baja su iPhone: anulado y sin nada.
    const pase = construirPassJson(c, nube, { passTypeId: "pass.x", teamId: "T", appUrl: "https://f.test" });
    expect(pase.voided).toBe(true);
    expect(JSON.stringify(pase)).not.toContain("Ana");
    expect(construirObjeto(c, nube, { issuerId: "1", appUrl: "https://f.test" }).state).toBe("INACTIVE");
    const [b] = await store.listBorrados("nube");
    expect(b).toMatchObject({ negocio: "nube", tipo: "cliente", motivo: "manager", cuantos: 1 });
    expect(JSON.stringify(b)).not.toContain("s1");
    // Dos veces no cuenta dos.
    expect(await borrarCliente(c, nube, { motivo: "manager" })).toBe(false);
  });

  it("al día siguiente: la fila, sus fusionadas, su historial, sus registros y el teléfono que se queda sin pases", async () => {
    const nube = await store.getNegocio("nube");
    await nuevo("s1");
    await nuevo("vieja");
    await nuevo("otro");
    await store.addEvento("s1", "sellar", "Sello", { negocio: "nube" });
    await store.registrarPase({ dispositivo: "solo", pushToken: "ab".repeat(16), passType: "pass.x", serial: "s1", negocio: "nube" });
    await store.registrarPase({ dispositivo: "compartido", pushToken: "cd".repeat(16), passType: "pass.x", serial: "s1", negocio: "nube" });
    await store.registrarPase({ dispositivo: "compartido", pushToken: "cd".repeat(16), passType: "pass.x", serial: "otro", negocio: "nube" });
    await store.apuntarTarjetaDeDispositivo({ dispositivo: "solo", negocio: "nube", serial: "s1" });
    await store.fusionarClientes(await store.getCliente("vieja"), await store.getCliente("s1"), {});

    await borrarCliente(await store.getCliente("s1"), nube, { motivo: "cliente" });
    // Antes de cumplir el día no cae nada.
    expect((await limpiezaDiaria({ forzar: true })).purgados).toBe(0);
    expect(await store.getCliente("s1")).not.toBeNull();

    const r = await limpiezaDiaria({ forzar: true, ahora: Date.now() + 25 * 60 * 60 * 1000 });
    expect(r.purgados).toBe(2);
    expect(await store.getCliente("s1")).toBeNull();
    expect(await store.getCliente("vieja")).toBeNull();
    expect(await store.listEventos("s1")).toEqual([]);
    expect(await store.dispositivosDeTarjeta("s1")).toEqual([]);
    expect(await store.tarjetaDeDispositivo({ dispositivo: "solo", negocio: "nube" })).toBeNull();
    // El que tenía otro pase sigue; el que no, se fue con su push token.
    expect(await store.pushTokens({ negocio: "nube" })).toEqual(["cd".repeat(16)]);
    expect(await store.getCliente("otro")).not.toBeNull();
  });

  it("una tarjeta borrada no es de nadie: ni el tap ni la caja ni /api/tarjeta", async () => {
    const { clienteVigente } = await import("@/lib/unaTarjeta");
    await nuevo("s1");
    await store.marcarBorrado("s1");
    expect(await clienteVigente(store.getCliente, "s1")).toBeNull();
    const accion = await import("@/app/api/accion/route.js");
    const r = await accion.POST(await pedir("/api/accion", { cuerpo: { serial: "s1", accion: "sellar" }, como: ["nube", "caja"] }));
    expect(r.status).toBe(410);
  });
});

describe("plazos", () => {
  it("24 meses sin nada: se vacía y anula; al día siguiente cae. Con una visita reciente, no", async () => {
    await nuevo("viejo");
    await nuevo("vuelve");
    await nuevo("nuevo");
    const hace = (meses) => new Date(Date.now() - meses * 31 * DIA).toISOString();
    // Fechas a mano en el fichero: así se simula una tarjeta de hace años.
    const fs = await import("node:fs/promises");
    const fichero = path.join(dir, "clientes.json");
    const todos = JSON.parse(await fs.readFile(fichero, "utf8"));
    todos.viejo.creado = hace(30);
    todos.vuelve.creado = hace(30);
    todos.vuelve.ultima_visita = hace(2);
    await fs.writeFile(fichero, JSON.stringify(todos));

    const r = await limpiezaDiaria({ forzar: true });
    expect(r.caducados).toBe(1);
    expect((await store.getCliente("viejo")).borrado_en).toBeTruthy();
    expect((await store.getCliente("vuelve")).borrado_en).toBeNull();
    expect((await store.listBorrados("nube"))[0]).toMatchObject({ motivo: "plazo", rol: "reloj" });
  });

  it("corre una vez al día: la segunda pasada del día no hace nada", async () => {
    expect(await limpiezaDiaria()).not.toBeNull();
    expect(await limpiezaDiaria()).toBeNull();
  });

  it("el límite de 24 meses es una fecha de hace dos años", () => {
    const ahora = Date.parse("2026-10-04T12:00:00Z");
    expect(limiteSinUso(ahora)).toBe("2024-10-04T12:00:00.000Z");
  });

  it("una tienda archivada: a los 30 días se anulan sus tarjetas y, al día siguiente, se borra entera", async () => {
    await nuevo("s1");
    await store.registrarPase({ dispositivo: "d1", pushToken: "ab".repeat(16), passType: "pass.x", serial: "s1", negocio: "nube" });
    await store.archivarNegocio("nube");
    const archivada = await store.getNegocio("nube", { incluirArchivados: true });
    expect(archivada.archivadoEn).toBeTruthy();

    // Antes de los 30 días, nada.
    await limpiezaDiaria({ forzar: true, ahora: Date.now() + 10 * DIA });
    expect((await store.getCliente("s1")).borrado_en).toBeNull();

    const dia31 = Date.now() + 31 * DIA;
    const r1 = await limpiezaDiaria({ forzar: true, ahora: dia31 });
    expect(r1.tiendasAnuladas).toEqual(["nube"]);
    expect((await store.getCliente("s1")).borrado_en).toBeTruthy();
    expect(await store.getNegocio("nube", { incluirArchivados: true })).not.toBeNull();

    const r2 = await limpiezaDiaria({ forzar: true, ahora: dia31 + 2 * DIA });
    expect(r2.tiendasBorradas).toEqual(["nube"]);
    expect(await store.getCliente("s1")).toBeNull();
    expect(await store.pushTokens({})).toEqual([]);
    expect((await store.listBorrados("nube")).map((b) => b.tipo)).toContain("tienda");
  });

  it("borrar una tienda a mano tampoco deja push tokens huérfanos", async () => {
    await nuevo("s1");
    await store.registrarPase({ dispositivo: "d1", pushToken: "ab".repeat(16), passType: "pass.x", serial: "s1", negocio: "nube" });
    await store.borrarNegocio("nube");
    expect(await store.pushTokens({})).toEqual([]);
  });
});

describe("la página del cliente: llave o cookie, nunca el serial solo", () => {
  it("la llave sale del token pero no es él, y el enlace la lleva tras el #", async () => {
    const c = await nuevo("s1");
    const llave = llaveDe(c);
    expect(llave).toHaveLength(32);
    expect(llave).not.toContain(c.auth_token);
    expect(enlaceGestion("https://f.test", c)).toBe(`https://f.test/p/s1/datos#${llave}`);
    const cookies = (m) => ({ get: (k) => (m[k] ? { value: m[k] } : undefined) });
    expect(accesoATarjeta(c, { llave, cookies: cookies({}) })).toBe("llave");
    expect(accesoATarjeta(c, { llave: "x".repeat(32), cookies: cookies({}) })).toBeNull();
    expect(accesoATarjeta(c, { cookies: cookies({ tarjeta_nube: "s1" }) })).toBeNull(); // no es un uuid
  });

  it("sin llave ni cookie, nada; con la llave, ver, dejar las promos, descargar y borrar", async () => {
    const { cliente } = await emitirPase("nube", { nombre: "Ana" });
    const s = cliente.serial;
    const sinNada = await rutaDatos.POST(await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "ver" } }), params(s));
    expect(sinNada.status).toBe(403);

    const llave = llaveDe(cliente);
    const ver = await rutaDatos.POST(await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "ver", llave } }), params(s));
    expect(await ver.json()).toEqual({ codigo: cliente.codigo, promos: true });

    // Con la cookie del teléfono que la sacó también vale.
    const conCookie = await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "promos", quiere: false }, cookies: { tarjeta_nube: s } });
    expect(await (await rutaDatos.POST(conCookie, params(s))).json()).toEqual({ promos: false });

    const descarga = await rutaDatos.POST(await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "descargar", llave } }), params(s));
    const datos = JSON.parse(await descarga.text());
    expect(datos.tarjeta).toMatchObject({ codigo: cliente.codigo, nombre: "Ana", recibePromos: false });
    expect(datos.historial.map((e) => e.que)).toEqual(expect.arrayContaining(["alta", "promos_no"]));
    expect(JSON.stringify(datos)).not.toContain(cliente.auth_token);

    const otraWeb = await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "borrar", llave }, cabeceras: { "sec-fetch-site": "cross-site" } });
    expect((await rutaDatos.POST(otraWeb, params(s))).status).toBe(403);

    const borrar = await rutaDatos.POST(await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "borrar", llave } }), params(s));
    expect(borrar.status).toBe(200);
    expect((await store.getCliente(s)).borrado_en).toBeTruthy();
    expect((await store.listBorrados("nube"))[0]).toMatchObject({ motivo: "cliente" });
    const despues = await rutaDatos.POST(await pedir(`/api/tarjeta/${s}/datos`, { cuerpo: { accion: "ver", llave } }), params(s));
    expect(despues.status).toBe(410);
  });

  it("el reverso del pase lleva el enlace a sus datos (con la llave, sin enseñarla)", async () => {
    const nube = await store.getNegocio("nube");
    const c = await nuevo("s1");
    const pase = construirPassJson(c, nube, { passTypeId: "pass.x", teamId: "T", appUrl: "https://f.test", enlaceDatos: enlaceGestion("https://f.test", c) });
    const datos = pase.storeCard.backFields.find((f) => f.key === "datos");
    expect(datos.attributedValue).toContain(`#${llaveDe(c)}`);
    expect(datos.value).not.toContain(llaveDe(c));
  });
});

describe("la ficha del manager", () => {
  it("cambia las promos, descarga sus datos y borra confirmando el código; la caja no puede", async () => {
    const c = await nuevo("s1");
    const promos = await rutaFicha.PUT(await pedir("/api/crm/cliente/s1", { metodo: "PUT", cuerpo: { promos: false }, como: ["nube", "manager"] }), params("s1"));
    expect(await promos.json()).toMatchObject({ promos: false });

    const caja = await rutaFichaDatos.GET(await pedir("/api/crm/cliente/s1/datos", { metodo: "GET", como: ["nube", "caja"] }), params("s1"));
    expect(caja.status).toBe(403);
    const otraTienda = await rutaFichaDatos.GET(await pedir("/api/crm/cliente/s1/datos", { metodo: "GET", como: ["fade", "manager"] }), params("s1"));
    expect(otraTienda.status).toBe(403);
    const datos = await rutaFichaDatos.GET(await pedir("/api/crm/cliente/s1/datos", { metodo: "GET", como: ["nube", "manager"] }), params("s1"));
    expect(datos.headers.get("content-disposition")).toContain(`datos-tarjeta-${c.codigo}.json`);
    expect((await store.listAuditoria("nube"))[0]).toMatchObject({ accion: "exportar_cliente", detalle: c.codigo, usuario: "nube", rol: "manager" });

    const mal = await rutaFicha.DELETE(await pedir("/api/crm/cliente/s1", { metodo: "DELETE", cuerpo: { codigo: "ZZZ" }, como: ["nube", "manager"] }), params("s1"));
    expect(mal.status).toBe(400);
    const cajaBorra = await rutaFicha.DELETE(await pedir("/api/crm/cliente/s1", { metodo: "DELETE", cuerpo: { codigo: c.codigo }, como: ["nube", "caja"] }), params("s1"));
    expect(cajaBorra.status).toBe(403);
    const ok = await rutaFicha.DELETE(await pedir("/api/crm/cliente/s1", { metodo: "DELETE", cuerpo: { codigo: c.codigo }, como: ["nube", "manager"] }), params("s1"));
    expect(ok.status).toBe(200);
    expect((await store.getCliente("s1")).borrado_en).toBeTruthy();
  });

  it("los datos de un cliente llevan los avisos que recibió y sus canales, nunca tokens", async () => {
    const nube = await store.getNegocio("nube");
    const c = await nuevo("s1");
    await store.registrarPase({ dispositivo: "d1", pushToken: "ab".repeat(16), passType: "pass.x", serial: "s1", negocio: "nube" });
    await store.crearCampana({ negocio: "nube", grupo: "auto:x", texto: "Vuelve", seriales: ["s1"] });
    await store.crearCampana({ negocio: "nube", grupo: "otro", texto: "No era para ti", seriales: ["s2"] });
    const d = await datosDeCliente(c, nube);
    expect(d.avisosRecibidos).toEqual([expect.objectContaining({ texto: "Vuelve", automatico: true })]);
    expect(d.canales).toEqual([expect.objectContaining({ canal: "Apple Wallet" })]);
    expect(JSON.stringify(d)).not.toContain("ab".repeat(16));
  });
});

describe("datos legales de la tienda", () => {
  it("se limpian; un email que no lo es no se guarda", () => {
    expect(normalizarLegal(null)).toBeNull();
    expect(normalizarLegal({ razonSocial: "  Deli  S.L. ", nif: "b123", email: "no-es-email" }))
      .toEqual({ razonSocial: "Deli S.L.", nif: "B123", direccion: null, email: null });
    expect(legalCompleto({ razonSocial: "x", nif: "y", email: "a@b.es" })).toBe(true);
    expect(legalCompleto({ razonSocial: "x", nif: "y" })).toBe(false);
  });

  it("solo el admin los pone, y se guardan sin mover los pases", async () => {
    const admin = await import("@/app/api/admin/negocios/route.js");
    const r = await admin.PUT(await pedir("/api/admin/negocios", { metodo: "PUT", cuerpo: { slug: "nube", legal: { razonSocial: "Nube SL", nif: "B1", email: "hola@nube.es" } }, como: ["plataforma", "admin"] }));
    expect(r.status).toBe(200);
    expect((await store.getNegocio("nube")).legal).toMatchObject({ razonSocial: "Nube SL", email: "hola@nube.es" });
    expect((await store.listAuditoria("nube"))[0]).toMatchObject({ accion: "config", detalle: "legal", rol: "admin" });
  });
});

describe("alertas", () => {
  it("sin ALERTAS_URL no avisa; con ella, un pico de contraseñas falladas avisa una vez por hora", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200 }));
    for (let i = 0; i < 31; i++) {
      await store.registrarIntento(`login:nube:${i}`);
      await store.registrarIntento("login:nube:*");
    }
    expect((await vigilar({ fetch: f })).enviadas).toEqual([]);
    expect(f).not.toHaveBeenCalled();

    vi.stubEnv("ALERTAS_URL", "https://ntfy.sh/fiddle-alertas");
    const r = await vigilar({ fetch: f });
    expect(r).toMatchObject({ loginFallidos: 31, enviadas: ["login"] });
    expect(f.mock.calls[0][1].body).toContain("31 contraseñas falladas");
    expect((await vigilar({ fetch: f })).enviadas).toEqual([]);
  });

  it("cada servicio con su formato", () => {
    expect(JSON.parse(cuerpoDeAlerta("https://hooks.slack.com/x", "hola").cuerpo)).toEqual({ text: "hola" });
    expect(JSON.parse(cuerpoDeAlerta("https://discord.com/api/webhooks/x", "hola").cuerpo)).toEqual({ content: "hola" });
    expect(cuerpoDeAlerta("https://ntfy.sh/x", "hola")).toEqual({ tipo: "text/plain; charset=utf-8", cuerpo: "hola" });
  });
});
