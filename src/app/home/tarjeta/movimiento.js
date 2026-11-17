"use client";

import { useEffect, useState } from "react";

export const INCLINA = 9; // grados, con la tarjeta entera
export const INCLINA_CERCA = 4.5; // al acercarse, menos: que se lea

// ----------------------------------------------------------------------------
// La inclinación: un muelle hacia donde apunta el ratón (o hacia donde arrastra
// el dedo) y, sin nadie encima, una deriva lenta. Todo por transform y variables
// CSS, sin pasar por React.
// ----------------------------------------------------------------------------
export function useInclinacion({ escena, inclina, cerca, quieto }) {
  useEffect(() => {
    const raiz = escena.current;
    const el = inclina.current;
    if (!raiz || !el) return undefined;
    if (quieto) {
      el.style.transform = "";
      return undefined;
    }

    const objetivo = { x: 0, y: 0 };
    const ahora = { x: 0, y: 0, amp: INCLINA };
    let encima = false; // ratón dentro, o dedo arrastrando
    let dedo = null;
    let raf = 0;
    let antes = 0;

    const pintar = () => {
      const { x, y, amp } = ahora;
      el.style.transform = `rotateX(${(-y * amp).toFixed(3)}deg) rotateY(${(x * amp).toFixed(3)}deg)`;
      el.style.setProperty("--bx", `${(50 + x * 42).toFixed(2)}%`);
      el.style.setProperty("--by", `${(38 + y * 38).toFixed(2)}%`);
      el.style.setProperty("--sx", `${(-x * 16).toFixed(2)}px`);
      el.style.setProperty("--sy", `${(-y * 10).toFixed(2)}px`);
      el.style.setProperty("--brillo", (0.55 + Math.hypot(x, y) * 0.45).toFixed(3));
    };

    const paso = (t) => {
      const dt = antes ? Math.min(64, t - antes) : 16;
      antes = t;
      // Sin nadie encima, flota: dos senos lentos que no se repiten a la vista.
      const tx = encima ? objetivo.x : Math.sin(t / 2600) * 0.32;
      const ty = encima ? objetivo.y : Math.cos(t / 3400) * 0.22;
      const k = 1 - Math.exp(-dt / (encima ? 120 : 520));
      ahora.x += (tx - ahora.x) * k;
      ahora.y += (ty - ahora.y) * k;
      ahora.amp += ((cerca.current ? INCLINA_CERCA : INCLINA) - ahora.amp) * (1 - Math.exp(-dt / 300));
      pintar();
      raf = requestAnimationFrame(paso);
    };
    const arrancar = () => {
      if (!raf && document.visibilityState === "visible") {
        antes = 0;
        raf = requestAnimationFrame(paso);
      }
    };
    const parar = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const hacia = (cx, cy) => {
      const c = raiz.getBoundingClientRect();
      objetivo.x = Math.max(-1, Math.min(1, (cx - (c.left + c.width / 2)) / (c.width / 2)));
      objetivo.y = Math.max(-1, Math.min(1, (cy - (c.top + c.height / 2)) / (c.height / 2)));
    };

    const mover = (ev) => {
      if (ev.pointerType === "mouse") {
        const c = raiz.getBoundingClientRect();
        encima = ev.clientX >= c.left && ev.clientX <= c.right && ev.clientY >= c.top && ev.clientY <= c.bottom;
        if (encima) hacia(ev.clientX, ev.clientY);
      } else if (dedo && ev.pointerId === dedo.id) {
        // Con el dedo, se inclina hacia donde arrastra (un toque no la mueve).
        objetivo.x = Math.max(-1, Math.min(1, (ev.clientX - dedo.x) / 110));
        objetivo.y = Math.max(-1, Math.min(1, (ev.clientY - dedo.y) / 110));
        encima = true;
      }
    };
    const bajar = (ev) => {
      if (ev.pointerType !== "mouse") dedo = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    };
    const soltar = (ev) => {
      if (dedo && ev.pointerId === dedo.id) {
        dedo = null;
        encima = false;
      }
    };
    const salir = () => { encima = false; };
    const visibilidad = () => (document.visibilityState === "visible" ? arrancar() : parar());

    window.addEventListener("pointermove", mover, { passive: true });
    raiz.addEventListener("pointerdown", bajar, { passive: true });
    window.addEventListener("pointerup", soltar, { passive: true });
    window.addEventListener("pointercancel", soltar, { passive: true });
    document.documentElement.addEventListener("pointerleave", salir);
    document.addEventListener("visibilitychange", visibilidad);
    arrancar();
    return () => {
      parar();
      window.removeEventListener("pointermove", mover);
      raiz.removeEventListener("pointerdown", bajar);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      document.documentElement.removeEventListener("pointerleave", salir);
      document.removeEventListener("visibilitychange", visibilidad);
    };
  }, [escena, inclina, cerca, quieto]);
}

// ----------------------------------------------------------------------------
// Con el teclado abierto, el probador mide lo que queda a la vista (visualViewport):
// en iPhone un `position: fixed` sigue midiendo la pantalla entera y el teclado
// tapaba el panel con el email o el nombre que se estaba escribiendo.
// ----------------------------------------------------------------------------
export function useAltoVisible(raiz) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = raiz.current;
    if (!vv || !el) return undefined;
    const ajustar = () => {
      const tapado = window.innerHeight - vv.height > 80;
      el.style.height = tapado ? `${vv.height}px` : "";
      el.style.top = tapado ? `${vv.offsetTop}px` : "";
      el.style.bottom = tapado ? "auto" : "";
    };
    vv.addEventListener("resize", ajustar);
    vv.addEventListener("scroll", ajustar);
    return () => {
      vv.removeEventListener("resize", ajustar);
      vv.removeEventListener("scroll", ajustar);
    };
  }, [raiz]);
}

export function useReducirMovimiento() {
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mirar = () => setQuieto(mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => mq.removeEventListener("change", mirar);
  }, []);
  return quieto;
}
