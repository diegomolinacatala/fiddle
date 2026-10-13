// ============================================================================
// LOS COLORES DE FIDDLE
// ----------------------------------------------------------------------------
// Los cinco de la marca (elegidos el 13-10-2026) van tal cual. Son todos
// apagados y casi todos oscuros, así que para que respiren hacen falta un papel
// claro y unos tintes: salen de ellos mismos, no son colores nuevos.
//
//   carbón  el texto y las bandas oscuras         salvia  el acento sobre oscuro
//   ébano   el texto secundario                   topo    el acento sobre claro
//   nogal   el violín y los botones
//
// Contraste comprobado sobre el papel: carbón 12,6:1, ébano 6,3:1, nogal 11,8:1,
// topo 4,4:1 (solo para cosas grandes: el punto, iconos). Sobre carbón, el papel
// 12,6:1 y la salvia 5,7:1. La salvia sobre el papel no llega (2,2:1): nunca texto.
// ============================================================================

export const PALETA = {
  // los cinco
  salvia: "#a5a789",
  topo: "#816c61",
  nogal: "#402c0f",
  ebano: "#575a4b",
  carbon: "#2a2c24",
  // los que salen de ellos
  papel: "#f4f2ec", // el fondo: blanco roto hacia la salvia
  superficie: "#fbfaf6", // tarjetas sobre el papel
  crema: "#f6f1e8", // el papel con algo del nogal, para tarjetas de ejemplo
  salviaClara: "#e3e4d6",
  topoClaro: "#ece5df",
  nogalClaro: "#ede6da",
  tintaSuave: "#6b6a5c", // texto terciario: 4,9:1 sobre el papel
  topoOscuro: "#6f5b50", // el topo para letra pequeña: 5,7:1 sobre la crema
  nogalEncima: "#553c18", // los botones al pasar el ratón
  // el final de los degradados de los pasos (cada tinte, un punto más hondo)
  salviaHonda: "#d6d8c5",
  topoHondo: "#e0d5cc",
  nogalHondo: "#e2d6c3",
};
