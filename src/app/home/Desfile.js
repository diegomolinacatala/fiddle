"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// LO QUE MUEVE LA CINTA (Cinta.js)
// ----------------------------------------------------------------------------
// Para que la fila no se acabe, las tarjetas van varias veces seguidas (las
// tandas que hagan falta para cubrir la pantalla, más una) y la pista vuelve
// atrás una tanda justo al recorrerla: la segunda está donde empezó la primera y
// el salto no se ve. Las copias las pinta el navegador al montar (no viajan en el
// HTML) y, hasta entonces, la cinta está quieta.
//
// El movimiento es un bucle de requestAnimationFrame con velocidad, no una
// animación CSS (07-11-2026, lo pidió Víctor): con el ratón encima la cinta
// FRENA hasta pararse, y al salir vuelve a coger velocidad, en vez de pararse de
// golpe. La tarjeta que hay bajo el ratón se acerca y se inclina hacia él, con un
// brillo que lo sigue (las variables --rx, --ry, --bx, --by de .cinta-tarjeta).
//
// - Con «reducir movimiento», ni se mueve, ni se duplica, ni se inclina.
// - Fuera de pantalla o con la pestaña oculta, el bucle se duerme (batería).
// - Con el dedo, un toque la para y otro la sigue (también frenando). Es
//   decoración (aria-hidden): lo que enseña ya lo dice el móvil.
// ============================================================================

const SEGUNDOS_POR_TARJETA = 4.2;
const FRENADA = 380; // ms: cuánto tarda en pararse (y en volver a ir)
const INCLINA = 10; // grados, como mucho

export default function Desfile({ cuantas, children }) {
  const raiz = useRef(null);
  const pista = useRef(null);
  const [corre, setCorre] = useState(false);
  const [tandas, setTandas] = useState(1);
  // Lo que lee el bucle sin volver a pintar React.
  const estado = useRef({ encima: false, parada: false, aLaVista: true });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mirar = () => setCorre(!mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => mq.removeEventListener("change", mirar);
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

  // El bucle: la velocidad va hacia la que toca (0 con el ratón encima) con un
  // muelle, y la posición avanza con ella.
  useEffect(() => {
    const el = pista.current;
    const caja = raiz.current;
    if (!corre || tandas < 2 || !el || !caja) {
      if (el) el.style.transform = "";
      return undefined;
    }
    let raf = 0;
    let antes = 0;
    let x = 0;
    let v = null;
    const paso = (t) => {
      const dt = antes ? Math.min(64, t - antes) : 16;
      antes = t;
      const tanda = el.firstElementChild?.getBoundingClientRect().width || 0;
      const crucero = tanda / (cuantas * SEGUNDOS_POR_TARJETA * 1000); // px por ms
      const { encima, parada } = estado.current;
      const objetivo = encima || parada ? 0 : crucero;
      if (v === null) v = objetivo;
      v += (objetivo - v) * (1 - Math.exp(-dt / (FRENADA / 3)));
      if (tanda) x = (x + v * dt) % tanda;
      el.style.transform = `translate3d(${-x}px,0,0)`;
      raf = requestAnimationFrame(paso);
    };
    const arrancar = () => {
      if (!raf && estado.current.aLaVista) {
        antes = 0;
        raf = requestAnimationFrame(paso);
      }
    };
    const parar = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    let enPantalla = true;
    const actualizar = () => {
      estado.current.aLaVista = enPantalla && document.visibilityState === "visible";
      if (estado.current.aLaVista) arrancar();
      else parar();
    };
    const obs = new IntersectionObserver((entradas) => {
      enPantalla = entradas[entradas.length - 1].isIntersecting;
      actualizar();
    });
    obs.observe(caja);
    document.addEventListener("visibilitychange", actualizar);
    arrancar();
    return () => {
      parar();
      obs.disconnect();
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [corre, tandas, cuantas]);

  // ---- el ratón: frena la cinta y acerca e inclina la tarjeta de debajo
  const actual = useRef(null);
  const soltar = () => {
    actual.current?.classList.remove("encima");
    actual.current = null;
  };
  const mover = (e) => {
    if (e.pointerType !== "mouse") return;
    estado.current.encima = true;
    if (!corre) return;
    const t = e.target.closest?.(".cinta-tarjeta");
    if (t !== actual.current) {
      soltar();
      if (t) {
        t.classList.add("encima");
        actual.current = t;
      }
    }
    if (!t) return;
    const r = t.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    t.style.setProperty("--ry", `${((px - 0.5) * 2 * INCLINA).toFixed(2)}deg`);
    t.style.setProperty("--rx", `${((0.5 - py) * 2 * INCLINA).toFixed(2)}deg`);
    t.style.setProperty("--bx", `${(px * 100).toFixed(1)}%`);
    t.style.setProperty("--by", `${(py * 100).toFixed(1)}%`);
  };
  const salir = (e) => {
    if (e.pointerType !== "mouse") return;
    estado.current.encima = false;
    soltar();
  };

  return (
    <div
      ref={raiz}
      className={`cinta${corre ? " viva" : ""}`}
      aria-hidden="true"
      onPointerMove={mover}
      onPointerLeave={salir}
      onClick={(e) => {
        if (["touch", "pen"].includes(e.nativeEvent.pointerType)) estado.current.parada = !estado.current.parada;
      }}
    >
      <div ref={pista} className="cinta-pista" style={{ "--tandas": tandas }}>
        {Array.from({ length: tandas }, (_, i) => (
          <div key={i} className="cinta-tanda">{children}</div>
        ))}
      </div>
    </div>
  );
}
