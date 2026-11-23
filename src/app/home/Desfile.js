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
// Con el ratón encima la cinta FRENA hasta pararse, y al salir vuelve a coger
// velocidad, en vez de pararse de golpe (07-11-2026, lo pidió Víctor). La tarjeta que hay bajo el ratón se acerca y se inclina hacia él, con un
// brillo que lo sigue (las variables --rx, --ry, --bx, --by de .cinta-tarjeta).
//
// - Con «reducir movimiento», ni se mueve, ni se duplica, ni se inclina.
// - Fuera de pantalla o con la pestaña oculta, se pone en pausa (batería).
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

  // El movimiento es una animación del navegador (Web Animations), que corre en
  // el compositor: el hilo principal no hace nada mientras la cinta va a su
  // ritmo. Con un rAF que escribía el transform en cada fotograma, Chrome
  // rehacía las capas de toda la página 60 veces por segundo y en un móvil
  // modesto era lo que más tiraba (23-11-2026, medido con la CPU a 1/4). Solo
  // la frenada y la arrancada van con rAF: la velocidad va hacia la que toca
  // (0 con el ratón encima) con un muelle, y al llegar se apaga.
  const muelle = useRef(() => {});
  useEffect(() => {
    const el = pista.current;
    const caja = raiz.current;
    if (!corre || tandas < 2 || !el || !caja || !el.animate) return undefined;
    const primera = el.firstElementChild;
    const recorrido = () => [
      { transform: "translate3d(0,0,0)" },
      { transform: `translate3d(${-(primera?.getBoundingClientRect().width || 0)}px,0,0)` },
    ];
    const anim = el.animate(recorrido(), { duration: cuantas * SEGUNDOS_POR_TARJETA * 1000, iterations: Infinity });
    // El ancho de una tanda cambia con la ventana (el zoom y el hueco van con
    // ella): misma duración, otro recorrido, y sigue por donde iba.
    const tamano = new ResizeObserver(() => anim.effect.setKeyframes(recorrido()));
    if (primera) tamano.observe(primera);

    let raf = 0;
    let antes = 0;
    let v = 1; // la velocidad, de 0 (parada) a 1 (la de crucero)
    let t = 0; // por dónde va, mientras frena o arranca
    const quieta = () => estado.current.encima || estado.current.parada;
    // Mientras cambia de velocidad la animación está en pausa y se lleva a mano
    // (currentTime): cambiarle el playbackRate en cada fotograma la dejaba
    // clavada y frenaba en seco. Al llegar a crucero vuelve a ir sola.
    const paso = (ahora) => {
      const dt = antes ? Math.min(64, ahora - antes) : 16;
      antes = ahora;
      const objetivo = quieta() ? 0 : 1;
      v += (objetivo - v) * (1 - Math.exp(-dt / (FRENADA / 3)));
      if (Math.abs(objetivo - v) < 0.002) v = objetivo;
      t += v * dt;
      anim.currentTime = t;
      if (v !== objetivo) raf = requestAnimationFrame(paso);
      else {
        raf = 0;
        if (v === 1) anim.play();
      }
    };
    muelle.current = () => {
      if (!raf && estado.current.aLaVista && v !== (quieta() ? 0 : 1)) {
        anim.pause();
        t = anim.currentTime ?? 0;
        antes = 0;
        raf = requestAnimationFrame(paso);
      }
    };
    // Fuera de pantalla o con la pestaña oculta, en pausa (batería).
    let enPantalla = true;
    const actualizar = () => {
      estado.current.aLaVista = enPantalla && document.visibilityState === "visible";
      if (estado.current.aLaVista) {
        if (v === 1) anim.play();
        muelle.current();
      } else {
        anim.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const obs = new IntersectionObserver((entradas) => {
      enPantalla = entradas[entradas.length - 1].isIntersecting;
      actualizar();
    });
    obs.observe(caja);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      cancelAnimationFrame(raf);
      muelle.current = () => {};
      anim.cancel();
      tamano.disconnect();
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
    if (!estado.current.encima) {
      estado.current.encima = true;
      muelle.current();
    }
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
    muelle.current();
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
        if (!["touch", "pen"].includes(e.nativeEvent.pointerType)) return;
        estado.current.parada = !estado.current.parada;
        muelle.current();
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
