// ============================================================================
// QUIEN DEJA SU CONTACTO EN «DISEÑA TU TARJETA»
// ----------------------------------------------------------------------------
// Un email, un teléfono o los dos, sin verificar: es alguien que dice que le
// interesa, no una cuenta. Con uno basta. Pura y sin nada del servidor: lo mira la
// pantalla al enviar y el servidor al guardar (/api/interesados). Se guarda cifrado
// y sale en /admin.
// ============================================================================

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^\+?[\d\s().-]+$/;
export const MAX_CONTACTO = 120;

const limpio = (texto) => (typeof texto === "string" ? texto.trim() : "");

/** El email escrito, si lo parece. */
export function leerEmail(texto) {
  const valor = limpio(texto);
  return valor && valor.length <= MAX_CONTACTO && EMAIL.test(valor) ? valor : null;
}

/** El teléfono escrito, si lo parece (de 9 a 15 cifras, con o sin prefijo). */
export function leerTelefono(texto) {
  const valor = limpio(texto);
  if (!valor || valor.length > MAX_CONTACTO || !TELEFONO.test(valor)) return null;
  const cifras = valor.replace(/\D/g, "").length;
  return cifras >= 9 && cifras <= 15 ? valor : null;
}

/**
 * Los dos campos del final. Con uno bien basta, pero uno escrito y mal es un error
 * aunque el otro valga: guardar solo el bueno perdería el que creía haber dejado.
 * @returns {{ email: string|null, telefono: string|null, errores: null }
 *   | { email: null, telefono: null, errores: { email?: string, telefono?: string, ninguno?: string } }}
 */
export function leerContactos({ email, telefono } = {}) {
  const e = limpio(email);
  const t = limpio(telefono);
  if (!e && !t) return { email: null, telefono: null, errores: { ninguno: "Déjanos un email o un teléfono" } };
  const errores = {};
  const okEmail = e ? leerEmail(e) : null;
  const okTelefono = t ? leerTelefono(t) : null;
  if (e && !okEmail) errores.email = "Revisa el email";
  if (t && !okTelefono) errores.telefono = "Revisa el teléfono: de 9 a 15 cifras";
  if (Object.keys(errores).length) return { email: null, telefono: null, errores };
  return { email: okEmail, telefono: okTelefono, errores: null };
}
