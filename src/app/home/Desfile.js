"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// LO QUE MUEVE LA CINTA (Cinta.js)
// ----------------------------------------------------------------------------
// Para que la fila no se acabe, las tarjetas van varias veces seguidas (las
// tandas que hagan falta para cubrir la pantalla, más una) y la pista se desplaza
// justo una tanda: al llegar, la segunda está donde empezó la primera y el salto
// no se ve. Las copias las pinta el navegador al montar (no viajan en el HTML) y,
// hasta entonces, la cinta está quieta.
// - Con «reducir movimiento», no se mueve ni se duplica.
// - Fuera de pantalla o con la pestaña oculta, se para (batería).
// - Con el ratón encima se para (CSS); con el dedo, un toque la para y otro la
//   sigue. Es decoración (aria-hidden): lo que enseña ya lo dice el móvil.
// ============================================================================

const SEGUNDOS_POR_TARJETA = 4.2;

export default function Desfile({ cuantas, children }) {
  const raiz = useRef(null);
  const [corre, setCorre] = useState(false);
  const [aLaVista, setALaVista] = useState(true);
  const [parada, setParada] = useState(false);
  const [tandas, setTandas] = useState(1);
  const pista = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mirar = () => setCorre(!mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => mq.removeEventListener("change", mirar);
  }, []);

  useEffect(() => {
    let enPantalla = true;
    const actualizar = () => setALaVista(enPantalla && document.visibilityState === "visible");
    const obs = new IntersectionObserver((entradas) => {
      enPantalla = entradas[entradas.length - 1].isIntersecting;
      actualizar();
    });
    if (raiz.current) obs.observe(raiz.current);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      obs.disconnect();
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, []);

  // Cuántas tandas: en una pantalla de 2560 dos no llegan y el final quedaba vacío.
  useEffect(() => {
    if (!corre) {
      setTandas(1);
      return undefined;
    }
    const medir = () => {
      const ancho = pista.current?.firstElementChild?.getBoundingClientRect().width;
      if (ancho) setTandas(Math.max(2, Math.ceil(window.innerWidth / ancho) + 1));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [corre]);

  const clases = ["cinta-pista", corre && tandas > 1 && "corre", (!aLaVista || parada) && "quieta"].filter(Boolean).join(" ");

  return (
    <div
      ref={raiz}
      className="cinta"
      aria-hidden="true"
      onClick={(e) => ["touch", "pen"].includes(e.nativeEvent.pointerType) && setParada((p) => !p)}
    >
      <div ref={pista} className={clases} style={{ "--vuelta": `${cuantas * SEGUNDOS_POR_TARJETA}s`, "--tandas": tandas }}>
        {Array.from({ length: tandas }, (_, i) => (
          <div key={i} className="cinta-tanda">{children}</div>
        ))}
      </div>
    </div>
  );
}
