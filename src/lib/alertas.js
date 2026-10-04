import { contarIntentosPorPrefijo, ultimoIntento, registrarIntento, hasSupabase } from "./store";
import { diagnosticoSupabase } from "./diagnostico";

// ============================================================================
// ALERTAS (docs/RGPD.md, 8.1)
// ----------------------------------------------------------------------------
// Los límites (lib/limitador.js) frenan, pero nadie se entera. En cada pasada
// del reloj se mira si hay un pico de contraseñas falladas o si la base no
// responde y, si pasa, se avisa a un webhook: `ALERTAS_URL` (ntfy, Slack o
// Discord; no hay proveedor de correo). Sin la variable, no se avisa a nadie.
//
// Una alerta del mismo tipo como mucho cada hora: la marca vive en `intentos`.
// Las alertas no llevan datos personales: cuántos, cuándo, de qué tienda.
// ============================================================================

export const UMBRALES_ALERTA = {
  ventanaMin: 15,
  // Cada fallo de login apunta dos filas (por IP y por tienda): son fallos, no filas.
  loginFallidos: 30,
  repetirMin: 60,
};

const MIN = 60 * 1000;

/** El cuerpo que entiende cada servicio. ntfy: texto tal cual. */
export function cuerpoDeAlerta(url, texto) {
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  if (host.endsWith("slack.com")) return { tipo: "application/json", cuerpo: JSON.stringify({ text: texto }) };
  if (host.endsWith("discord.com") || host.endsWith("discordapp.com")) return { tipo: "application/json", cuerpo: JSON.stringify({ content: texto }) };
  return { tipo: "text/plain; charset=utf-8", cuerpo: texto };
}

async function avisar(tipo, texto, { ahora, f }) {
  const url = process.env.ALERTAS_URL?.trim();
  if (!url) return false;
  const clave = `alerta:${tipo}`;
  const ultima = await ultimoIntento(clave).catch(() => null);
  if (ultima && ahora - Date.parse(ultima) < UMBRALES_ALERTA.repetirMin * MIN) return false;
  const { tipo: contentType, cuerpo } = cuerpoDeAlerta(url, `[fiddle] ${texto}`);
  const res = await f(url, { method: "POST", headers: { "content-type": contentType }, body: cuerpo, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`El webhook de alertas respondió ${res.status}`);
  await registrarIntento(clave).catch(() => {});
  return true;
}

/**
 * Una pasada: mira y, si hace falta, avisa. Nunca lanza.
 * @returns {Promise<{enviadas:string[], loginFallidos:number|null, baseDatos:boolean}>}
 */
export async function vigilar({ ahora = Date.now(), fetch: f = fetch, diagnostico = diagnosticoSupabase } = {}) {
  const r = { enviadas: [], loginFallidos: null, baseDatos: true };
  const intentar = async (tipo, texto) => {
    try {
      if (await avisar(tipo, texto, { ahora, f })) r.enviadas.push(tipo);
    } catch (e) {
      console.error(`[alertas] no se pudo avisar de ${tipo}:`, e);
    }
  };

  // Sin Supabase (la demo en ficheros) no hay base que vigilar.
  const base = hasSupabase()
    ? await diagnostico().catch((e) => ({ ok: false, detalle: String(e?.message || e) }))
    : { ok: true };
  r.baseDatos = Boolean(base.ok);
  if (!base.ok) await intentar("base", `La base de datos no responde bien: ${base.detalle || "sin detalle"}. Mira /api/salud.`);

  if (base.ok) {
    const filas = await contarIntentosPorPrefijo("login:", ahora - UMBRALES_ALERTA.ventanaMin * MIN).catch(() => null);
    r.loginFallidos = filas === null ? null : Math.floor(filas / 2);
    if (r.loginFallidos !== null && r.loginFallidos >= UMBRALES_ALERTA.loginFallidos) {
      await intentar("login", `${r.loginFallidos} contraseñas falladas en ${UMBRALES_ALERTA.ventanaMin} minutos. Puede ser alguien probando claves.`);
    }
  }
  return r;
}
