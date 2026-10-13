/**
 * Cuándo se ve la web «de móvil» (/home): hasta 759 px, y el móvil en horizontal
 * (ancho de tableta, pero poco alto y con dedo). La usan el CSS (estiloMovil.js)
 * y el menú (Menu.js); va aparte para que el menú no se lleve todo el CSS al
 * navegador.
 */
export const CONSULTA_MOVIL = "(max-width: 759px), (pointer: coarse) and (max-height: 500px)";
