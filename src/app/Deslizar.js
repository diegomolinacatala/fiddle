"use client";

import { useEffect, useRef } from "react";
import Icono from "@/app/Icono";
import { C, RADIO, tinte } from "@/app/ui";
import { progresoDe, confirmaAlSoltar, velocidadDe, UMBRAL } from "@/lib/deslizar";

// ============================================================================
// DESLIZAR PARA CONFIRMAR: para lo que no debe pasar con un toque sin querer
// ----------------------------------------------------------------------------
// Un carril con un tirador a la izquierda: se arrastra a la derecha y, al
// soltar, confirma (cuándo basta, en lib/deslizar.js). Si no llega, vuelve
// solo. Un toque no hace nada: el tirador se asoma un poco y vuelve, que es
// como se aprende que se desliza.
//
// El dedo se escribe en el DOM (refs), no en el estado de React: cada
// movimiento sería un render de toda la ficha de la caja y se movería a
// tirones. Solo se anima lo que no hace el dedo: la vuelta, el final y el asomo.
//
// `touch-action: pan-y`: en vertical la página sigue haciendo scroll; en
// horizontal, el carril es del dedo. Se puede empezar en cualquier punto del
// carril: cuenta lo que se mueve el dedo, no dónde cae.
//
// Con el teclado, el tirador es un botón: Intro, espacio o → lo llevan al final.
// ============================================================================

const TIRADOR = 48;
const HUECO = 4;
const SUAVE = "cubic-bezier(.22, 1, .36, 1)";
const RELLENO = tinte(C.texto, 7);
const RELLENO_PASADO = tinte(C.texto, 13);

/**
 * @param {{titulo:string, texto?:string|null, etiqueta?:string, icono?:string, onConfirmar:Function, style?:object}} props
 *   `etiqueta`: lo que oye un lector de pantalla (por defecto, el título).
 */
