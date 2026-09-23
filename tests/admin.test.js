import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reglaDeRuta } from "@/lib/acceso";
import { puedeAcceder, resolverUsuario, verificarAcceso, varClave } from "@/lib/auth";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { datosNegocioNuevo, patchNegocioAdmin, notaDeCampo } from "@/lib/validacion";
import * as store from "@/lib/store";

const ACCIONES = ["sellar", "canjear", "restar", "visita"];
const params = (qs = "") => new URLSearchParams(qs);

describe("acceso del admin", () => {
  it("/admin y /api/admin solo para el admin de la plataforma", () => {
    expect(reglaDeRuta("/admin", params())).toEqual({ tipo: "admin" });
    expect(reglaDeRuta("/admin/nube", params())).toEqual({ tipo: "admin" });
    expect(reglaDeRuta("/api/admin/negocios", params())).toEqual({ tipo: "admin" });
    expect(reglaDeRuta("/api/admin/cifrar", params(), "POST")).toEqual({ tipo: "admin" }); // cifra los datos de toda la plataforma
    // Y "admin" no se puede colar como si fuera una tienda.
    expect(esSlug("admin")).toBe(false);
  });

  it("el admin entra en cualquier negocio; una tienda solo en la suya", () => {
    const admin = { negocio: "plataforma", rol: "admin" };
    expect(puedeAcceder(admin, "nube", "manager")).toBe(true);
    expect(puedeAcceder(admin, "loquesea", "caja")).toBe(true);

    const manager = { negocio: "nube", rol: "manager" };
    expect(puedeAcceder(manager, "nube", "caja")).toBe(true);
    expect(puedeAcceder(manager, "fade", "caja")).toBe(false);
    expect(puedeAcceder(null, "nube", "caja")).toBe(false);
  });

  it("victor y diego son admin; su contraseña sale de CLAVE_ADMIN_<NOMBRE>", () => {
    expect(resolverUsuario("victor")).toMatchObject({ rol: "admin", negocio: "plataforma" });
    expect(resolverUsuario("diego")).toMatchObject({ rol: "admin" });
    expect(varClave("victor", "admin")).toBe("CLAVE_ADMIN_VICTOR");

    vi.stubEnv("NODE_ENV", "production"); // fuera de pruebas manda la variable
    vi.stubEnv("USUARIOS_DEMO", "");
    expect(verificarAcceso("victor", "victor")).toBeNull();
    vi.stubEnv("CLAVE_ADMIN_VICTOR", "secreta");
    expect(verificarAcceso("victor", "secreta")).toMatchObject({ rol: "admin" });
    expect(verificarAcceso("diego", "secreta")).toBeNull(); // no es la suya
    vi.unstubAllEnvs();
  });
});

describe("validación del admin", () => {
  const deps = { esSlug, ESTILOS, temaPorDefecto };

  it("una tienda nueva necesita identificador y nombre válidos", () => {
    expect(datosNegocioNuevo({ nombre: "Sin slug" }, deps).error).toMatch(/Identificador/);
    expect(datosNegocioNuevo({ slug: "admin", nombre: "X" }, deps).error).toMatch(/Identificador/);
    expect(datosNegocioNuevo({ slug: "panaderia", nombre: "  " }, deps).error).toMatch(/nombre/);
  });

  it("rellena lo que no se le da", () => {
    const { datos } = datosNegocioNuevo({ slug: "panaderia", nombre: "Panadería Rosa" }, deps);
    expect(datos).toMatchObject({ tipo: "sellos", meta: 8, acciones: ["sellar", "canjear"] });
    expect(datos.tema.estilo).toBe("coffee");

    const cupon = datosNegocioNuevo({ slug: "pizza-x", nombre: "X", tipo: "descuento", meta: 9 }, deps).datos;
    expect(cupon).toMatchObject({ tipo: "descuento", meta: 1, acciones: ["canjear"] }); // un cupón es de un uso
  });

  it("no se cuelan colores ni estilos inventados", () => {
    const { datos } = datosNegocioNuevo({ slug: "x-y", nombre: "X", estilo: "cyberpunk", accent: "rojo" }, deps);
    expect(datos.tema.estilo).toBe("coffee");
    expect(datos.tema.accent).toBe(temaPorDefecto({ estilo: "coffee" }).accent);
  });

  it("el patch del admin admite nombre, brief y tema; el nombre no puede quedar vacío", () => {
    expect(patchNegocioAdmin({ nombre: "  " }, ACCIONES).error).toMatch(/nombre/);
    const { patch } = patchNegocioAdmin({ nombre: "Nuevo", brief: " hola ", tema: { accent: "#123456", emoji: "🥐", cardBg: "nope" } }, ACCIONES);
    expect(patch).toMatchObject({ nombre: "Nuevo", brief: "hola" });
    expect(patch.tema).toEqual({ emoji: "🥐", accent: "#123456" }); // cardBg inválido se cae
  });

  it("cambiar de plantilla re-siembra la paleta; sin estilo solo toca lo enviado", () => {
    const deps2 = { ESTILOS, temaPorDefecto };
    const { patch } = patchNegocioAdmin({ tema: { estilo: "barber" } }, ACCIONES, deps2);
    expect(patch.tema).toMatchObject(temaPorDefecto({ estilo: "barber" })); // colores nuevos enteros

    // Los retoques mandan sobre la plantilla.
    const conColor = patchNegocioAdmin({ tema: { estilo: "barber", forma: "cuadrado" } }, ACCIONES, deps2).patch;
    expect(conColor.tema.forma).toBe("cuadrado");

    // Sin estilo (o con uno inventado) no se toca la paleta.
    const suelto = patchNegocioAdmin({ tema: { estilo: "cyberpunk", forma: "cuadrado" } }, ACCIONES, deps2).patch;
    expect(suelto.tema).toEqual({ forma: "cuadrado" });
  });

  it("las notas de campo llevan clave limpia; sin texto se borran", () => {
    expect(notaDeCampo({ clave: "apple.premio", texto: "esto debería ser X" })).toEqual({ clave: "apple.premio", texto: "esto debería ser X" });
    expect(notaDeCampo({ clave: "apple.premio", texto: "  " }).texto).toBeNull();
    expect(notaDeCampo({ clave: "borra;drop", texto: "x" }).error).toBeTruthy();
  });
});

