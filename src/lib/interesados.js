// ============================================================================
// QUIEN DEJA SU CONTACTO EN «DISEÑA TU TARJETA»
// ----------------------------------------------------------------------------
// Un email o un teléfono, sin verificar: es alguien que dice que le interesa, no
// una cuenta. Pura y sin nada del servidor: lo mira la pantalla al escribir y el
// servidor al guardar (/api/interesados). Se guarda cifrado y sale en /admin.
// ============================================================================

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^\+?[\d\s().-]+$/;
const MAX_CONTACTO = 120;

/**
 * Lo escrito, si parece un email o un teléfono.
 * @returns {{ valor: string, tipo: "email" | "telefono" } | null}
 */
export function leerContacto(texto) {
  if (typeof texto !== "string") return null;
  const valor = texto.trim();
  if (!valor || valor.length > MAX_CONTACTO) return null;
  if (EMAIL.test(valor)) return { valor, tipo: "email" };
  const cifras = valor.replace(/\D/g, "").length;
  if (TELEFONO.test(valor) && cifras >= 9 && cifras <= 15) return { valor, tipo: "telefono" };
  return null;
}
