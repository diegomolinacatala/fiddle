// ============================================================================
// KITS DE MARCA: lo que es de UNA tienda
// ----------------------------------------------------------------------------
// Las plantillas de negocios.js valen para cualquiera (una cafetería, una
// barbería). Una tienda con manual de marca tiene lo suyo: su logo en vector,
// sus colores y unos diseños de tarjeta hechos con ellos. Eso vive aquí, y solo
// lo ve SU editor (Tienda → Editar tarjeta): los diseños arriba, sus dibujos
// primero en el logo y en los sellos, y su paleta junto a cada color.
//
// Un diseño del kit es un ESTILO más (negocios.js los junta con los demás): se
// guarda en `tema.estilo` y pasa por la misma validación. Lo que trae:
//   accent   el color de la tienda: botones de la caja y de las pantallas, con
//            texto blanco encima. Nunca blanco.
//   detalle  el del logo, los sellos y las etiquetas del pase, si no es el de
//            la tienda (la tarjeta verde con todo en blanco).
//   google   el fondo en Google Wallet (ver lib/google/pase.js).
//
// Añadir un kit = una entrada en KITS con la clave del slug de la tienda, y sus
// dibujos (si los tiene) en lib/apple/marcasPropias.js.
// ============================================================================

// La Delicantería, de su manual (docs/marca/LA DELICANTERIA - Brand Guidelines.pdf).
const VERDE = "#5b825b"; // Kale Green · Pantone 363 C
const CARAMELO = "#c3844c"; // Caramel Brown · Pantone 145 C
const GRIS_CLARO = "#eeecec"; // el fondo claro del logo a color (pág. 08)
const CARBON = "#575756"; // el fondo oscuro del logo en blanco (pág. 08)
const BLANCO = "#ffffff";

const ATRAS_DELICANTERIA = "Un sello por cookie y otro por café. Al completar cada cartilla, la siguiente te la invitamos.";

// Lo que comparten todos sus diseños: el grano del logo arriba a la izquierda,
// casillas redondas (como el círculo de su D) y el texto de la información.
const BASE_DELICANTERIA = {
  marca: "delicanteria-grano",
  forma: "circulo",
  modo: "casillas",
  accent: VERDE,
  atras: ATRAS_DELICANTERIA,
};

export const KITS = {
  delicanteria: {
    // Junto a cada selector de color, con su nombre del manual.
    colores: [
      { hex: VERDE, nombre: "Kale Green" },
      { hex: CARAMELO, nombre: "Caramel Brown" },
      { hex: BLANCO, nombre: "Blanco" },
      { hex: GRIS_CLARO, nombre: "Gris claro" },
      { hex: CARBON, nombre: "Gris carbón" },
    ],
    marcas: {
      "delicanteria-grano": "El grano del logo",
      "delicanteria-d": "La D",
    },
    // Los fondos que el manual da por buenos para el logo (pág. 08), cada uno
    // con el logo como manda: en blanco sobre color, a color sobre el claro.
    estilos: {
      "delicanteria-verde": {
        nombre: "Verde",
        tema: {
          ...BASE_DELICANTERIA, cardBg: VERDE, ink: BLANCO, detalle: BLANCO, banda: "clara", google: "tarjeta",
          pageBg: VERDE, pageInk: BLANCO,
        },
      },
      "delicanteria-claro": {
        nombre: "Claro, verde y caramelo",
        tema: {
          ...BASE_DELICANTERIA, cardBg: GRIS_CLARO, ink: VERDE, detalle: CARAMELO, banda: "blanca", google: "tarjeta",
          pageBg: GRIS_CLARO, pageInk: VERDE,
        },
      },
      "delicanteria-blanco": {
        nombre: "Blanco y verde",
        tema: {
          ...BASE_DELICANTERIA, cardBg: BLANCO, ink: VERDE, detalle: null, banda: "clara", google: "acento",
          pageBg: BLANCO, pageInk: VERDE,
        },
      },
      "delicanteria-caramelo": {
        nombre: "Caramelo",
        tema: {
          ...BASE_DELICANTERIA, cardBg: CARAMELO, ink: BLANCO, detalle: BLANCO, banda: "clara", google: "tarjeta",
          pageBg: CARAMELO, pageInk: BLANCO,
        },
      },
      "delicanteria-carbon": {
        nombre: "Carbón y caramelo",
        tema: {
          ...BASE_DELICANTERIA, cardBg: CARBON, ink: BLANCO, detalle: CARAMELO, banda: "clara", google: "tarjeta",
          pageBg: CARBON, pageInk: BLANCO,
        },
      },
    },
  },
};

/** El kit de una tienda, o null si no tiene. */
export const kitDe = (slug) => (Object.hasOwn(KITS, String(slug)) ? KITS[slug] : null);

/** Los estilos de todos los kits, { clave: tema }, para juntarlos con las plantillas. */
export const ESTILOS_DE_KITS = Object.fromEntries(
  Object.values(KITS).flatMap((k) => Object.entries(k.estilos).map(([clave, e]) => [clave, { ...e.tema, estilo: clave }])),
);

/** Cómo se leen en pantalla los dibujos y los diseños de los kits. */
export const ROTULOS_DE_KITS = Object.fromEntries(
  Object.values(KITS).flatMap((k) => [
    ...Object.entries(k.marcas),
    ...Object.entries(k.estilos).map(([clave, e]) => [clave, e.nombre]),
  ]),
);
