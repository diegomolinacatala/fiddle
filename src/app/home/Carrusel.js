"use client";

import { useEffect, useRef, useState } from "react";
import { INICIO, pedir, entrar } from "./posicion";

// ============================================================================
// EL MÓVIL QUE VA PASANDO TARJETAS (portada de /home)
// ----------------------------------------------------------------------------
// Las tarjetas y los avisos llegan YA pintados del servidor (Telefono.js, con
// las funciones del pase): aquí solo se decide cuál se ve.
// - Pasa sola cada PASO ms, siempre hacia delante (la que sale se va por la
//   izquierda y la siguiente entra por la derecha, también al volver a la 1).
//   Deprisa a propósito: con 3,6 s parecía una foto y nadie veía que cambiaba.
// - Se para con el ratón encima, con el foco de teclado dentro, fuera de
//   pantalla, con la pestaña oculta y con el botón de pausa (más de 5 s
//   moviéndose sin poder pararlo no vale, WCAG 2.2.2). Darle a «seguir» manda
//   sobre el ratón y el foco: si no, el botón diría que va y seguiría quieto.
//   Un toque o un clic en un punto no la para (no es foco de teclado).
//   Con «reducir movimiento», ni pasa sola ni anima.
// - Se cambia con los puntos, con las flechas de los lados (muy suaves: el móvil
//   manda), con las flechas del teclado o deslizando el dedo.
// Sin JavaScript se ve la primera, que es una tarjeta completa.
// ============================================================================

const PASO = 2200;
const DESLIZ = 40; // px de dedo para que cuente como deslizar

export default function Carrusel({ titulos, tarjetas, avisos, children }) {
  const n = tarjetas.length;
  const [pos, setPos] = useState(INICIO);
  const [pausa, setPausa] = useState(false);
  const [raton, setRaton] = useState(false);
  const [foco, setFoco] = useState(false);
  const [quieto, setQuieto] = useState(true); // hasta saber si pide reducir movimiento
  const [aLaVista, setALaVista] = useState(true);
  const raiz = useRef(null);
  const dedo = useRef(null);

  // Todo se calcula sobre el estado de ese momento (setPos con función): el
  // temporizador y un toque pueden llegar en el mismo instante.
  const cambiar = (destino, sentido) => setPos((p) => pedir(p, destino, sentido, n));
  const siguiente = () => cambiar((a) => a + 1, 1);
  const anterior = () => cambiar((a) => a - 1, -1);

  useEffect(() => {
    if (pos.objetivo === null) return undefined;
    let segundo;
    const primero = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => setPos(entrar));
    });
    return () => {
      cancelAnimationFrame(primero);
      cancelAnimationFrame(segundo);
    };
  }, [pos.objetivo]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mirar = () => setQuieto(mq.matches);
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

  const corre = !quieto && !pausa && !raton && !foco && aLaVista;
  // Un temporizador por tarjeta: tocar un punto vuelve a contar desde cero.
  useEffect(() => {
    if (!corre) return undefined;
    const t = setTimeout(siguiente, PASO);
    return () => clearTimeout(t);
  }, [corre, pos.actual]);

  const pausarOSeguir = () => {
    if (pausa) {
      setRaton(false);
      setFoco(false);
    }
    setPausa(!pausa);
  };

  const teclas = (e) => {
    if (e.key === "ArrowRight") siguiente();
    else if (e.key === "ArrowLeft") anterior();
  };

  return (
    <figure
      ref={raiz}
      className="movil"
      role="group"
      aria-roledescription="carrusel"
      aria-label="Tarjetas de ejemplo"
      onKeyDown={teclas}
      onPointerEnter={(e) => e.pointerType === "mouse" && setRaton(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setRaton(false)}
      onFocus={(e) => e.target.matches?.(":focus-visible") && setFoco(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFoco(false)}
    >
      <div
        className="movil-cuerpo"
        onPointerDown={(e) => {
          dedo.current = e.clientX;
          // Que el soltar llegue aquí aunque el dedo o el ratón acaben fuera.
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (dedo.current == null) return;
          const dx = e.clientX - dedo.current;
          dedo.current = null;
          if (Math.abs(dx) > DESLIZ) (dx < 0 ? siguiente : anterior)();
        }}
        onPointerCancel={() => { dedo.current = null; }}
      >
        <div className="movil-isla" aria-hidden="true" />
        <div className="movil-pantalla">
          {children}
          <div className={`movil-tarjetas${pos.sentido < 0 ? " atras" : ""}`}>
            {tarjetas.map((t, i) => (
              <div
                key={titulos[i]}
                className={`movil-tarjeta ${i === pos.actual ? "activa" : i === pos.anterior ? "sale" : "espera"}`}
                role="group"
                aria-roledescription="tarjeta"
                aria-label={`${i + 1} de ${n}: ${titulos[i]}`}
                aria-hidden={i !== pos.actual}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fuera del cuerpo: el cuerpo captura el puntero para deslizar y se
          quedaría el clic. */}
      <button type="button" className="movil-flecha movil-flecha-antes" aria-label="Tarjeta anterior" onClick={anterior}>
        <Chevron />
      </button>
      <button type="button" className="movil-flecha movil-flecha-despues" aria-label="Tarjeta siguiente" onClick={siguiente}>
        <Chevron />
      </button>

      {/* key: cada tarjeta nueva vuelve a montar su aviso, y llega como uno de verdad. */}
      <div key={pos.actual} className={`movil-aviso${pos.movido ? "" : " primera"}`}>{avisos[pos.actual]}</div>

      <figcaption className="movil-pie">
        <span className="movil-titulo" aria-live={corre ? "off" : "polite"}>{titulos[pos.actual]}</span>
        <span className="movil-controles">
          {titulos.map((t, i) => (
            <button
              key={t}
              type="button"
              className="movil-punto"
              aria-label={`Ver tarjeta ${i + 1}: ${t}`}
              aria-current={i === pos.actual ? "true" : undefined}
              onClick={() => cambiar(i, i < pos.actual ? -1 : 1)}
            >
              <i />
            </button>
          ))}
          {/* Siempre en su sitio (que los puntos no se muevan al cargar); con
              «reducir movimiento» no hay nada que parar y no se ve ni se enfoca. */}
          <button
            type="button"
            className="movil-pausa"
            aria-label={pausa ? "Seguir pasando tarjetas" : "Parar las tarjetas"}
            onClick={pausarOSeguir}
            disabled={quieto}
            style={quieto ? { visibility: "hidden" } : undefined}
          >
            {pausa ? <Seguir /> : <Parar />}
          </button>
        </span>
      </figcaption>
    </figure>
  );
}

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

const Parar = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <rect x="3" y="2" width="3" height="10" rx="1" />
    <rect x="8" y="2" width="3" height="10" rx="1" />
  </svg>
);

const Seguir = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <path d="M4 2.5v9a.6.6 0 0 0 .9.5l7.2-4.5a.6.6 0 0 0 0-1L4.9 2a.6.6 0 0 0-.9.5z" />
  </svg>
);
