// ============================================================================
// MARCAS PROPIAS: el logo de verdad de UNA tienda
// ----------------------------------------------------------------------------
// Las marcas de dibujo.js son genéricas (una taza, unas tijeras): valen para
// cualquiera. Estas son de una tienda concreta y salen de su manual de marca, en
// vector (los trazos del PDF, pasados al lienzo de 512 de las demás). No se
// redibujan a ojo: el manual prohíbe deformar el logo.
//
// Mismo contrato que DIBUJOS: un solo color (el que se les pasa), así que valen
// en blanco sobre la tarjeta verde, en caramelo sobre la clara o dentro de un
// sello. Solo las ve en el editor la tienda que las tiene en su kit (lib/kits.js).
//
// Añadir una = su entrada aquí, su CAJA (la tinta de arriba abajo, para el modo
// relleno) y su nombre en el kit de la tienda.
// ============================================================================

const trazos = (ds) => (c) => ds.map((d) => `<path fill="${c}" d="${d}"/>`).join("");

// La Delicantería (docs/marca): el grano de café que hace de tilde de la í, y
// su «choice mark», la D dentro de un círculo abierto con el grano encima.
const GRANO_DELICANTERIA = [
  "M223.7 249.4C260.6 222.5 290.9 200.8 302.4 163.5C311.8 136.2 311.9 105.5 306.6 74.7C306 71 303.2 68.1 299.8 67.3C250 56 196.7 80.3 157.4 154.3C118.5 227.4 101.2 333.5 123.6 394.6C126.8 403.3 138.4 402.2 140 393C150.2 335.2 176.3 281.6 223.7 249.4",
  "M372.1 113.4C367.1 107 357.6 110.7 357.1 119.1C355.6 140.4 351.4 161.6 343.1 182.1C324.1 233.4 276.9 261.8 244.2 282.6C192.9 313.9 168.6 369.6 161.6 429.8C161 434.5 164 438.9 168.3 440C229.7 456 326.3 376.1 371.9 290.3C410.8 217.2 404.7 155 372.1 113.4",
];
// La D, las dos mitades del grano y el círculo abierto.
const D_DELICANTERIA = [
  "M297.9 358.2C297.9 359.5 297.5 360.6 296.6 361.5C295.7 362.4 294.6 362.8 293.3 362.8L260.9 362.8L260.9 209.7L293.3 209.7C294.6 209.7 295.7 210.1 296.6 211C297.5 211.9 297.9 212.9 297.9 214.2ZM340.6 171.2C332.2 162.8 321.6 158.6 308.6 158.6L195.8 158.6L195.8 160.9L206.4 183L206.4 389.5L195.8 411.6L195.8 413.9L308.6 413.9C321.6 413.9 332.2 409.7 340.6 401.3C349 392.9 353.2 382.3 353.2 369.3L353.2 203.2C353.2 190.2 349 179.5 340.6 171.2",
  "M292.8 79.7C303 72.2 311.4 66.2 314.6 55.9C317.3 48.3 317.3 39.7 315.8 31.2C315.6 30.2 314.9 29.4 313.9 29.1C300.1 26 285.3 32.8 274.4 53.3C263.6 73.6 258.8 103.1 265 120.1C265.9 122.5 269.1 122.2 269.5 119.6C272.4 103.5 279.6 88.7 292.8 79.7",
  "M334 41.9C332.6 40.2 330 41.2 329.8 43.5C329.4 49.4 328.3 55.3 325.9 61C320.7 75.3 307.6 83.2 298.5 89C284.2 97.6 277.5 113.1 275.5 129.8C275.4 131.1 276.2 132.4 277.4 132.7C294.5 137.1 321.3 114.9 333.9 91.1C344.7 70.8 343.1 53.5 334 41.9",
  "M347.7 107.8C448.1 140.7 475.2 240.1 455.1 335.7C449.3 358.3 433.8 376.5 420.7 394.3C393.1 430.2 356.5 460 312.3 473.4C273.4 486 229.9 479.9 194.1 460.6C106.4 417 36.8 316.9 83.3 219.3C99.5 146.5 165.2 107.2 233.9 92.7C244.3 90.6 247.1 106.4 236.6 108C194.7 113.3 159.1 141.1 135.4 174.4C124.1 190.9 109.5 206.1 102.7 225.9C95.6 245.7 99.2 267 98.3 286.7C97.9 326.5 109 368.8 136.2 401.4C162 435.1 204.8 452.5 246.2 453.3C287 455.5 329.9 452.6 366.2 431.2C384.2 420.4 401 406.3 412.9 388.6C425.6 371.2 429.7 349.6 436 330.2C442.2 310.7 446.8 289.3 443.7 268.7C436.8 227.8 416 191.5 389.2 160.6C375.4 145.6 359.5 132.3 341.7 120.5C334.9 116.4 340.2 105.2 347.7 107.8",
];

export const DIBUJOS_PROPIOS = {
  "delicanteria-grano": trazos(GRANO_DELICANTERIA),
  "delicanteria-d": trazos(D_DELICANTERIA),
};

/** Hasta dónde llega la tinta de cada una en el lienzo de 512 (como CAJA en dibujo.js), medida rasterizándolas. */
export const CAJA_PROPIA = {
  "delicanteria-grano": [64, 442],
  "delicanteria-d": [28, 480],
};
