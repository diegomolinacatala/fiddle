"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// ENTRAR UNA VEZ, AL LLEGAR (los precios de /home)
// ----------------------------------------------------------------------------
// El resto de la página entra con el scroll (animation-timeline): a medio bajar,
// a media opacidad. En los precios quedaba feo, la tarjeta clara se veía sucia
// mientras no acababas de bajar. Aquí la entrada va por TIEMPO: cuando el bloque
// asoma, sube una vez y se queda; nunca se ve a medias.
// - El estado inicial (data-aparece="espera") lo pone el navegador al montar y
//   solo si el bloque aún está por debajo: sin JavaScript, o si ya se ve al
//   cargar, se ve tal cual, sin saltos.
// - Con «reducir movimiento», nada.
// Qué se mueve lo dice el CSS de [data-aparece].
// ============================================================================

export default function Aparece({ className, children, ...resto }) {
  const ref = useRef(null);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (el.getBoundingClientRect().top < window.innerHeight) return undefined;
    setEstado("espera");
    const obs = new IntersectionObserver(
      (entradas) => {
        if (!entradas[entradas.length - 1].isIntersecting) return;
        setEstado("visto");
        obs.disconnect();
      },
      { threshold: 0.18 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} data-aparece={estado ?? undefined} {...resto}>
      {children}
    </div>
  );
}
