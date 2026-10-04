// ============================================================================
// «TODO LISTO»: LA PÁGINA QUE QUEDA DETRÁS DE LA CARTERA
// ----------------------------------------------------------------------------
// En iPhone el .pkpass no se abre a pelo sino desde /p/<serial>/listo: Safari
// pone la hoja de la Cartera encima de la página que lo pidió y, al cerrarla,
// queda esa página. A pelo era una pestaña en blanco y nadie sabía si había
// terminado; así dice «Todo listo» y se puede cerrar.
//
// Pero solo DESPUÉS de que salga la hoja: si lo dijera mientras se firma el pase,
// alguno cerraría antes de tiempo y se quedaría sin tarjeta. La página no ve la
// hoja, así que mira dos señales:
//   - la respuesta del .pkpass (con `?listo=1`) deja una cookie corta que solo ve
//     esa página: si está, el pase ya ha llegado al teléfono;
//   - la página pierde el foco o se oculta: algo se le ha puesto encima.
// Si no llega ninguna, enseña el botón oficial. Nunca «listo» a ciegas.
// ============================================================================

export const COOKIE_ABIERTO = "pase_abierto";

/** La página que abre el pase en iPhone y luego dice «Todo listo». */
export const rutaListo = (serial) => `/p/${serial}/listo`;

/** El .pkpass, avisando a esa página cuando llegue. */
export const pkpassConAviso = (serial) => `/api/pase/${serial}?listo=1`;

/** Set-Cookie del aviso: un minuto basta, la página la lee al momento y la borra. */
export const cookieAbierto = (serial, segura) =>
  `${COOKIE_ABIERTO}=1; Path=${rutaListo(serial)}; Max-Age=60; SameSite=Lax${segura ? "; Secure" : ""}`;
