// ============================================================================
// LO QUE VE EL CLIENTE DE SU TARJETA
// ----------------------------------------------------------------------------
// La página del pase (/p/<serial>) es pública: basta el enlace. Así que lo que
// viaja al navegador del cliente se elige campo a campo, nunca "el objeto
// entero". Fuera quedan la nota interna de la tienda ("el del perro"), el
// historial del CRM, el token del pase, y del negocio el brief y los
// comentarios del admin.
// ============================================================================

/** @returns {{serial:string, codigo:string, sellos:number, sellos2:number, premios:number, guardados:number, guardados2:number, nombre:string|null, mensaje:string|null}|null} */
export const clienteDeTarjeta = (c) =>
  c && {
    serial: c.serial,
    codigo: c.codigo,
    sellos: c.sellos ?? 0,
    sellos2: c.sellos2 ?? 0,
    premios: c.premios ?? 0,
    guardados: c.guardados ?? 0,
    guardados2: c.guardados2 ?? 0,
    nombre: c.nombre ?? null,
    mensaje: c.mensaje ?? null,
  };

/** Lo del negocio que hace falta para pintar la tarjeta y nada más. */
export const negocioDeTarjeta = (n) =>
  n && {
    slug: n.slug,
    nombre: n.nombre,
    tipo: n.tipo,
    meta: n.meta,
    premio: n.premio,
    cartillas: n.cartillas ?? null,
    promo: n.promo ?? null,
    tema: n.tema,
  };
