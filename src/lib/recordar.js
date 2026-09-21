// ============================================================================
// RECORDAR LA TARJETA DE ESTE TELÉFONO
// ----------------------------------------------------------------------------
// El tap del tag deja una cookie con el serial de la tarjeta que se llevó este
// teléfono en esa tienda. Con ella:
//   - volver a tocar el tag devuelve la MISMA tarjeta, no una nueva con los
//     sellos a cero (era el fallo número uno en una cafetería de verdad);
//   - la página de la tienda ofrece "Abrir mi tarjeta" a quien ya la tiene.
//
// Una cookie por tienda: el mismo teléfono puede tener la de Nube y la de Fade.
// Si se borra, no se pierde nada: la tarjeta sigue existiendo, solo que el
// siguiente tap emite otra.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UN_ANO = 60 * 60 * 24 * 365;

/** Nombre de la cookie de una tienda: `tarjeta_nube`. */
export const cookieDeTarjeta = (slug) => `tarjeta_${slug}`;

/** Serial guardado en la cookie, si tiene pinta de serial; si no, null. */
export const serialRecordado = (valor) => (typeof valor === "string" && UUID.test(valor) ? valor : null);

export const opcionesCookieTarjeta = (segura) => ({
  httpOnly: true, // solo la leen el servidor y el tap: nada que robar desde un script
  sameSite: "lax", // tiene que viajar al abrir el enlace del tag desde fuera
  secure: segura,
  path: "/",
  maxAge: UN_ANO,
});
