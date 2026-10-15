import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { nuevaInvitacion, leerInvitacion, aceptarInvitacion, estadoInvitacion, DIAS_VALIDA } from "@/lib/invitaciones";
import { tokenDeTexto, tokenAlAbrir, LARGO_TOKEN } from "@/lib/tokenInvitacion";
import { comprobarAcceso, nuevaClave } from "@/lib/accesos";
import { problemaClaveElegida } from "@/lib/claves";
import { borrarNegocio, marcarTutorial, tutorialesVistos } from "@/lib/store";
import { reglaDeRuta } from "@/lib/acceso";

const tokenDe = (url) => url.split("#")[1];
const CLAVES = { manager: "la del dueño 2026", caja: "caja de la tienda" };

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
    const { url, token, caduca } = await nuevaInvitacion("nube");
    expect(url).toMatch(/^https:\/\/sellos\.app\/invitacion#[A-Za-z0-9_-]{43}$/);
    expect(url).toBe(`https://sellos.app/invitacion#${token}`); // el token suelto va en el correo, debajo del enlace
    expect(Date.parse(caduca) - Date.now()).toBeGreaterThan((DIAS_VALIDA - 1) * 86400000);
    const guardado = readFileSync(path.join(dir, "invitaciones.json"), "utf8");
    expect(guardado).not.toContain(tokenDe(url));
    expect(await leerInvitacion(tokenDe(url))).toMatchObject({ ok: true, usuarios: { manager: "nube", caja: "nube-caja" } });
  });

  it("cada rechazo lleva un código, para que la página sepa qué aconsejar", async () => {
    expect(await leerInvitacion("")).toMatchObject({ ok: false, codigo: "incompleto" });
    expect(await leerInvitacion("x".repeat(43))).toMatchObject({ ok: false, codigo: "desconocido" });
    const token = tokenDe((await nuevaInvitacion("nube")).url);
    expect(await leerInvitacion(token, Date.now() + (DIAS_VALIDA + 1) * 86400000)).toMatchObject({ ok: false, codigo: "caducada" });
    await aceptarInvitacion(token, CLAVES);
    expect(await leerInvitacion(token)).toMatchObject({ ok: false, codigo: "usada" });
    expect(await aceptarInvitacion(token, CLAVES)).toMatchObject({ ok: false, codigo: "usada" });
  });

  it("el estado para la ficha del admin: pendiente, caducada y cuándo se usó, sin el token", async () => {
    expect(await estadoInvitacion("nube")).toEqual({ pendiente: null, caducada: null, ultimaUsada: null });
    const { token, caduca } = await nuevaInvitacion("nube");
    const estado = await estadoInvitacion("nube");
    expect(estado).toEqual({ pendiente: { creado: expect.any(String), caduca }, caducada: null, ultimaUsada: null });
    expect(JSON.stringify(estado)).not.toContain(token);
    // Pasado el plazo, el mismo enlace cuenta como caducado sin usar.
    expect(await estadoInvitacion("nube", Date.now() + (DIAS_VALIDA + 1) * 86400000)).toMatchObject({ pendiente: null, caducada: { caduca } });

    await aceptarInvitacion(token, CLAVES);
    expect(await estadoInvitacion("nube")).toMatchObject({ pendiente: null, caducada: null, ultimaUsada: expect.any(String) });
    // La de otra tienda no se mezcla.
    expect(await estadoInvitacion("fade")).toEqual({ pendiente: null, caducada: null, ultimaUsada: null });
  });

  it("fija las dos contraseñas, las de antes dejan de valer y el enlace no sirve dos veces", async () => {
    const generada = await nuevaClave("nube", "manager");
    const token = tokenDe((await nuevaInvitacion("nube")).url);

    expect(await aceptarInvitacion(token, CLAVES)).toEqual({ ok: true, negocio: "nube" });
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

  it("una elegida con forma de generada se comprueba igual que al teclearla", async () => {
    const token = tokenDe((await nuevaInvitacion("nube")).url);
    await aceptarInvitacion(token, { manager: "micafeteria1", caja: CLAVES.caja });
    expect(await comprobarAcceso("nube", "micafeteria1")).toMatchObject({ rol: "manager" });
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

// Lo que entiende la página por token (lib/tokenInvitacion.js): el hash tal cual,
// el enlace entero, el código suelto o el correo pegado con todo.
describe("el token visto desde el navegador", () => {
  const token = "A".repeat(20) + "b-c_" + "9".repeat(19);

  it("lo saca del hash, del enlace o de un texto con más cosas alrededor", () => {
    expect(token).toHaveLength(LARGO_TOKEN);
    expect(tokenDeTexto(`#${token}`)).toBe(token);
    expect(tokenDeTexto(token)).toBe(token);
    expect(tokenDeTexto(`  ${token}\n`)).toBe(token);
    expect(tokenDeTexto(`https://sellos.app/invitacion#${token}`)).toBe(token);
    expect(tokenDeTexto(`Abre este enlace:\n\nhttps://sellos.app/invitacion#${token}\n\nSi te pide el código, es este: ${token}.\nUn saludo`)).toBe(token);
    // Un correo que recortó el enlace pero dejó el código suelto.
    expect(tokenDeTexto(`https://sellos.app/invitacion\n\nSi te pide el código, es este: ${token}`)).toBe(token);
  });

  it("no inventa uno donde no lo hay", () => {
    expect(tokenDeTexto("")).toBeNull();
    expect(tokenDeTexto(null)).toBeNull();
    expect(tokenDeTexto("#")).toBeNull();
    expect(tokenDeTexto(token.slice(1))).toBeNull(); // 42: le falta uno
    expect(tokenDeTexto(`${token}x`)).toBeNull(); // 44: pegado a otra cosa
    expect(tokenDeTexto("https://sellos.app/invitacion")).toBeNull();
  });

  it("al abrir: el hash manda; si no hay, lo que guardó la pestaña", () => {
    const otro = "z".repeat(43);
    expect(tokenAlAbrir(`#${token}`, otro)).toBe(token);
    expect(tokenAlAbrir("", otro)).toBe(otro);
    expect(tokenAlAbrir("#", null)).toBeNull();
    expect(tokenAlAbrir("", "basura")).toBeNull();
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