describe("negocios en la base (modo ficheros)", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-admin-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  const nueva = (slug, extra = {}) => store.crearNegocio({
    slug, nombre: `Tienda ${slug}`, tipo: "sellos", meta: 5, premio: "algo",
    acciones: ["sellar"], tema: temaPorDefecto({ estilo: "coffee" }), brief: "", ...extra,
  });

  it("crea, aparece en la lista y no admite slugs repetidos", async () => {
    const r = await nueva("panaderia");
    expect(r.negocio).toMatchObject({ slug: "panaderia", nombre: "Tienda panaderia", meta: 5 });
    expect((await store.listNegocios()).map((n) => n.slug)).toContain("panaderia");
    expect((await nueva("panaderia")).error).toMatch(/Ya existe/);
    expect((await nueva("admin")).error).toBeTruthy(); // slug reservado
  });

  it("los tres de siempre siguen ahí aunque no se hayan tocado nunca", async () => {
    const slugs = (await store.listNegocios()).map((n) => n.slug);
    expect(slugs).toEqual(expect.arrayContaining(["nube", "fade", "forno"]));
    expect(await store.getNegocio("nube")).toMatchObject({ nombre: "Nube Café", meta: 8 });
  });

  it("archivar lo esconde de todo, desarchivar lo devuelve", async () => {
    await nueva("panaderia");
    await store.archivarNegocio("panaderia");

    expect(await store.getNegocio("panaderia")).toBeNull();
    expect((await store.listNegocios()).map((n) => n.slug)).not.toContain("panaderia");
    // Pero sigue ahí: el admin lo ve si lo pide.
    expect(await store.getNegocio("panaderia", { incluirArchivados: true })).toMatchObject({ archivado: true });
    expect((await store.listNegocios({ incluirArchivados: true })).map((n) => n.slug)).toContain("panaderia");

    await store.archivarNegocio("panaderia", false);
    expect(await store.getNegocio("panaderia")).toMatchObject({ archivado: false });
  });

  it("borrar se lleva por delante los clientes y su historial", async () => {
    await nueva("panaderia");
    await store.crearCliente({ serial: "s1", negocio: "panaderia", authToken: "t".repeat(20) });
    await store.crearCliente({ serial: "s2", negocio: "panaderia", authToken: "t".repeat(20) });
    await store.crearCliente({ serial: "otro", negocio: "nube", authToken: "t".repeat(20) });
    await store.addEvento("s1", "sellar", "Sello 1/5");

    const { borrados } = await store.borrarNegocio("panaderia");
    expect(borrados).toBe(2);
    expect(await store.getNegocio("panaderia", { incluirArchivados: true })).toBeNull();
    expect(await store.getCliente("s1")).toBeNull();
    expect(await store.listEventos("s1")).toEqual([]);
    expect(await store.getCliente("otro")).not.toBeNull(); // la tienda de al lado, intacta
  });

  it("guarda notas de campo y el brief", async () => {
    await nueva("panaderia", { brief: "panadería de barrio" });
    expect((await store.getNegocio("panaderia")).brief).toBe("panadería de barrio");

    await store.saveNegocio("panaderia", { notas: { "apple.premio": "debería decir compras" } });
    expect((await store.getNegocio("panaderia")).notas).toEqual({ "apple.premio": "debería decir compras" });
    // Guardar otra cosa no se lleva las notas por delante.
    await store.saveNegocio("panaderia", { premio: "croissant" });
    expect((await store.getNegocio("panaderia")).notas["apple.premio"]).toBeTruthy();
  });
});
