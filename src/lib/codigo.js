// ============================================================================
// CÓDIGO CORTO DEL PASE
// ----------------------------------------------------------------------------
// Además del serial (un uuid larguísimo), cada pase tiene una clave de 3
// caracteres: "K7M". Sirve para decirla en voz alta, teclearla en la caja o
// leerla en la lista del manager.
//
// Es única DENTRO DE SU NEGOCIO, no en toda la plataforma: Nube y Fade pueden
// tener cada uno un "K7M" y son clientes distintos. La caja y el manager solo
// buscan dentro de su propio negocio, así que nunca hay ambigüedad.
//
// El alfabeto se salta los caracteres que se confunden al dictar (0/O, 1/I/L,
// 5/S, 8/B): 29 símbolos -> 24.389 combinaciones por negocio.
// ============================================================================

export const ALFABETO = "23456789ACDEFGHJKMNPQRTUVWXYZ";
export const LARGO = 3;

/** Lo que teclea alguien -> código válido, o null. "  k7m " -> "K7M" */
export function normalizarCodigo(texto) {
  const limpio = [...String(texto ?? "").toUpperCase()].filter((c) => ALFABETO.includes(c)).join("");
  return limpio.length === LARGO ? limpio : null;
}

function desdeNumero(n) {
  let out = "";
  for (let i = 0; i < LARGO; i++) {
    out = ALFABETO[n % ALFABETO.length] + out;
    n = Math.floor(n / ALFABETO.length);
  }
  return out;
}

/** Código estable a partir del serial (FNV-1a). El mismo serial da el mismo código. */
export function codigoDesdeSerial(serial) {
  const s = String(serial ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return desdeNumero(h >>> 0);
}

export function codigoAleatorio() {
  return Array.from({ length: LARGO }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");
}

/**
 * Código libre para un cliente nuevo de ese negocio. Prueba primero el que sale
 * de su serial (así es estable) y, si ya está cogido en ESE negocio, tira de
 * aleatorios.
 * @param {Set<string>|string[]} usados códigos que ya existen en el negocio
 * @param {string} serial
 */
export function codigoLibre(usados, serial) {
  const cogido = (c) => (usados instanceof Set ? usados.has(c) : Array.from(usados || []).includes(c));
  const preferido = codigoDesdeSerial(serial);
  if (!cogido(preferido)) return preferido;
  for (let i = 0; i < 200; i++) {
    const c = codigoAleatorio();
    if (!cogido(c)) return c;
  }
  return preferido; // negocio con miles de pases: mejor repetir que no emitir
}
