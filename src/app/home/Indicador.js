"use client";

import { useEffect, useRef, useState } from "react";
import { paradaMasCercana } from "./posicion";

// ============================================================================
// LAS PESTAÑAS Y LOS PUNTOS DE UNA FILA DESLIZABLE (/home, en el móvil)
// ----------------------------------------------------------------------------
// En el móvil, los pasos, el panel y los precios dejan de ir uno debajo de otro
// y pasan a una fila que se desliza con el dedo (scroll-snap, en CSS): la página
// se queda en la mitad de alto y se ve que hay más porque asoma el siguiente.
// Esto solo dice en cuál estás y lleva a otra al tocarla. La fila es el
// elemento con id `objetivo` y cada hijo, una parada.
// - `etiquetas` con `tipo="pestanas"`: botones con texto, encima (el panel, los
//   precios). Con «puntos», solo el punto, debajo (los pasos).
// - Sin JavaScript se desliza igual; solo faltan los puntos.
// - En pantallas anchas no se ve (CSS): ahí todo va a la vez.
// - Al tocar una, se queda marcada esa mientras la fila llega deslizándose: si
//   no, la marca iba pasando por las de en medio.
// ============================================================================

export default function Indicador({ objetivo, etiquetas, nombre, tipo = "puntos" }) {
  const [activa, setActiva] = useState(0);
  // A dónde va la fila tras un toque, y hasta cuándo se ignora lo de en medio.
  const yendo = useRef(null);

  useEffect(() => {
    const fila = document.getElementById(objetivo);
    if (!fila) return undefined;
    let pendiente = 0;
    const medir = () => {
      pendiente = 0;
      const aqui = paradaActual(fila);
      if (yendo.current) {
        if (aqui !== yendo.current.i && Date.now() < yendo.current.hasta) return;
        yendo.current = null;
      }
      setActiva(aqui);
    };
    const alMover = () => {
      if (!pendiente) pendiente = requestAnimationFrame(medir);
    };
    fila.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    medir();
    return () => {
      cancelAnimationFrame(pendiente);
      fila.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
    };
  }, [objetivo]);

  const ir = (i) => {
    const fila = document.getElementById(objetivo);
    const hijo = fila?.children[i];
    if (!hijo) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Con un tope: si el dedo la para a medias, que la marca vuelva a seguirla.
    yendo.current = { i, hasta: Date.now() + 900 };
    fila.scrollTo({ left: hijo.offsetLeft - margenDe(fila), behavior: suave ? "smooth" : "auto" });
    setActiva(i);
  };

  return (
    <div className={`indicador indicador-${tipo}`} role="group" aria-label={nombre}>
      {etiquetas.map((texto, i) => (
        <button
          key={texto}
          type="button"
          aria-label={tipo === "puntos" ? `Ver ${texto}` : undefined}
          aria-current={i === activa ? "true" : undefined}
          onClick={() => ir(i)}
        >
          {tipo === "puntos" ? <i /> : texto}
        </button>
      ))}
    </div>
  );
}

// Dónde se para cada tarjeta: a la distancia del scroll-padding del borde.
const margenDe = (fila) => parseFloat(getComputedStyle(fila).scrollPaddingInlineStart) || 0;

function paradaActual(fila) {
  const margen = margenDe(fila);
  return paradaMasCercana({
    paradas: [...fila.children].map((h) => h.offsetLeft - margen),
    desplazado: fila.scrollLeft,
    maximo: fila.scrollWidth - fila.clientWidth,
  });
}
