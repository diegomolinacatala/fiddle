import { describe, it, expect, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  firmarSesion, verificarSesion, renovarSesion, cookieSesion, puedeAcceder, claveDe, varClave, varPin, usuarioDe, usuariosDemo,
  resolverUsuario, verificarAcceso, secretoSesion, igualSeguro, TTL_SEGUNDOS, MAX_SESION_MS, slugDeTiendaLibre,
} from "@/lib/auth";

const DIA = 24 * 60 * 60 * 1000;

afterEach(() => vi.unstubAllEnvs());

describe("usuarios", () => {
  it("el usuario dice negocio y rol", () => {
    expect(resolverUsuario("nube")).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(resolverUsuario("NUBE ")).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(resolverUsuario("nube-caja")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(resolverUsuario("fade-manager")).toMatchObject({ negocio: "fade", rol: "manager" });
    // Victor y Diego no son de ninguna tienda: son de la plataforma.
    expect(resolverUsuario("victor")).toMatchObject({ negocio: "plataforma", rol: "admin", usuario: "victor" });
    expect(resolverUsuario("Diego ")).toMatchObject({ rol: "admin", usuario: "diego" });
    expect(resolverUsuario("nube caja")).toBeNull();
    expect(resolverUsuario("")).toBeNull();
    expect(usuarioDe("nube", "caja")).toBe("nube-caja");
    expect(usuarioDe("nube", "manager")).toBe("nube");
  });

  it("una tienda no puede llamarse como un usuario de otra", () => {
    expect(slugDeTiendaLibre("pan")).toBe(true);
    expect(slugDeTiendaLibre("caja-pan")).toBe(true);
    // Su manager sería la caja de "pan", y su contraseña pisaría la de esa caja.
    expect(slugDeTiendaLibre("pan-caja")).toBe(false);
    expect(slugDeTiendaLibre("pan-manager")).toBe(false);
    expect(slugDeTiendaLibre("victor")).toBe(false);
    expect(slugDeTiendaLibre("diego")).toBe(false);
  });
});

describe("contraseñas", () => {
  it("en pruebas la contraseña puede ser igual que el usuario", () => {
    expect(usuariosDemo()).toBe(true);
    expect(verificarAcceso("nube", "nube")).toMatchObject({ negocio: "nube", rol: "manager" });
    expect(verificarAcceso("nube-caja", "nube-caja")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(verificarAcceso("nube", "otra")).toBeNull();
    expect(verificarAcceso("nube", "")).toBeNull();
  });

  it("lee CLAVE_<SLUG>_<ROL> y también el nombre antiguo PIN_", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAVE_NUBE_CAJA", "s3creta");
    vi.stubEnv("PIN_FADE_MANAGER", "778899");
    expect(varClave("fade-room", "manager")).toBe("CLAVE_FADE_ROOM_MANAGER");
    expect(varPin("fade-room", "manager")).toBe("PIN_FADE_ROOM_MANAGER");
    expect(claveDe("nube", "caja")).toBe("s3creta");
    expect(verificarAcceso("nube-caja", "s3creta")).toMatchObject({ negocio: "nube", rol: "caja" });
    expect(verificarAcceso("fade", "778899")).toMatchObject({ negocio: "fade", rol: "manager" });
  });

  it("en producción no valen los accesos de prueba, ni con USUARIOS_DEMO=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(usuariosDemo()).toBe(false);
    expect(claveDe("nube", "caja")).toBeNull();
    expect(verificarAcceso("nube", "nube")).toBeNull();

    // La variable de antes se queda olvidada en Vercel: no puede abrir la puerta.
    vi.stubEnv("USUARIOS_DEMO", "1");
    expect(usuariosDemo()).toBe(false);
    expect(verificarAcceso("nube", "nube")).toBeNull();
    expect(verificarAcceso("victor", "victor")).toBeNull();
  });

  it("en local con un AUTH_SECRET de verdad, tampoco: firmaría sesiones que valen en producción", () => {
    vi.stubEnv("AUTH_SECRET", "el-de-vercel");
    expect(usuariosDemo()).toBe(false);
    expect(verificarAcceso("victor", "victor")).toBeNull();
    expect(verificarAcceso("nube", "nube")).toBeNull();
  });

  it("la contraseña de un rol no sirve para el otro", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAVE_FADE_CAJA", "abc123");
    expect(verificarAcceso("fade-caja", "abc123")).toMatchObject({ negocio: "fade", rol: "caja" });
    expect(verificarAcceso("fade", "abc123")).toBeNull();
  });
});

