// ============================================================================
// EL TOKEN DEL ENLACE DE INVITACIÓN, VISTO DESDE EL NAVEGADOR
// ----------------------------------------------------------------------------
// Sin nada del servidor: lo importan la página /invitacion y lib/invitaciones.js,
// para que los dos entiendan lo mismo por «token». Es lo que va tras `#` en
// `/invitacion#<token>`: 32 bytes en base64url, 43 caracteres.
//
// El enlace llega por correo y a veces llega tocado: un cliente que recorta el
// `#…`, una vista previa que lo reescribe, alguien que copia «hasta donde se
// ve» o pega el correo entero. Por eso el token se busca dentro de lo que
// llegue, no se exige exacto. Y por eso la página lo guarda en la pestaña
// (sessionStorage): recargar o volver atrás ya no lo pierde.
// ============================================================================

export const LARGO_TOKEN = 43;
export const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Dónde lo guarda la pestaña mientras el dueño elige sus contraseñas. */
export const CLAVE_GUARDADO = "invitacion";

/**
 * El token que hay en un texto: un hash (`#abc…`), el enlace entero, el código
 * suelto o el correo pegado. Si hay `#`, se mira lo que va detrás del último;
 * si no, cualquier trozo con la forma exacta. null si no hay ninguno.
 */
export function tokenDeTexto(texto) {
  const t = String(texto ?? "");
  const candidatos = t.includes("#") ? [t.slice(t.lastIndexOf("#") + 1), t] : [t];
  for (const c of candidatos) {
    const trozo = c.split(/[^A-Za-z0-9_-]+/).find((p) => TOKEN.test(p));
    if (trozo) return trozo;
  }
  return null;
}

/**
 * Con qué token abrir la página: el de la barra de direcciones si lo lleva; si no,
 * el que la pestaña guardó al abrirlo la primera vez. null si no hay ninguno.
 */
export function tokenAlAbrir(hash, guardado) {
  return tokenDeTexto(hash) ?? tokenDeTexto(guardado);
}