export default function Deslizar({ titulo, texto = null, etiqueta = titulo, icono = "deshacer", onConfirmar, style }) {
  const carril = useRef(null);
  const tirador = useRef(null);
  const relleno = useRef(null);
  const letrero = useRef(null);
  const dedo = useRef(null);
  const hecho = useRef(false);
  const relojes = useRef([]);

  useEffect(() => {
    const pendientes = relojes.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);
  const despues = (ms, fn) => relojes.current.push(setTimeout(fn, ms));
  const quieto = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const recorrido = () => (carril.current ? carril.current.clientWidth - TIRADOR - HUECO * 2 : 0);

  /** Pone el tirador en `p` (0 a 1): al momento con el dedo, o en `ms` cuando se mueve solo. */
  function pintar(p, ms = 0) {
    if (!tirador.current || !relleno.current || !letrero.current) return;
    const x = p * recorrido();
    const t = ms && !quieto() ? ` ${ms}ms ${SUAVE}` : null;
    tirador.current.style.transition = t ? `transform${t}` : "none";
    relleno.current.style.transition = t ? `width${t}, opacity${t}, background-color 120ms` : "background-color 120ms";
    letrero.current.style.transition = t ? `opacity${t}` : "none";
    tirador.current.style.transform = `translateX(${x}px)`;
    // El rastro que deja el tirador: quieto no se ve (sería un bloque gris a la izquierda) y
    // aparece en cuanto se mueve; pasado el umbral, más oscuro: soltar ya confirma.
    relleno.current.style.width = `${x + TIRADOR + HUECO * 2}px`;
    relleno.current.style.opacity = String(Math.min(1, p * 4));
    relleno.current.style.backgroundColor = p >= UMBRAL ? RELLENO_PASADO : RELLENO;
    letrero.current.style.opacity = String(Math.max(0, 1 - p * 1.8));
  }

  /** Dónde se ve ahora el tirador (también a media vuelta), en px. */
  function dondeEsta() {
    const m = getComputedStyle(tirador.current).transform;
    return m && m !== "none" ? new DOMMatrixReadOnly(m).m41 : 0;
  }

  function alPulsar(e) {
    if (hecho.current || e.button > 0 || dedo.current) return;
    const x = dondeEsta();
    dedo.current = { id: e.pointerId, x0: e.clientX - x, inicio: e.clientX, p: progresoDe(x, recorrido()), movido: false, rastro: [{ x: e.clientX, t: e.timeStamp }] };
    carril.current.setPointerCapture?.(e.pointerId);
    carril.current.style.cursor = "grabbing";
    pintar(dedo.current.p);
  }

  function alMover(e) {
    const d = dedo.current;
    if (!d || e.pointerId !== d.id) return;
    if (Math.abs(e.clientX - d.inicio) > 4) d.movido = true;
    d.rastro.push({ x: e.clientX, t: e.timeStamp });
    if (d.rastro.length > 24) d.rastro.shift();
    const antes = d.p;
    d.p = progresoDe(e.clientX - d.x0, recorrido());
    // Un golpecito al cruzar el umbral: a partir de aquí, soltar ya confirma (Android; iOS no vibra).
    if (antes < UMBRAL && d.p >= UMBRAL) navigator.vibrate?.(8);
    pintar(d.p);
  }

  function alSoltar(e) {
    const d = dedo.current;
    if (!d || e.pointerId !== d.id) return;
    dedo.current = null;
    carril.current.style.cursor = "";
    d.rastro.push({ x: e.clientX, t: e.timeStamp });
    if (e.type === "pointercancel") return pintar(0, 380);
    if (!d.movido) return asomar();
    if (confirmaAlSoltar(d.p, velocidadDe(d.rastro))) return confirmar();
    pintar(0, 380);
  }

  function asomar() {
    if (quieto()) return pintar(0);
    pintar(0.14, 170);
    despues(190, () => { if (!dedo.current && !hecho.current) pintar(0, 420); });
  }

  function confirmar() {
    hecho.current = true;
    pintar(1, 180);
    despues(200, () => {
      onConfirmar?.();
      // Lo normal es que desaparezca al confirmar; si sigue en pantalla, vuelve a estar lista.
      despues(700, () => { hecho.current = false; pintar(0, 380); });
    });
  }

  function alTeclado(e) {
    if (!["Enter", " ", "ArrowRight", "End"].includes(e.key)) return;
    e.preventDefault();
    if (!hecho.current) confirmar();
  }

  return (
    <div
      ref={carril}
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      style={{
        position: "relative", overflow: "hidden", boxSizing: "border-box", minHeight: TIRADOR + HUECO * 2 + 2,
        display: "flex", alignItems: "center", padding: `${HUECO}px 12px ${HUECO}px ${TIRADOR + HUECO * 2 + 10}px`,
        borderRadius: RADIO.panel, border: `1px solid ${C.bordeFuerte}`, background: C.panel,
        touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", cursor: "grab",
        ...style,
      }}
    >
      <span ref={relleno} aria-hidden="true" style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: TIRADOR + HUECO * 2,
        background: RELLENO, borderRadius: RADIO.panel - 1, opacity: 0,
      }} />
      <span ref={letrero} aria-hidden="true" style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1, padding: "6px 0" }}>
          <span style={{ fontSize: 15, fontWeight: 650, color: C.texto }}>{titulo}</span>
          {texto && <span style={{ fontSize: 12.5, color: C.suave }}>{texto}</span>}
        </span>
        <span style={{ color: C.tenue, display: "inline-flex", flexShrink: 0 }}>
          <Icono nombre="adelante" tam={18} grosor={2.2} />
        </span>
      </span>
      <button
        ref={tirador}
        type="button"
        onKeyDown={alTeclado}
        aria-label={`${etiqueta}. Desliza a la derecha o pulsa Intro.`}
        style={{
          position: "absolute", left: HUECO, top: "50%", marginTop: -TIRADOR / 2, width: TIRADOR, height: TIRADOR,
          display: "grid", placeItems: "center", padding: 0, border: 0, borderRadius: RADIO.panel - HUECO,
          background: C.texto, color: C.panel, cursor: "inherit", touchAction: "pan-y",
          boxShadow: "0 1px 3px rgba(0, 0, 0, .2)",
        }}
      >
        <Icono nombre={icono} tam={20} grosor={2.2} />
      </button>
    </div>
  );
}