describe("sesión firmada", () => {
  it("firma y verifica negocio + rol, y dice con qué usuario y desde cuándo", async () => {
    const ahora = 1_000_000;
    const token = await firmarSesion("nube", "caja", ahora);
    expect(token.split(".")).toHaveLength(6);
    expect(await verificarSesion(token, ahora)).toEqual({ negocio: "nube", rol: "caja", usuario: "nube-caja", iat: ahora, exp: ahora + TTL_SEGUNDOS.caja * 1000 });
    expect(await verificarSesion(await firmarSesion("nube", "manager", ahora), ahora)).toMatchObject({ usuario: "nube", iat: ahora });
  });

  it("la del admin lleva quién es (victor o diego); sin decirlo queda como «admin», y nadie más cuela", async () => {
    expect(await verificarSesion(await firmarSesion("plataforma", "admin", Date.now(), { usuario: "victor" }))).toMatchObject({ rol: "admin", usuario: "victor" });
    expect(await verificarSesion(await firmarSesion("plataforma", "admin"))).toMatchObject({ rol: "admin", usuario: "admin" });
    await expect(firmarSesion("plataforma", "admin", Date.now(), { usuario: "pepe" })).rejects.toThrow();
    // El usuario de una tienda sale del slug y el rol: no se puede firmar otro.
    await expect(firmarSesion("nube", "caja", Date.now(), { usuario: "nube" })).rejects.toThrow();
    await expect(firmarSesion("nube", "caja", Date.now(), { iat: Date.now() + 1000 })).rejects.toThrow(); // del futuro, no
  });

  it("la sesión de caja dura 30 días y la del manager también (y se renueva mientras la usa)", async () => {
    const ahora = 1_000_000;
    const caja = await verificarSesion(await firmarSesion("nube", "caja", ahora), ahora);
    const manager = await verificarSesion(await firmarSesion("nube", "manager", ahora), ahora);
    expect(caja.exp - ahora).toBe(30 * DIA);
    expect(manager.exp - ahora).toBe(30 * DIA);
    expect(TTL_SEGUNDOS.admin * 1000).toBe(12 * 60 * 60 * 1000);
    expect(cookieSesion("caja")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL_SEGUNDOS.caja });
  });

  it("renovar: el manager y la caja con menos de la mitad reciben otro token con la MISMA emisión; el admin, no", async () => {
    const ahora = 1_000_000;
    const manager = await verificarSesion(await firmarSesion("nube", "manager", ahora), ahora);
    expect(await renovarSesion(manager, ahora + 10 * DIA)).toBeNull(); // le quedan 20 días: aún no
    const renovada = await verificarSesion(await renovarSesion(manager, ahora + 16 * DIA), ahora + 16 * DIA);
    expect(renovada).toEqual({ ...manager, exp: ahora + 16 * DIA + 30 * DIA }); // iat y usuario, los de antes
    // La caja del móvil fijo del mostrador tampoco tiene que volver a teclear la contraseña cada mes.
    const caja = await verificarSesion(await firmarSesion("nube", "caja", ahora), ahora);
    expect(await renovarSesion(caja, ahora + 10 * DIA)).toBeNull();
    const cajaRenovada = await verificarSesion(await renovarSesion(caja, ahora + 29 * DIA), ahora + 29 * DIA);
    expect(cajaRenovada).toEqual({ ...caja, exp: ahora + 29 * DIA + 30 * DIA });
    const admin = await verificarSesion(await firmarSesion("plataforma", "admin", ahora), ahora);
    expect(await renovarSesion(admin, ahora + 11 * 60 * 60 * 1000)).toBeNull();
    expect(await renovarSesion(null)).toBeNull();
  });

  it("renovar tiene tope: a los 90 días de entrar, aunque la use a diario, caduca y vuelve al login", async () => {
    const entro = 1_000_000;
    let sesion = await verificarSesion(await firmarSesion("nube", "manager", entro), entro);
    // Renovada cada 20 días: la emisión no se mueve.
    for (let dia = 20; dia <= 80; dia += 20) {
      sesion = await verificarSesion(await renovarSesion(sesion, entro + dia * DIA), entro + dia * DIA);
      expect(sesion.iat).toBe(entro);
    }
    expect(MAX_SESION_MS).toBe(90 * DIA);
    expect(await renovarSesion(sesion, entro + 91 * DIA)).toBeNull();
  });

  it("rechaza tokens manipulados, caducados o mal formados", async () => {
    const ahora = Date.now();
    const token = await firmarSesion("nube", "caja", ahora);
    const [n, rol, usuario, iat, exp, firma] = token.split(".");
    expect(await verificarSesion(`${n}.manager.${usuario}.${iat}.${exp}.${firma}`)).toBeNull();
    expect(await verificarSesion(`${n}.${rol}.nube.${iat}.${exp}.${firma}`)).toBeNull();
    expect(await verificarSesion(`fade.${rol}.fade-caja.${iat}.${exp}.${firma}`)).toBeNull();
    expect(await verificarSesion(`${n}.${rol}.${usuario}.${iat - 1}.${exp}.${firma}`)).toBeNull(); // más vieja: sobreviviría a un cambio de contraseña
    expect(await verificarSesion(`${n}.${rol}.${usuario}.${iat}.${Number(exp) + 1}.${firma}`)).toBeNull();
    expect(await verificarSesion(token, ahora + TTL_SEGUNDOS.caja * 1000 + 1)).toBeNull();
    expect(await verificarSesion("basura")).toBeNull();
    expect(await verificarSesion("")).toBeNull();
    expect(await verificarSesion("NUBE.caja.nube-caja.1.2.x")).toBeNull();
    expect(await verificarSesion("nube.caja.1.2.x")).toBeNull(); // ni 4 ni 6 partes
  });

  it("acepta todavía el formato de antes (`negocio.rol.exp.firma`) con la emisión deducida; quitarlo a partir del 15-11-2026", async () => {
    vi.stubEnv("AUTH_SECRET", "el-de-vercel");
    const ahora = Date.now();
    const exp = ahora + 10 * DIA; // una caja que entró hace 20 días
    const payload = `nube.caja.${exp}`;
    const viejo = `${payload}.${createHmac("sha256", "el-de-vercel").update(payload).digest("hex")}`;
    expect(await verificarSesion(viejo, ahora)).toEqual({ negocio: "nube", rol: "caja", usuario: "nube-caja", iat: exp - 30 * DIA, exp });
    const admin = `plataforma.admin.${exp}`;
    expect(await verificarSesion(`${admin}.${createHmac("sha256", "el-de-vercel").update(admin).digest("hex")}`, ahora)).toMatchObject({ rol: "admin", usuario: "admin" });
    expect(await verificarSesion(`${payload}.${"0".repeat(64)}`, ahora)).toBeNull();
    // Y desde el 15-11-2026, ni con la firma buena: para entonces todas han caducado.
    const limite = Date.UTC(2026, 10, 15);
    const tardio = `nube.caja.${limite + DIA}`;
    const firmado = `${tardio}.${createHmac("sha256", "el-de-vercel").update(tardio).digest("hex")}`;
    expect(await verificarSesion(firmado, limite - 1)).toMatchObject({ rol: "caja" });
    expect(await verificarSesion(firmado, limite)).toBeNull();
  });

  it("un token firmado con otro secreto no vale", async () => {
    vi.stubEnv("AUTH_SECRET", "secreto-a");
    const token = await firmarSesion("nube", "manager");
    vi.stubEnv("AUTH_SECRET", "secreto-b");
    expect(await verificarSesion(token)).toBeNull();
  });

  it("en producción sin AUTH_SECRET no firma ni verifica", async () => {
    const token = await firmarSesion("nube", "caja");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(secretoSesion()).toBeNull();
    await expect(firmarSesion("nube", "caja")).rejects.toThrow(/AUTH_SECRET/);
    expect(await verificarSesion(token)).toBeNull();
  });

  it("no firma slugs o roles inválidos", async () => {
    await expect(firmarSesion("Nube.x", "caja")).rejects.toThrow();
    await expect(firmarSesion("nube", "jefe")).rejects.toThrow();
  });
});

describe("permisos", () => {
  const caja = { negocio: "nube", rol: "caja" };
  const manager = { negocio: "nube", rol: "manager" };

  it("manager hereda caja de SU negocio", () => {
    expect(puedeAcceder(manager, "nube", "caja")).toBe(true);
    expect(puedeAcceder(manager, "nube", "manager")).toBe(true);
    expect(puedeAcceder(caja, "nube", "caja")).toBe(true);
    expect(puedeAcceder(caja, "nube", "manager")).toBe(false);
  });

  it("una sesión no vale para otro negocio", () => {
    expect(puedeAcceder(manager, "fade", "caja")).toBe(false);
    expect(puedeAcceder(null, "nube", "caja")).toBe(false);
  });

  it("igualSeguro compara bien", () => {
    expect(igualSeguro("abc", "abc")).toBe(true);
    expect(igualSeguro("abc", "abd")).toBe(false);
    expect(igualSeguro("abc", "abcd")).toBe(false);
    expect(igualSeguro(undefined, "a")).toBe(false);
  });
});
