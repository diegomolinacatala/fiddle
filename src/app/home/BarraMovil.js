"use client";

import { useEffect, useState } from "react";

// ============================================================================
// LA BARRA DE ABAJO EN EL MÓVIL (/home)
// ----------------------------------------------------------------------------
// En el móvil, el botón de WhatsApp de la portada se queda atrás en cuanto se
// baja; esta barra lo trae al pulgar. Solo aparece cuando ese botón ya no se ve
// (por arriba) y se va al llegar a «Contacto» o al pie, donde ya está a la vista,
// y mientras el menú está abierto (CSS, html.menu-abierto). En pantallas anchas
// no existe (CSS).
// Escondida no se enfoca ni se lee (inert): sería un botón fantasma.
// ============================================================================

export default function BarraMovil({ children }) {
  const [vista, setVista] = useState(false);

  useEffect(() => {
    const portada = document.querySelector(".portada .acciones");
    const finales = [document.getElementById("contacto"), document.querySelector(".pie")].filter(Boolean);
    if (!portada) return undefined;

    let pasada = false;
    const aLaVista = new Set();
    const decidir = () => setVista(pasada && aLaVista.size === 0);

    // La última entrada: si llegan varias juntas, es la que vale.
    const arriba = new IntersectionObserver((entradas) => {
      const e = entradas[entradas.length - 1];
      pasada = !e.isIntersecting && e.boundingClientRect.top < 0;
      decidir();
    });
    const abajo = new IntersectionObserver((entradas) => {
      for (const e of entradas) e.isIntersecting ? aLaVista.add(e.target) : aLaVista.delete(e.target);
      decidir();
    });
    arriba.observe(portada);
    finales.forEach((el) => abajo.observe(el));
    return () => {
      arriba.disconnect();
      abajo.disconnect();
    };
  }, []);

  return (
    <div className={`barra${vista ? " vista" : ""}`} inert={!vista}>
      {children}
    </div>
  );
}
