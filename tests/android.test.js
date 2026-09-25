import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createECDH } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { plataformaDe } from "@/lib/plataforma";
import { avisoDeCambio, avisoPush, avisoDePromo } from "@/lib/avisos";
import { derivarClaves, clavesPush, sujetoPush } from "@/lib/push/vapid";
import { validarSuscripcion, endpointValido, idDeSuscripcion } from "@/lib/push/suscripcion";
import { enviarPush } from "@/lib/push/enviar";
import { serialDeQr } from "@/lib/url";
import { cookieDeTarjeta, serialRecordado } from "@/lib/recordar";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { versionDe, rutaBanda, rutaIcono } from "@/lib/rutasImagen";
import { diagnosticoPush } from "@/lib/diagnostico";
import { SEMILLAS, componerNegocio } from "@/lib/negocios";

const nube = componerNegocio("nube", null);
const forno = componerNegocio("forno", null);
const SERIAL = "55d5c71d-109d-48a7-91f1-6b3fc322e4b9";

// Una suscripción con la forma exacta que da Chrome en Android.
function suscripcionFcm(endpoint = "https://fcm.googleapis.com/fcm/send/abc:APA91b") {
  const curva = createECDH("prime256v1");
  curva.generateKeys();
  return {
    endpoint,
    expirationTime: null,
    keys: { p256dh: curva.getPublicKey().toString("base64url"), auth: Buffer.alloc(16, 7).toString("base64url") },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("plataformaDe", () => {
  it("distingue iPhone, Android y el resto", () => {
    expect(plataformaDe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(plataformaDe("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/128 Mobile")).toBe("android");
    expect(plataformaDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("otro");
    expect(plataformaDe(null)).toBe("otro");
  });
});

describe("avisoDeCambio (lo que suena en Android)", () => {
  it("un sello dice cuánto lleva y cuánto falta, en singular cuando toca", () => {
    expect(avisoDeCambio({ sellos: 2, premios: 0 }, { sellos: 3, premios: 0 }, nube))
      .toEqual({ titulo: "Nube Café", cuerpo: "Sello 3 de 8. Te faltan 5 para café gratis.", tipo: "sello" });
    expect(avisoDeCambio({ sellos: 6, premios: 0 }, { sellos: 7, premios: 0 }, nube).cuerpo).toMatch(/Te falta 1 para/);
  });

  it("cartilla completa, canje y cupón usado", () => {
    expect(avisoDeCambio({ sellos: 7, premios: 0 }, { sellos: 8, premios: 0 }, nube).tipo).toBe("completa");
    expect(avisoDeCambio({ sellos: 8, premios: 0 }, { sellos: 0, premios: 1 }, nube))
      .toMatchObject({ tipo: "canje", cuerpo: expect.stringMatching(/cartilla nueva/) });
    expect(avisoDeCambio({ sellos: 0, premios: 0 }, { sellos: 0, premios: 1 }, forno))
      .toMatchObject({ tipo: "canje", cuerpo: expect.stringMatching(/^Cupón usado: 20% en la Diavola/) });
  });

  it("una corrección, un cambio de nombre o no saber el estado previo no suenan", () => {
    expect(avisoDeCambio({ sellos: 3, premios: 0 }, { sellos: 2, premios: 0 }, nube)).toBeNull();
    expect(avisoDeCambio({ sellos: 3, premios: 0 }, { sellos: 3, premios: 0, nombre: "Ana" }, nube)).toBeNull();
    expect(avisoDeCambio(null, { sellos: 3, premios: 0 }, nube)).toBeNull();
  });

  it("avisoPush: los de una tarjeta se sustituyen entre sí; la promo va aparte", () => {
    const p = avisoPush(avisoDeCambio({ sellos: 0, premios: 0 }, { sellos: 1, premios: 0 }, nube), nube, SERIAL);
    expect(p).toMatchObject({ url: `/p/${SERIAL}`, serial: SERIAL, etiqueta: `tarjeta-${SERIAL}` });
    expect(p.icono).toMatch(/^\/api\/imagen\/icono\?b=nube&t=192&v=/);
    expect(p.insignia).toMatch(/^\/api\/imagen\/insignia\?b=nube/);
    expect(avisoPush(avisoDePromo(nube, "2x1"), nube, SERIAL).etiqueta).toBe("promo-nube");
  });
});

describe("claves VAPID", () => {
  it("derivadas: deterministas, de la curva P-256 y distintas por secreto", () => {
    const a = derivarClaves("secreto-1");
    expect(derivarClaves("secreto-1")).toEqual(a);
    expect(derivarClaves("secreto-2").publica).not.toBe(a.publica);
    const publica = Buffer.from(a.publica, "base64url");
    expect(publica).toHaveLength(65);
    expect(publica[0]).toBe(4);
    // La pública corresponde de verdad a la privada.
    const curva = createECDH("prime256v1");
    curva.setPrivateKey(Buffer.from(a.privada, "base64url"));
    expect(curva.getPublicKey().toString("base64url")).toBe(a.publica);
  });

  it("variables fijas > derivadas de AUTH_SECRET > nada (producción sin secreto)", () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    expect(clavesPush()).toEqual({ publica: "pub", privada: "priv", origen: "variables" });

    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("AUTH_SECRET", "un-secreto");
    expect(clavesPush()).toMatchObject({ ...derivarClaves("un-secreto"), origen: "derivadas" });
    expect(diagnosticoPush().ok).toBe(true);

    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(clavesPush()).toBeNull();
    expect(diagnosticoPush().ok).toBe(false);
  });

  it("diagnosticoPush detecta claves con mal formato", () => {
    expect(diagnosticoPush({ publica: "abc", privada: "def", origen: "variables" }).ok).toBe(false);
  });

  it("sujeto: la URL https de la app, o un mailto en local", () => {
    vi.stubEnv("APP_URL", "https://fiddle.app");
    expect(sujetoPush()).toBe("https://fiddle.app");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(sujetoPush()).toMatch(/^mailto:/);
  });
});

describe("suscripciones del navegador", () => {
  it("acepta la de Chrome en Android y la deja limpia", () => {
    const s = suscripcionFcm();
    expect(validarSuscripcion({ ...s, extra: "fuera" })).toEqual({ endpoint: s.endpoint, keys: s.keys });
    expect(validarSuscripcion(suscripcionFcm("https://updates.push.services.mozilla.com/wpush/v2/x"))).toBeTruthy();
    expect(validarSuscripcion(suscripcionFcm("https://web.push.apple.com/QGd"))).toBeTruthy();
  });

  it("solo servicios de push reales: el servidor no le hace POST a cualquier URL", () => {
    for (const malo of [
      "http://fcm.googleapis.com/fcm/send/x", // sin https
      "https://169.254.169.254/latest/meta-data", // metadatos de la nube
      "https://localhost/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://fcm.googleapis.com:8443/x", // puerto raro
      "https://user:pass@fcm.googleapis.com/x",
      "no es una url",
    ]) {
      expect(endpointValido(malo), malo).toBe(false);
      expect(validarSuscripcion(suscripcionFcm(malo)), malo).toBeNull();
    }
  });

  it("rechaza claves que no son de un navegador", () => {
    const s = suscripcionFcm();
    expect(validarSuscripcion({ ...s, keys: { ...s.keys, p256dh: "corta" } })).toBeNull();
    expect(validarSuscripcion({ ...s, keys: { ...s.keys, auth: Buffer.alloc(8).toString("base64url") } })).toBeNull();
    expect(validarSuscripcion({ endpoint: s.endpoint })).toBeNull();
    expect(validarSuscripcion(null)).toBeNull();
  });

  it("el mismo navegador cae siempre en el mismo dispositivo", () => {
    expect(idDeSuscripcion("https://fcm.googleapis.com/a")).toBe(idDeSuscripcion("https://fcm.googleapis.com/a"));
    expect(idDeSuscripcion("https://fcm.googleapis.com/a")).not.toBe(idDeSuscripcion("https://fcm.googleapis.com/b"));
    expect(idDeSuscripcion("x")).toMatch(/^web-[0-9a-f]{40}$/);
  });
});

describe("enviarPush", () => {
  const claves = derivarClaves("s");

  it("cuenta enviados y separa las suscripciones muertas del resto de errores", async () => {
    const enviar = vi.fn(async (sub) => {
      if (sub.endpoint.endsWith("muerta")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("caida")) throw Object.assign(new Error("boom"), { statusCode: 500 });
      return { statusCode: 201 };
    });
    const token = (e) => JSON.stringify(suscripcionFcm(`https://fcm.googleapis.com/fcm/send/${e}`));
    const r = await enviarPush(
      [{ token: token("ok"), payload: { titulo: "a" } }, { token: token("muerta"), payload: {} }, { token: token("caida"), payload: {} }, { token: "{roto", payload: {} }],
      { enviar, claves },
    );
    expect(r.enviados).toBe(1);
    expect(r.caducados).toHaveLength(2); // la 410 y la ilegible
    expect(r.errores).toEqual([{ estado: 500, razon: "boom" }]);
    // Va cifrado con las claves VAPID y con TTL: un sello no interesa al día siguiente.
    expect(enviar.mock.calls[0][1]).toBe(JSON.stringify({ titulo: "a" }));
    expect(enviar.mock.calls[0][2]).toMatchObject({ vapidDetails: { publicKey: claves.publica, privateKey: claves.privada }, TTL: 43200 });
  });

  it("sin claves no intenta nada", async () => {
    const enviar = vi.fn();
    const r = await enviarPush([{ token: "{}", payload: {} }], { enviar, claves: null });
    expect(enviar).not.toHaveBeenCalled();
    expect(r.enviados).toBe(0);
  });
});

describe("tarjeta pública", () => {
  it("al navegador del cliente no llega nada interno", () => {
    const c = clienteDeTarjeta({
      serial: SERIAL, codigo: "K7M", sellos: 3, premios: 1, nombre: "Ana", mensaje: "Te echamos de menos",
      nota: "el del perro", auth_token: "x".repeat(48), visitas: 9, origen: "tap",
    });
    expect(c).toEqual({ serial: SERIAL, codigo: "K7M", sellos: 3, sellos2: 0, premios: 1, guardados: 0, guardados2: 0, nombre: "Ana", mensaje: "Te echamos de menos" });
    const n = negocioDeTarjeta({ ...nube, brief: "secreto", notas: { "apple.premio": "cambiar" } });
    expect(n).not.toHaveProperty("brief");
    expect(n).not.toHaveProperty("notas");
    expect(n).toMatchObject({ slug: "nube", meta: 8, tema: nube.tema });
  });

  it("el horario llega (para decir si está abierta); los avisos automáticos, no", () => {
    const deli = componerNegocio("delicanteria", null);
    const n = negocioDeTarjeta(deli);
    expect(n.horario).toEqual(deli.horario);
    expect(n).not.toHaveProperty("automatizaciones");
    expect(negocioDeTarjeta(nube).horario).toBeNull();
  });

  it("el tag recuerda la tarjeta por tienda y solo acepta seriales", () => {
    expect(cookieDeTarjeta("nube")).toBe("tarjeta_nube");
    expect(serialRecordado(SERIAL)).toBe(SERIAL);
    expect(serialRecordado("../../etc")).toBeNull();
    expect(serialRecordado(undefined)).toBeNull();
  });

  it("serialDeQr lee el QR de la tarjeta y rechaza otros QR", () => {
    expect(serialDeQr(`https://fiddle.app/w/${SERIAL}`)).toBe(SERIAL);
    expect(serialDeQr(`https://fiddle.app/w/${SERIAL.toUpperCase()}?x=1`)).toBe(SERIAL);
    expect(serialDeQr(SERIAL)).toBe(SERIAL);
    expect(serialDeQr("WIFI:S:cafe;T:WPA;P:1234;;")).toBeNull();
    expect(serialDeQr("https://carta.example.com/menu")).toBeNull();
  });
});

describe("rutas de imagen", () => {
  it("la huella cambia con el diseño y la banda lleva los sellos (acotados a la meta)", () => {
    expect(versionDe(nube)).toBe(versionDe(componerNegocio("nube", null)));
    expect(versionDe({ ...nube, tema: { ...nube.tema, accent: "#000000" } })).not.toBe(versionDe(nube));
    expect(rutaBanda(nube, { sellos: 3 })).toMatch(/[?&]s=3(&|$)/);
    expect(rutaBanda(nube, { sellos: 99 })).toMatch(/[?&]s=8(&|$)/);
    expect(rutaBanda(forno, { premios: 1 })).toMatch(/[?&]u=1(&|$)/);
    expect(rutaIcono(nube, 512, { maskable: true })).toMatch(/[?&]m=1/);
  });
});

// ---------------------------------------------------------------- orquestación
describe("avisos a Android desde wallet.js", () => {
  let dir;
  let wallet;
  let store;
  let push;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/lib/push/enviar", () => ({ enviarPush: vi.fn(async (d) => ({ enviados: d.length, caducados: [], errores: [] })) }));
    dir = mkdtempSync(path.join(tmpdir(), "sellos-android-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    vi.stubEnv("WALLETWALLET_API_KEY", "");
    // resetModules tira las semillas de prueba: se vuelven a meter en el módulo nuevo.
    await import("./tiendasDePrueba.js");
    push = await import("@/lib/push/enviar");
    wallet = await import("@/lib/wallet");
    store = await import("@/lib/store");
  });
  afterEach(() => {
    vi.doUnmock("@/lib/push/enviar");
    rmSync(dir, { recursive: true, force: true });
  });

  async function clienteConAvisos() {
    const { cliente, negocio } = await wallet.emitirPase("nube");
    await store.registrarPase({ dispositivo: "web-1", pushToken: '{"endpoint":"https://fcm.googleapis.com/x"}', passType: "web", serial: cliente.serial, negocio: "nube" });
    // Un iPhone del mismo cliente: no debe recibir el aviso del navegador.
    await store.registrarPase({ dispositivo: "iphone", pushToken: "aa11", passType: "pass.x", serial: cliente.serial, negocio: "nube" });
    return { cliente, negocio };
  }

  it("un sello suena en el navegador; una corrección no", async () => {
    const { cliente, negocio } = await clienteConAvisos();
    const r = await wallet.notificarCliente({ ...cliente, sellos: 1 }, negocio, { antes: cliente });
    expect(r.web).toBe(1);
    const [destinos] = push.enviarPush.mock.calls[0];
    expect(destinos).toEqual([{ token: '{"endpoint":"https://fcm.googleapis.com/x"}', payload: expect.objectContaining({ cuerpo: "Sello 1 de 8. Te faltan 7 para café gratis." }) }]);

    push.enviarPush.mockClear();
    expect((await wallet.notificarCliente({ ...cliente, sellos: 0 }, negocio, { antes: { ...cliente, sellos: 1 } })).web).toBe(0);
    expect(push.enviarPush).not.toHaveBeenCalled();
  });

  it("promo nueva y campaña suenan; guardar la cartilla o retirar la campaña, no", async () => {
    const { cliente, negocio } = await clienteConAvisos();
    expect((await wallet.notificarNegocio({ ...negocio, promo: "2x1" }, { promoNueva: "2x1" })).web).toBe(1);
    expect(push.enviarPush.mock.calls.at(-1)[0][0].payload).toMatchObject({ cuerpo: "2x1", etiqueta: "promo-nube" });

    expect((await wallet.avisarSeriales([cliente.serial], { negocio, texto: "Te echamos de menos" })).web).toBe(1);
    expect(push.enviarPush.mock.calls.at(-1)[0][0].payload.cuerpo).toBe("Te echamos de menos");

    push.enviarPush.mockClear();
    await wallet.notificarNegocio(negocio, { cartilla: true });
    await wallet.avisarSeriales([cliente.serial], { negocio, texto: null });
    expect(push.enviarPush).not.toHaveBeenCalled();
  });

  it("un navegador que ya no quiere avisos se borra por su id (el token es JSON con comillas)", async () => {
    const { cliente, negocio } = await clienteConAvisos();
    const token = '{"endpoint":"https://fcm.googleapis.com/x"}';
    push.enviarPush.mockResolvedValueOnce({ enviados: 0, caducados: [token], errores: [] });
    await wallet.notificarCliente({ ...cliente, sellos: 1 }, negocio, { antes: cliente });
    expect(await store.pushTokens({ seriales: [cliente.serial], passType: "web" })).toEqual([]);
    // El iPhone del mismo cliente sigue ahí.
    expect(await store.pushTokens({ seriales: [cliente.serial], passType: "pass.x" })).toEqual(["aa11"]);
  });

  it("los tokens de Apple y los del navegador no se mezclan", async () => {
    const { cliente } = await clienteConAvisos();
    expect(await store.pushTokens({ seriales: [cliente.serial], passType: "pass.x" })).toEqual(["aa11"]);
    expect(await store.pushTokens({ seriales: [cliente.serial], passType: "web" })).toEqual(['{"endpoint":"https://fcm.googleapis.com/x"}']);
    expect((await store.serialesRegistrados("nube")).has(cliente.serial)).toBe(true);
  });
});

it("la app trae La Delicantería y los tests sus tres tiendas de prueba", () => {
  expect(Object.keys(SEMILLAS)).toEqual(["delicanteria", "nube", "fade", "forno"]);
});

describe("/api/imagen solo dibuja URLs canónicas", () => {
  it("las variantes redirigen a la canónica; la canónica es un PNG inmutable", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("DATA_DIR", mkdtempSync(path.join(tmpdir(), "sellos-img-")));
    await import("./tiendasDePrueba.js");
    const { GET } = await import("@/app/api/imagen/[tipo]/route.js");
    const pedir = (ruta) => GET(new Request(`http://x${ruta}`), { params: Promise.resolve({ tipo: ruta.split("/")[3].split("?")[0] }) });

    const buena = rutaBanda(nube, { sellos: 3 });
    const r = await pedir(buena);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toMatch(/immutable/);

    // Sellos fuera de la cartilla, lados raros o huellas viejas no se dibujan: redirigen.
    const fuera = await pedir(`/api/imagen/banda?b=nube&s=999&v=vieja`);
    expect(fuera.status).toBe(308);
    expect(new URL(fuera.headers.get("location")).search).toBe(new URL(`http://x${rutaBanda(nube, { sellos: 8 })}`).search);
    const lado = await pedir(`/api/imagen/icono?b=nube&t=191&v=${versionDe(nube)}`);
    expect(new URL(lado.headers.get("location")).searchParams.get("t")).toBe("192");

    expect((await pedir("/api/imagen/otra?b=nube")).status).toBe(404);
    expect((await pedir("/api/imagen/logo?b=no-existe")).status).toBe(404);
  });
});
