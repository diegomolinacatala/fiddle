// ============================================================================
// LA WEB GUARDADA EN EL MÓVIL ES FIDDLE
// ----------------------------------------------------------------------------
// Al añadir la web a la pantalla de inicio (la caja, el panel del dueño o la
// tarjeta web del cliente) sale el violín y pone «fiddle», no la tienda: así se
// sabe de quién son las tarjetas y se habla de ellas. Dentro, cada pantalla sigue
// con los colores y el logo de su tienda.
//
// Las imágenes salen de scripts/gen-marca-web.mjs y van en public/marcas/, que
// no pasa por el middleware.
// ============================================================================

export const NOMBRE_APP = "fiddle";

// Los móviles y WhatsApp guardan las imágenes por URL: al cambiar el dibujo, se
// sube la versión.
const VERSION = "verde";

/** URL de una imagen de la marca, con su versión. */
export const rutaMarca = (archivo) => `/marcas/${archivo}?v=${VERSION}`;

/** Los iconos del manifest. Los «adaptables» llevan aire: Android los recorta en círculo o en gota. */
export const ICONOS_APP = [
  { src: rutaMarca("fiddle-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
  { src: rutaMarca("fiddle-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
  { src: rutaMarca("fiddle-192-adaptable.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: rutaMarca("fiddle-512-adaptable.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** Para el `metadata` de Next: el de la pestaña y el que coge el iPhone al guardar la web. */
export const ICONOS_WEB = { icon: rutaMarca("fiddle.svg"), apple: rutaMarca("fiddle-180.png") };

/** El nombre bajo el icono en el iPhone (Android lo lee del manifest). */
export const appleWebApp = (statusBarStyle = "default") => ({ capable: true, title: NOMBRE_APP, statusBarStyle });
