// ============================================================================
// LA TARJETA DE LA TIENDA EN LOS PRIMEROS PASOS
// ----------------------------------------------------------------------------
// Lo que pinta la escena (home/tarjeta/Escena.js, prop `armar`) cuando la tarjeta
// es la de la tienda de verdad y no la de la demo: su negocio, con lo que se esté
// probando encima, y un cliente de ejemplo a medias. Las mismas piezas que la
// vista previa de Tienda (PanelManager): lo que se ve es lo que saldrá en el pase.
// Puro y sin nada del servidor.
// ============================================================================

/** Un cliente de ejemplo con la cartilla (o las dos) a medias. */
export function clienteDeEjemplo(n) {
  const aMedias = (meta) => Math.max(1, Math.round((meta || 1) * 0.6));
  return {
    serial: "ejemplo-0000-0000-0000-000000000000",
    codigo: "ABC",
    nombre: "Cliente",
    sellos: aMedias(n?.cartillas?.[0]?.meta ?? n?.meta),
    sellos2: n?.cartillas?.[1] ? Math.max(0, aMedias(n.cartillas[1].meta) - 1) : 0,
    premios: 0,
  };
}

/**
 * La función `armar` de la escena para la tienda `n`.
 * @param {object} n  el negocio (negocioDelPersonal), ya con lo que se esté probando
 * @param {{ estado?: {abierta:boolean, texto:string}|null }} [extra]  la línea «Abierto hasta…»
 * @returns {(eleccion: object, opts: { puntos?: number, promo?: string|null }) => { negocio, cliente, estado }}
 *   `eleccion` no se usa aquí: es la llave con la que la escena funde una capa en otra.
 */
export function armarTienda(n, { estado = null } = {}) {
  return (_eleccion, { promo = null } = {}) => ({
    negocio: promo ? { ...n, promo } : n,
    cliente: clienteDeEjemplo(n),
    estado,
  });
}
