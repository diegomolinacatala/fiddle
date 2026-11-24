import { createHmac, randomBytes, randomInt } from "node:crypto";
import { firmarTexto, verificarTexto, secretoSesion } from "./auth";
import { mandarCorreo, hayCorreo } from "./correo";
import { registrarIntento, contarIntentos } from "./store";
import { leerEmail } from "./interesados";

// ============================================================================
// CÓDIGOS POR CORREO (verificar que un correo es de quien lo escribe)
// ----------------------------------------------------------------------------
// El dueño pone su correo, le llega un código de 6 cifras por Resend
// (lib/correo.js) y lo escribe. Lo usan la invitación (el correo pasa a ser con
// lo que entra, lib/invitaciones.js) y «He olvidado mi contraseña»
// (/api/recuperar).
//
// Sin tabla: lo que vuelve al navegador es un RETO firmado con el secreto de las
// sesiones que lleva el correo, para qué es y la huella del código (HMAC con ese
// mismo secreto: con el reto en la mano no se puede probar el millón de códigos
// sin preguntar al servidor). Al servidor se le pregunta con el límite de
// `intentos`: MAX_FALLOS por reto, y luego hay que pedir otro (otro correo).
//
// Un reto vale para UN propósito (`inv:<huella>` o `recuperar`): el código de
// una invitación no sirve en otra. Dentro de sus minutos se puede volver a usar
// (si la contraseña no valía, se arregla sin pedir otro código): quien lo tiene
// ya tiene el correo.
//
// Sin Resend (local, la web de dev) no se manda nada: el código es CODIGO_PRUEBAS
// y queda en el log. En producción sin Resend, no hay código: falla y se dice.
// ============================================================================

export const MINUTOS_CODIGO = 15;
export const MAX_FALLOS = 5;
export const CIFRAS = 6;
export const CODIGO_PRUEBAS = "123456";

// En local (sin NODE_ENV de producción) o en la web de dev (Vercel «preview», que corre
// como producción pero sin Resend ni base). Nunca en la de producción.
export const esPruebas = () =>
  !hayCorreo() && process.env.VERCEL_ENV !== "production"
  && (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview");

const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64url");
const deB64 = (t) => Buffer.from(String(t), "base64url").toString("utf8");

function huellaCodigo(nonce, proposito, email, codigo) {
  const secreto = secretoSesion();
  if (!secreto) throw new Error("Falta AUTH_SECRET");
  return createHmac("sha256", secreto).update(`codigo|${nonce}|${proposito}|${email}|${codigo}`).digest("base64url");
}

/** El código escrito, limpio: solo las cifras («123 456» y «123-456» valen). */
export const limpiarCodigo = (texto) => String(texto ?? "").replace(/\D/g, "");

/**
 * Crea el código de un correo y su reto. No lo manda: eso es `mandarCodigo`.
 * @returns {Promise<{reto:string, codigo:string}>}
 */
export async function nuevoCodigo(email, proposito, ahora = Date.now()) {
  const correo = leerEmail(email)?.toLowerCase();
  if (!correo) throw new Error("Correo no válido");
  const codigo = esPruebas() ? CODIGO_PRUEBAS : String(randomInt(10 ** CIFRAS)).padStart(CIFRAS, "0");
  const nonce = randomBytes(12).toString("base64url");
  const texto = `codigo.${nonce}.${b64(proposito)}.${b64(correo)}.${huellaCodigo(nonce, proposito, correo, codigo)}`;
  return { reto: await firmarTexto(texto, ahora + MINUTOS_CODIGO * 60 * 1000), codigo };
}

/**
 * Lo manda por correo. `para`: de qué es («La Delicantería»), sale en el asunto.
 * @returns {Promise<boolean>} si salió (o, en pruebas, si quedó en el log)
 */
export async function mandarCodigo(email, codigo, { para } = {}) {
  if (esPruebas()) {
    console.info(`[codigos] sin Resend: el código de pruebas es ${CODIGO_PRUEBAS}`);
    return true;
  }
  const de = para ? ` para ${para}` : "";
  const r = await mandarCorreo({
    para: email,
    asunto: `${codigo} es tu código de fiddle`,
    texto: [
      `Tu código${de} es:`,
      "",
      `    ${codigo}`,
      "",
      `Escríbelo en la pantalla donde lo pediste. Vale ${MINUTOS_CODIGO} minutos.`,
      "Si no lo has pedido tú, no hagas nada: sin el código nadie puede usar tu correo.",
      "",
      "fiddle",
    ].join("\n"),
    html: htmlCodigo(codigo, de),
  });
  return r.ok;
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function htmlCodigo(codigo, de) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1d1d1f">
<p style="font-size:15px;margin:0 0 12px">Tu código${escapar(de)} es:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:0.18em;margin:0 0 16px;font-family:ui-monospace,Menlo,monospace">${escapar(codigo)}</p>
<p style="font-size:14px;color:#555;margin:0 0 8px">Escríbelo en la pantalla donde lo pediste. Vale ${MINUTOS_CODIGO} minutos.</p>
<p style="font-size:13px;color:#888;margin:0">Si no lo has pedido tú, no hagas nada: sin el código nadie puede usar tu correo.</p>
</div>`;
}

/**
 * ¿Es ese el código del reto? Cuenta los fallos del reto en `intentos`.
 * @returns {Promise<{ok:true, email:string} | {ok:false, codigo:"caducado"|"mal"|"agotado", motivo:string}>}
 */
export async function comprobarCodigo(reto, codigo, proposito, ahora = Date.now()) {
  const texto = await verificarTexto(String(reto ?? ""), ahora);
  const partes = texto?.split(".");
  if (!partes || partes.length !== 5 || partes[0] !== "codigo" || deB64(partes[2]) !== proposito) {
    return { ok: false, codigo: "caducado", motivo: "El código ha caducado. Pide otro." };
  }
  const [, nonce, , correoB64, huella] = partes;
  const email = deB64(correoB64);
  const clave = `codigo:${nonce}`;
  if ((await contarIntentos(clave, ahora - MINUTOS_CODIGO * 60 * 1000)) >= MAX_FALLOS) {
    return { ok: false, codigo: "agotado", motivo: "Demasiados intentos con este código. Pide otro." };
  }
  const limpio = limpiarCodigo(codigo);
  if (limpio.length === CIFRAS && huellaCodigo(nonce, proposito, email, limpio) === huella) return { ok: true, email };
  await registrarIntento(clave);
  return { ok: false, codigo: "mal", motivo: "Ese código no es. Míralo otra vez en el correo." };
}

/** El correo al que va un reto (para decir «te lo hemos mandado a…»), sin comprobar nada más que la firma. */
export async function emailDeReto(reto, ahora = Date.now()) {
  const partes = (await verificarTexto(String(reto ?? ""), ahora))?.split(".");
  return partes?.length === 5 ? deB64(partes[3]) : null;
}
