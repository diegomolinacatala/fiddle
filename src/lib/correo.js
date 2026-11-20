// ============================================================================
// MANDAR UN CORREO (Resend)
// ----------------------------------------------------------------------------
// El primer correo que manda la app sola: el de la lista de espera
// (lib/listaDeEspera.js). Va por Resend con su API (un fetch, sin librería) y
// solo si están las dos variables:
//   RESEND_API_KEY   la clave de la cuenta de Resend
//   CORREO_DESDE     quién lo manda, con el dominio verificado en Resend
//                    (p. ej. «fiddle <hola@fiddle.es>»)
// Sin ellas no se manda nada y quien llama lo sabe (`hayCorreo`): lo pendiente se
// queda esperando hasta que estén, nunca se da por mandado.
//
// Nunca lanza hacia fuera: un correo que falla no puede tumbar lo que lo pidió.
// ============================================================================

const API = "https://api.resend.com/emails";
const ESPERA_MS = 10_000;

/** ¿Se pueden mandar correos? */
export const hayCorreo = () => Boolean(process.env.RESEND_API_KEY && process.env.CORREO_DESDE);

/**
 * Manda uno. `texto` siempre; `html` si se quiere algo más que texto.
 * `permanente`: Resend lo rechazó por la dirección en sí: reintentarlo no
 * servirá. Un 429, un 5xx o un fallo de red, sí.
 * @param {{para:string, asunto:string, texto:string, html?:string}} correo
 * @returns {Promise<{ok:boolean, permanente?:boolean}>}
 */
export async function mandarCorreo({ para, asunto, texto, html }) {
  if (!hayCorreo()) return { ok: false };
  if (!para) return { ok: false, permanente: true };
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.CORREO_DESDE, to: [para], subject: asunto, text: texto, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (r.ok) return { ok: true };
    // Solo el estado: el cuerpo del error de Resend puede citar la dirección, y en
    // el registro no van datos personales.
    console.error(`[correo] Resend respondió ${r.status}`);
    // Permanente solo lo que es culpa de la dirección (400, 422 de validación). Un
    // 401 o 403 es NUESTRA configuración (clave, dominio sin verificar): borrar a la
    // gente por eso sería perderla entera.
    return { ok: false, permanente: r.status === 400 || r.status === 422 };
  } catch (e) {
    console.error("[correo] no se pudo mandar:", e?.name || "error");
    return { ok: false };
  }
}
