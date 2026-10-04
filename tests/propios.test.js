import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { procesarIcono, procesarFoto } from "@/lib/propiosImagen";
import { normalizarPropios, conPropio, iconosEnUso, marcaDeIcono, esMarcaPropia } from "@/lib/propios";
import { stripDelPase, svgLogo, piezasDeTema, resolverMarca } from "@/lib/apple/dibujo";
import { componerNegocio } from "@/lib/negocios";
import { piezasDeDibujo } from "@/lib/validacion";

// ============================================================================
// «TUYOS»: lo que sube cada tienda es solo suyo (lib/propios.js)
// ============================================================================

const imagen = (w, h, svg, formato = "png") => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg}</svg>`))[formato]().toBuffer();
const galletaJpg = () => imagen(600, 600, `<rect width="600" height="600" fill="#fff"/><circle cx="300" cy="300" r="220" fill="#222"/><circle cx="480" cy="170" r="90" fill="#fff"/>`, "jpeg");
const ID = "0123456789abcdef01234567";

describe("preparar lo que se sube", () => {
  it("un icono se queda en su silueta: blanca sobre transparente, cuadrada y pequeña", async () => {
    const r = await procesarIcono(await galletaJpg());
    expect(r.error).toBeUndefined();
    expect(r.id).toMatch(/^[0-9a-f]{24}$/);
    const { data, info } = await sharp(r.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([160, 160]);
    expect(r.png.length).toBeLessThan(12_000); // va dentro del tema: tiene que pesar poco
    const px = (x, y) => [...data.subarray((y * 160 + x) * 4, (y * 160 + x) * 4 + 4)];
    expect(px(80, 80)).toEqual([255, 255, 255, 255]); // el centro de la galleta: tinta
    expect(px(2, 2)[3]).toBe(0); // la esquina: nada
  });

  it("de un PNG con transparencia, la silueta es lo opaco", async () => {
    const r = await procesarIcono(await imagen(400, 400, `<path d="M220 20 L80 230 H190 L160 380 L320 150 H210 Z" fill="#c3844c"/>`));
    expect(r.error).toBeUndefined();
  });

  it("una imagen lisa o diminuta no es un icono", async () => {
    expect((await procesarIcono(await imagen(300, 300, `<rect width="300" height="300" fill="#fff"/>`))).error).toMatch(/dibujo/);
    expect((await procesarIcono(await imagen(30, 30, `<circle cx="15" cy="15" r="10"/>`))).error).toMatch(/pequeña/);
    expect((await procesarIcono(Buffer.from("hola"))).error).toMatch(/imagen/);
  });

  it("una foto de banda se recorta a la proporción de la banda, en JPG", async () => {
    const r = await procesarFoto(await imagen(1600, 900, `<rect width="1600" height="900" fill="#7a4b2a"/>`, "jpeg"));
    const meta = await sharp(r.jpg).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1125, 369, "jpeg"]);
    expect((await procesarFoto(await imagen(400, 300, `<rect width="400" height="300"/>`, "jpeg"))).error).toMatch(/pequeña/);
  });
});

describe("la lista y las marcas", () => {
  it("sin repetidos, con tope, y lo último subido primero", () => {
    let p = normalizarPropios(null);
    expect(p).toEqual({ logos: [], iconos: [], fondos: [] });
    p = conPropio(p, "iconos", { id: ID });
    p = conPropio(p, "iconos", { id: "fedcba9876543210fedcba98", nombre: "Galleta" });
    p = conPropio(p, "iconos", { id: ID, nombre: "Otra vez" });
    expect(p.iconos.map((x) => x.id)).toEqual([ID, "fedcba9876543210fedcba98"]);
    expect(normalizarPropios({ iconos: [{ id: "malo" }] }).iconos).toEqual([]);
  });

  it("«propia:<id>» se acepta al validar, y se sabe qué iconos usa un tema y sus cartillas", () => {
    const m = marcaDeIcono(ID);
    expect(esMarcaPropia(m)).toBe(true);
    expect(resolverMarca(m)).toBe(m);
    expect(piezasDeDibujo({ marca: m, banda: "foto" })).toMatchObject({ marca: m, banda: "foto" });
    expect(iconosEnUso({ marca: "taza" }, [{ marca: m }, { marca: "taza" }])).toEqual([ID]);
  });
});

describe("dibujarlo", () => {
  const n = componerNegocio("nube", null);
  const uri = "data:image/png;base64,iVBORw0KGgo=";

  it("un icono propio va de máscara del color que toque, en el logo y en los sellos", () => {
    const tema = { ...n.tema, marca: marcaDeIcono(ID), iconos: { [ID]: uri } };
    expect(svgLogo(tema)).toContain(`<mask id="pm-${ID}"`);
    expect(svgLogo(tema)).toContain(`fill="${tema.accent}" mask="url(#pm-${ID})"`);
    expect(stripDelPase({ ...n, tema }, { sellos: 3 }).svg).toContain(uri);
  });

  it("sin su imagen dentro del tema, no se rompe: sale la marca de siempre", () => {
    expect(piezasDeTema({ estilo: "coffee", marca: marcaDeIcono(ID) }).marca).toBe("taza");
  });

  it("la foto de la banda va a sangre con su velo; mientras no llega, la banda clara", () => {
    const tema = { ...n.tema, banda: "foto", fondoFoto: { id: ID, b: "nube" } };
    const sin = stripDelPase({ ...n, tema }, { sellos: 3 }).svg;
    expect(sin).not.toContain("<image");
    const con = stripDelPase({ ...n, tema: { ...tema, fotoBanda: "data:image/jpeg;base64,/9j/" } }, { sellos: 3 }).svg;
    expect(con).toContain('<image href="data:image/jpeg;base64,/9j/"');
    expect(con).toContain('opacity="0.45"');
    // Sin la foto en el tema (fondoFoto), "foto" no vale: la de siempre.
    expect(piezasDeTema({ ...n.tema, banda: "foto", fondoFoto: null }).banda).toBe("clara");
  });
});

// ------------------------------------------------------------ con las rutas
vi.mock("@/lib/wallet", async (original) => ({
  ...(await original()),
  notificarNegocio: vi.fn(async () => ({ proveedor: "demo" })),
}));

describe("solo lo tuyo se guarda en tu tarjeta", () => {
  let dir;
  let store;
  let rutaPropios;
  let rutaNegocio;
  let firmarSesion;
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "sellos-propios-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    store = await import("@/lib/store");
    rutaPropios = await import("@/app/api/propios/route.js");
    rutaNegocio = await import("@/app/api/negocio/route.js");
    ({ firmarSesion } = await import("@/lib/auth"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  async function pedir(url, { metodo = "GET", cuerpo, tipo = "application/json", como = ["nube", "manager"] } = {}) {
    const headers = { cookie: `sesion=${await firmarSesion(...como)}` };
    if (cuerpo) headers["content-type"] = tipo;
    return new NextRequest(`http://x${url}`, { method: metodo, headers, body: cuerpo && tipo === "application/json" ? JSON.stringify(cuerpo) : cuerpo });
  }
  const ponerTema = async (tema, slug = "nube") => rutaNegocio.PUT(await pedir(`/api/negocio?b=${slug}`, { metodo: "PUT", cuerpo: { tema }, como: [slug, "manager"] }));

  it("el logo de La Delicantería no se le puede poner a otra tienda", async () => {
    const r = await ponerTema({ marca: "delicanteria-grano" });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/otra tienda/);
    const d = await ponerTema({ estilo: "delicanteria-verde" });
    expect(d.status).toBe(400);
    // A la suya, sí.
    expect((await ponerTema({ marca: "delicanteria-grano" }, "delicanteria")).status).toBe(200);
  });

  it("se sube un icono, sale en su lista y al ponerlo la tarjeta lo lleva dentro", async () => {
    const subida = await rutaPropios.POST(await pedir("/api/propios?b=nube&tipo=iconos&nombre=galleta.jpg", { metodo: "POST", cuerpo: await galletaJpg(), tipo: "image/jpeg" }));
    expect(subida.status).toBe(201);
    const { id, iconos } = await subida.json();
    expect(iconos).toEqual([expect.objectContaining({ id, nombre: "galleta", uri: expect.stringMatching(/^data:image\/png;base64,/) })]);

    // Subir no cambia la tarjeta.
    expect((await store.getNegocio("nube")).tema.marca).not.toBe(marcaDeIcono(id));
    expect((await ponerTema({ marca: marcaDeIcono(id) })).status).toBe(200);
    const n = await store.getNegocio("nube");
    expect(n.tema.marca).toBe(marcaDeIcono(id));
    expect(n.tema.iconos[id]).toMatch(/^data:image\/png;base64,/);

    // Puesto, no se puede quitar de la lista.
    const quitar = await rutaPropios.DELETE(await pedir(`/api/propios?b=nube&tipo=iconos&id=${id}`, { metodo: "DELETE" }));
    expect(quitar.status).toBe(409);
    // Cambiado por otro y guardado, sí; y el tema ya no lo lleva dentro.
    await ponerTema({ marca: "taza" });
    expect((await store.getNegocio("nube")).tema.iconos).toEqual({});
    const otra = await rutaPropios.DELETE(await pedir(`/api/propios?b=nube&tipo=iconos&id=${id}`, { metodo: "DELETE" }));
    expect((await otra.json()).iconos).toEqual([]);
  });

  it("un icono, una foto o un logo de otra tienda no se guardan", async () => {
    // Fade sube un icono…
    const subida = await rutaPropios.POST(await pedir("/api/propios?b=fade&tipo=iconos", { metodo: "POST", cuerpo: await galletaJpg(), tipo: "image/jpeg", como: ["fade", "manager"] }));
    const { id } = await subida.json();
    // …y Nube intenta usarlo.
    expect((await ponerTema({ marca: marcaDeIcono(id) })).status).toBe(400);
    expect((await ponerTema({ banda: "foto", fondoFoto: { id, b: "fade" } })).status).toBe(400);
    expect((await ponerTema({ logoImagen: { id, b: "fade", opaco: false } })).status).toBe(400);
    // Y su lista no se ve con la sesión de otra.
    const ajena = await rutaPropios.GET(await pedir("/api/propios?b=fade"));
    expect([401, 403]).toContain(ajena.status);
  });

  it("una foto subida se pone de fondo de la banda", async () => {
    const subida = await rutaPropios.POST(await pedir("/api/propios?b=nube&tipo=fondos", {
      metodo: "POST", cuerpo: await imagen(1600, 900, `<rect width="1600" height="900" fill="#7a4b2a"/>`, "jpeg"), tipo: "image/jpeg",
    }));
    const { id, fondos } = await subida.json();
    expect(fondos.map((f) => f.id)).toEqual([id]);
    expect((await ponerTema({ banda: "foto", fondoFoto: { id, b: "nube" } })).status).toBe(200);
    const n = await store.getNegocio("nube");
    expect(n.tema).toMatchObject({ banda: "foto", fondoFoto: { id, b: "nube" } });
    // El servidor la lee al dibujar (Apple, Google).
    const { conFotoBanda } = await import("@/lib/propiosServidor");
    expect((await conFotoBanda(n)).tema.fotoBanda).toMatch(/^data:image\/jpeg;base64,/);
    // Y /api/fondo la sirve sin sesión (la tarjeta web la pinta).
    const { GET } = await import("@/app/api/fondo/route.js");
    const r = await GET(new NextRequest(`http://x/api/fondo?b=nube&v=${id}`));
    expect(r.headers.get("content-type")).toBe("image/jpeg");
  });
});
