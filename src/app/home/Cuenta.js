"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// UNA CIFRA QUE CUENTA DESDE 0 AL APARECER (Cifras.js)
// ----------------------------------------------------------------------------
// El número final ya está en el HTML (sin JavaScript, y para el lector de
// pantalla). Al montar, si la cifra aún está por debajo de la pantalla, se tapa
// con un duplicado aria-hidden que cuenta y, al acabar, se destapa el real. El
// duplicado ocupa el sitio del real: la cifra no cambia de ancho y nada se mueve.
// Con «reducir movimiento», o si ya se ve al cargar, no hace nada.
// ============================================================================

const DURACION = 900; // ms
const salida = (t) => 1 - Math.pow(1 - t, 3); // ease-out cúbico

export default function Cuenta({ valor, antes = "" }) {
  const raiz = useRef(null);
  const viva = useRef(null);

  useEffect(() => {
    const el = raiz.current;
    const falso = viva.current;
    if (!el || !falso || !("IntersectionObserver" in window)) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (el.getBoundingClientRect().top < window.innerHeight) return undefined;

    let cuadro = 0;
    falso.textContent = "0";
    el.dataset.cuenta = "espera";
    const obs = new IntersectionObserver(
      (entradas) => {
        if (!entradas[entradas.length - 1].isIntersecting) return;
        obs.disconnect();
        const inicio = performance.now();
        const paso = (ahora) => {
          const t = Math.min(1, (ahora - inicio) / DURACION);
          falso.textContent = String(Math.round(valor * salida(t)));
          if (t < 1) cuadro = requestAnimationFrame(paso);
          else el.dataset.cuenta = "fin";
        };
        cuadro = requestAnimationFrame(paso);
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(cuadro);
      delete el.dataset.cuenta;
    };
  }, [valor]);

  return (
    <b className="sc-cuenta">
      {antes}
      <b ref={raiz} className="sc-cuenta-numero">
        <b className="sc-cuenta-real">{valor}</b>
        <b ref={viva} className="sc-cuenta-viva" aria-hidden="true" />
      </b>
    </b>
  );
}
