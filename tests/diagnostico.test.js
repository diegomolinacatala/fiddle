import { describe, it, expect, afterEach, vi } from "vitest";
import { diagnosticoApple, diagnosticoSupabase, explicarErrorSupabase, diagnosticoCifrado } from "@/lib/diagnostico";
import { cadenaDePrueba, otroPassTypeDePrueba, generarClave } from "../scripts/lib/certs.mjs";

afterEach(() => vi.unstubAllEnvs());

const cadena = cadenaDePrueba({ passTypeId: "pass.com.prueba", teamId: "TEAM000001" });
const config = (extra = {}) => ({
  passTypeId: "pass.com.prueba", teamId: "TEAM000001",
  cert: cadena.certPem, key: cadena.keyPem, wwdr: cadena.wwdrPem, ...extra,
});

describe("diagnosticoApple", () => {
  it("todo correcto: datos del certificado sin secretos", () => {
    const d = diagnosticoApple(config());
    expect(d).toMatchObject({ ok: true, problemas: [], passTypeId: "pass.com.prueba", teamId: "TEAM000001" });
    expect(d.caduca).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(d)).not.toContain("PRIVATE KEY");
  });

  it("detecta clave de otro certificado, IDs cambiados y WWDR equivocado", () => {
    const otra = cadenaDePrueba();
    const d = diagnosticoApple(config({ key: generarClave().keyPem, passTypeId: "pass.otro", teamId: "X", wwdr: otra.wwdrPem }));
    expect(d.ok).toBe(false);
    expect(d.problemas.join(" | ")).toMatch(/APPLE_PASS_KEY no corresponde/);
    expect(d.problemas.join(" | ")).toMatch(/APPLE_PASS_TYPE_ID \(pass.otro\) no coincide/);
    expect(d.problemas.join(" | ")).toMatch(/APPLE_TEAM_ID/);
    expect(d.problemas.join(" | ")).toMatch(/APPLE_WWDR_CERT/);
  });

  it("valores cortados al pegar", () => {
    expect(diagnosticoApple(config({ cert: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----" })).problemas[0]).toMatch(/APPLE_PASS_CERT/);
    expect(diagnosticoApple(config({ key: "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----" })).problemas[0]).toMatch(/APPLE_PASS_KEY no es una clave/);
    expect(diagnosticoApple(config({ wwdr: "basura" })).problemas[0]).toMatch(/APPLE_WWDR_CERT/);
  });

  it("caducado y a punto de caducar", () => {
    const d = diagnosticoApple(config());
    const caduca = Date.parse(`${d.caduca}T23:59:59Z`);
    expect(diagnosticoApple(config(), caduca + 2 * 86_400_000).problemas.join()).toMatch(/caducó/);
    const pronto = diagnosticoApple(config(), caduca - 10 * 86_400_000);
    expect(pronto.ok).toBe(true);
    expect(pronto.avisos[0]).toMatch(/caduca en \d+ días/);
  });

  it("Pass Type ID propio: lo dice y nombra SUS variables", () => {
    const propio = otroPassTypeDePrueba(cadena, "pass.com.deli");
    const bien = diagnosticoApple(config({ passTypeId: "pass.com.deli", cert: propio.certPem, tienda: "la-deli" }));
    expect(bien).toMatchObject({ ok: true, propio: true, passTypeId: "pass.com.deli" });
    expect(diagnosticoApple(config()).propio).toBe(false);

    const mal = diagnosticoApple(config({ passTypeId: "pass.com.deli", cert: propio.certPem, key: generarClave().keyPem, tienda: "la-deli" }));
    expect(mal.problemas.join(" | ")).toMatch(/APPLE_PASS_CERT_LA_DELI no se pidió con APPLE_PASS_KEY/);
  });

  it("Pass Type ID propio a medias: avisa de que va al compartido", () => {
    vi.stubEnv("APPLE_PASS_TYPE_ID_LA_DELI", "pass.com.deli");
    vi.stubEnv("APPLE_PASS_CERT_LA_DELI", "");
    const d = diagnosticoApple(config(), Date.now(), "la-deli");
    expect(d.ok).toBe(false);
    expect(d.problemas[0]).toMatch(/Falta APPLE_PASS_CERT_LA_DELI/);
  });

  it("sin configuración lista lo que falta", () => {
    vi.stubEnv("APPLE_PASS_TYPE_ID", "");
    expect(diagnosticoApple(null).problemas[0]).toMatch(/Faltan variables: .*APPLE_PASS_TYPE_ID/);
  });
});

describe("diagnosticoSupabase", () => {
  it("sin variables no es válido en Vercel", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(await diagnosticoSupabase()).toMatchObject({ ok: false, detalle: expect.stringMatching(/ficheros locales/) });
  });

  it("traduce los fallos típicos", async () => {
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "k");
    expect(await diagnosticoSupabase(async () => ({ ok: true }))).toEqual({ ok: true, detalle: "Supabase conectado · 6 tablas" });
    expect((await diagnosticoSupabase(async () => ({ ok: false, tabla: "registros", error: 'relation "public.registros" does not exist' }))).detalle)
      .toMatch(/Falta la tabla "registros".*schema\.sql/);
    expect((await diagnosticoSupabase(async () => { throw new Error("fetch failed"); })).detalle).toMatch(/SUPABASE_URL/);
  });

  it("explicarErrorSupabase", () => {
    expect(explicarErrorSupabase("Invalid API key", "negocios")).toMatch(/SUPABASE_SERVICE_KEY/);
    expect(explicarErrorSupabase("Could not find the table 'public.intentos' in the schema cache", "intentos")).toMatch(/Falta la tabla "intentos"/);
    expect(explicarErrorSupabase("permission denied for table clientes", "clientes")).toMatch(/Permiso denegado/);
    expect(explicarErrorSupabase("algo raro", "eventos")).toMatch(/Error de Supabase en "eventos": algo raro/);
  });
});

describe("diagnosticoCifrado", () => {
  const CLAVE = Buffer.alloc(32, 1).toString("base64");

  it("sin clave: falla y dice qué falta, sin mirar la base", async () => {
    vi.stubEnv("CIFRADO_CLAVE", "");
    const contar = vi.fn();
    expect(await diagnosticoCifrado({ contar })).toMatchObject({ ok: false, pendientes: null, detalle: expect.stringMatching(/CIFRADO_CLAVE/) });
    expect(contar).not.toHaveBeenCalled();
  });

  it("clave mal formada: falla", async () => {
    vi.stubEnv("CIFRADO_CLAVE", "corta");
    expect(await diagnosticoCifrado({ contar: async () => 0 })).toMatchObject({ ok: false, detalle: expect.stringMatching(/32 bytes/) });
  });

  it("clave bien pero quedan datos de antes: falla y dice cuántos", async () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    expect(await diagnosticoCifrado({ contar: async () => 3 })).toMatchObject({ ok: false, pendientes: 3, detalle: expect.stringMatching(/3 clientes/) });
  });

  it("todo cifrado: bien", async () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    expect(await diagnosticoCifrado({ contar: async () => 0 })).toMatchObject({ ok: true, pendientes: 0 });
  });

  it("si la base no responde, lo dice sin romper", async () => {
    vi.stubEnv("CIFRADO_CLAVE", CLAVE);
    const r = await diagnosticoCifrado({ contar: async () => { throw new Error("caída"); } });
    expect(r).toMatchObject({ ok: false, pendientes: null, detalle: expect.stringMatching(/caída/) });
  });
});
