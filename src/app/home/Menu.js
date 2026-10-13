"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CONSULTA_MOVIL } from "./consultaMovil";

// ============================================================================
// EL MENÚ DEL MÓVIL (/home)
// ----------------------------------------------------------------------------
// En un móvil no caben las secciones en la cabecera: se quedan el logo,
// «Entrar» y este botón, que despliega la lista bajo la cabecera. Es un
// desplegable (aria-expanded), no un diálogo: se cierra con Escape, tocando
// fuera, al salir de él con el tabulador, al elegir una sección y si la
// pantalla deja de ser «de móvil» (CONSULTA_MOVIL). Mientras está abierto la
// página no se mueve por detrás, y la barra de WhatsApp de abajo se esconde
// (html.menu-abierto, BarraMovil.js).
// En pantallas anchas no se ve: las secciones van en la cabecera.
// ============================================================================

export default function Menu({ enlaces, contacto }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef(null);
  const caja = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    const html = document.documentElement;
    html.classList.add("menu-abierto");
    caja.current?.querySelector("a")?.focus({ preventScroll: true });

    const tecla = (e) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    const mq = window.matchMedia(CONSULTA_MOVIL);
    const ancho = () => !mq.matches && setAbierto(false);
    document.addEventListener("keydown", tecla);
    mq.addEventListener("change", ancho);
    return () => {
      html.classList.remove("menu-abierto");
      document.removeEventListener("keydown", tecla);
      mq.removeEventListener("change", ancho);
    };
  }, [abierto]);

  // Si el foco pasa a otra cosa fuera del menú y de su botón (tabulador), se
  // cierra. Solo si hay a dónde: en Safari tocar un botón o un enlace NO les da
  // el foco, el blur llega sin relatedTarget y cerrar ahí rompía la X (se
  // cerraba y el clic lo volvía a abrir) y los enlaces (el clic caía en inert).
  const alSalir = (e) => {
    const fuera = e.relatedTarget && !caja.current?.contains(e.relatedTarget) && !boton.current?.contains(e.relatedTarget);
    if (abierto && fuera) setAbierto(false);
  };

  return (
    <div className="menu" onBlur={alSalir}>
      <button
        ref={boton}
        type="button"
        className="menu-boton"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"}
        onClick={() => setAbierto((a) => !a)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div className={`menu-fondo${abierto ? " visto" : ""}`} aria-hidden="true" onClick={() => setAbierto(false)} />
      <nav ref={caja} id={id} className={`menu-caja${abierto ? " visto" : ""}`} aria-label="Secciones" inert={!abierto}>
        <ul>
          {enlaces.map(([href, texto]) => (
            <li key={href}>
              <a href={href} onClick={() => setAbierto(false)}>
                {texto}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
        {/* Abre WhatsApp en otra app: al volver, que la página esté como estaba. */}
        <div className="menu-pie" onClick={() => setAbierto(false)}>{contacto}</div>
      </nav>
    </div>
  );
}
