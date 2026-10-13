// ============================================================================
// LO QUE VE EL CLIENTE DE SU TARJETA
// ----------------------------------------------------------------------------
// La página del pase (/p/<serial>) es pública: basta el enlace. Así que lo que
// viaja al navegador del cliente se elige campo a campo, nunca "el objeto
// entero". Fuera quedan la nota interna de la tienda ("el del perro"), el
// historial del CRM, el token del pase, y del negocio el brief y los
// comentarios del admin.
// ============================================================================

/**
 * Sin el NOMBRE: la tarjeta web no lo enseña (como el pase) y esta página y
 * /api/tarjeta/<serial> se abren con el serial, que va en el QR. Una foto del QR
 * no puede decir de quién es. `promos_no` va como sí/no: la tarjeta web, como el
 * pase, no enseña la promo a quien dijo que no.
 * @returns {{serial:string, codigo:string, sellos:number, sellos2:number, premios:number, guardados:number, guardados2:number, mensaje:string|null, promos_no:true|null}|null}
 */
export const clienteDeTarjeta = (c) =>
  c && {
    serial: c.serial,
    codigo: c.codigo,
    sellos: c.sellos ?? 0,
    sellos2: c.sellos2 ?? 0,
    premios: c.premios ?? 0,
    guardados: c.guardados ?? 0,
    guardados2: c.guardados2 ?? 0,
    mensaje: c.mensaje ?? null,
    promos_no: c.promos_no ? true : null,
  };

/**
 * Lo del negocio que hace falta para pintar la tarjeta y nada más. El horario
 * va para decir "Abierto hasta las 18:30" (app/AbiertoAhora.js); los avisos
 * automáticos, que viven al lado, no.
 */
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
    horario: n.horario ?? null,
    // Público a propósito: es lo que la tienda pone en el reverso para que la llamen.
    contacto: n.contacto ?? null,
  };

/**
 * El negocio para el PERSONAL (caja y manager): todo menos lo que es del admin,
 * el brief para Claude y sus comentarios sobre el pase. La caja vive en un móvil
 * de la tienda; lo que se escribe pensando en Claude no tiene por qué ir ahí.
 * Tampoco la plantilla entera (con las bajas y sus fechas): la caja recibe solo
 * los nombres que puede elegir por /api/plantilla/quien, y el manager la ve en
 * su pestaña (lib/plantillaDatos.js).
 */
export const negocioDelPersonal = (n) => {
  if (!n) return n;
  const { brief: _brief, notas: _notas, plantilla: _plantilla, ...resto } = n;
  return resto;
};
