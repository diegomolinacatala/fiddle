// ============================================================================
// EL LOGO DE LA TIENDA: DIBUJO O IMAGEN PROPIA
// ----------------------------------------------------------------------------
// Por defecto el logo es una de las marcas dibujadas (lib/apple/dibujo.js). La
// tienda puede subir su propia imagen (Editar tarjeta → Logo → "Tu imagen"):
// entonces `tema.logoImagen = { id, b, opaco }` y el logo de todas partes (el
// pase de Apple, el círculo de Google, el icono de la app, la cabecera del
// manager) sale de esa imagen. Los SELLOS siguen siendo el dibujo: una foto
// dentro de cada casilla no se lee.
//
//   id     huella del contenido (sha-256 cortado): la URL cambia si cambia la imagen
//   b      la tienda (el slug), para poder armar la URL solo con el tema
//   opaco  sin transparencias: se puede recortar a sangre (círculo, cuadrado);
//          con transparencias va centrada sobre el fondo de la tarjeta
//
// Puro y sin dependencias: lo usan el navegador, el servidor y la validación.
// ============================================================================

export const LOGO_MIN = 256;   // lado mínimo de la imagen que se sube, en píxeles
export const LOGO_LADO = 1024; // la que se guarda: cuadrada, de este lado
export const TAMS_LOGO = [64, 128, 256, 512, 1024];

const ID = /^[0-9a-f]{16,64}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** El logo de imagen de un tema, limpio, o null si no tiene (o no vale). */
export function logoImagenDe(tema) {
  const l = tema?.logoImagen;
  if (!l || typeof l !== "object" || !ID.test(String(l.id)) || !SLUG.test(String(l.b))) return null;
  return { id: l.id, b: l.b, opaco: l.opaco === true };
}

/** Lo que llega del editor: un logo válido, null para quitarlo, o undefined si no se toca. */
export function validarLogoImagen(v) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  return logoImagenDe({ logoImagen: v }) ?? undefined;
}

/** El tamaño servido más cercano por arriba a lo que se pide (la URL canónica). */
export const tamLogo = (t) => TAMS_LOGO.find((x) => x >= t) ?? TAMS_LOGO.at(-1);

/** URL de la imagen, a un tamaño (redondeado a los que se sirven). */
export function rutaLogoImagen(tema, tam = 256) {
  const l = logoImagenDe(tema);
  return l ? `/api/logo?b=${l.b}&v=${l.id}&t=${tamLogo(tam)}` : null;
}
