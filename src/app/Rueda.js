"use client";

import NumberFlow from "@number-flow/react";

// Cada cifra es una tira 0-9 que gira derecha hasta la suya, como un
// cuentakilómetros (de 31 a 58: las unidades de 1 a 8, las decenas de 3 a 5). Sin
// `continuous`: con él las unidades daban decenas de vueltas y se veía un borrón. Es NumberFlow (barvian/number-flow, MIT): antes cada cifra
// se volvía a montar en cada fotograma con su entrada de 0,2 s y lo que se veía
// era un parpadeo, no una rueda. Las tiras, el ancho que crece al ganar una
// cifra, el separador de miles y quien pide menos movimiento ya los resuelve él.
// Arranca suave, gira y frena despacio: con una curva que frena muy pronto
// (probado fotograma a fotograma) todo el giro pasaba en 0,25 s y parecía un salto.
const GIRO = { duration: 1500, easing: "cubic-bezier(.45, .05, .2, 1)" };
const POSICION = { duration: 700, easing: "cubic-bezier(.45, .05, .2, 1)" };

/**
 * Pinta `valor`. Al cambiar, gira desde el que tenía: quien decide desde dónde
 * (lo último que vio este dispositivo) es useVisto, que primero le da el viejo
 * y, al verse el bloque, el nuevo.
 */
export default function Rueda({ valor, gira = true }) {
  return (
    <NumberFlow
      value={Number.isFinite(valor) ? valor : 0}
      animated={gira}
      locales="es-ES"
      spinTiming={GIRO}
      transformTiming={POSICION}
      willChange
      style={{ fontVariantNumeric: "tabular-nums" }}
    />
  );
}
