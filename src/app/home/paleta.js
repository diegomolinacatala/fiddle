// ============================================================================
// LOS COLORES DE FIDDLE
// ----------------------------------------------------------------------------
// «Verde y espresso» (elegida el 13-10-2026): el verde botella de un club inglés
// para la marca y la base de una cachemira (lino, camel, avena, visón, espresso)
// para todo lo demás. La de antes (salvia, topo, nogal) mezclaba tres familias que
// se parecían sin ser iguales y se leía como un error.
//
//   espresso  el texto y las bandas oscuras       avena  el acento sobre oscuro
//   visón     el texto secundario                 camel  el acento sobre claro
//   verde     el violín, los botones y el panel
//
// Una regla que no se rompe: el verde (la marca) y el espresso (la tinta) se
// distinguen de un vistazo, por tono y por luz. Si se parecieran, la banda del
// panel y la del pie parecerían el mismo color mal copiado.
//
// Contraste comprobado sobre el papel: espresso 15,9:1, visón 6,6:1, verde 10,2:1,
// camel 3,3:1 (solo para cosas grandes: el punto, iconos). Sobre el verde, el papel
// 10,2:1 y la avena 6,4:1; sobre el espresso, 15,9:1 y 10,0:1. La avena sobre el
// papel no llega (1,6:1): nunca texto.
// ============================================================================

export const PALETA = {
  // los cinco
  verde: "#1a422f",
  camel: "#a67f58",
  avena: "#d6c0a5",
  vison: "#60544b",
  espresso: "#1f1812",
  // los que salen de ellos
  papel: "#f8f3ec", // el fondo: lino, blanco roto hacia la avena
  superficie: "#fcf9f5", // tarjetas sobre el papel
  crema: "#f6efe4", // el papel con algo más de avena, para tarjetas de ejemplo
  verdeClaro: "#e0e9e0",
  camelClaro: "#f2dfcf",
  avenaClara: "#ede9df",
  tintaSuave: "#75695f", // texto terciario: 4,8:1 sobre el papel
  camelOscuro: "#7e5d3f", // el camel para letra pequeña: 5,2:1 sobre la crema
  verdeEncima: "#26523c", // los botones al pasar el ratón
  // el final de los degradados de los pasos (cada tinte, un punto más hondo)
  verdeHondo: "#d3e1d3",
  camelHondo: "#ecd4c0",
  avenaHonda: "#e6dfd0",
};
