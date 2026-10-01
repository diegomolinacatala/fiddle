"use client";

import Icono from "@/app/Icono";
import { C, RADIO } from "@/app/ui";

// ============================================================================
// ENCENDIDO / APAGADO — el mismo en todas las pantallas
// ----------------------------------------------------------------------------
// Para lo que se enciende y se apaga, un interruptor, nunca una casilla: una
// casilla vacía no dice "apagado", parece un formulario a medias. Rectángulo
// redondeado, no píldora, como el resto de lo que se pulsa (ui.js, RADIO).
//
//   <Interruptor>       solo el interruptor (al lado del nombre de una regla)
//   <FilaInterruptor>   una fila entera que se pulsa: título, explicación y el
//                       interruptor a la derecha (ajustes de la tienda, la caja)
// ============================================================================

export function Interruptor({ on, onClick, accent, disabled, etiqueta }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={`${etiqueta}: ${on ? "encendido" : "apagado"}`}
      onClick={onClick} disabled={disabled}
      style={{ border: 0, padding: 0, background: "none", cursor: disabled ? "default" : "pointer", flexShrink: 0, display: "inline-flex" }}
    >
      <Palanca on={on} accent={accent} />
    </button>
  );
}

/**
 * @param {{on:boolean, onClick:Function, accent:string, titulo:React.ReactNode, texto?:React.ReactNode, icono?:string, disabled?:boolean, style?:object}} props
 */
export function FilaInterruptor({ on, onClick, accent, titulo, texto = null, icono = null, disabled = false, style, ...resto }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} disabled={disabled} {...resto} style={{
      display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left", padding: "11px 13px",
      borderRadius: RADIO.fila, border: `1px solid ${on ? accent : C.borde}`, background: on ? `${accent}0d` : "#fff",
      cursor: disabled ? "default" : "pointer", font: "inherit", color: C.texto, opacity: disabled ? 0.6 : 1, ...style,
    }}>
      {icono && <span style={{ color: accent, display: "inline-flex" }}><Icono nombre={icono} tam={20} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontWeight: 600, fontSize: 14, display: "block" }}>{titulo}</strong>
        {texto && <span style={{ color: C.suave, fontSize: 12.5, display: "block", marginTop: 1 }}>{texto}</span>}
      </span>
      <Palanca on={on} accent={accent} />
    </button>
  );
}

function Palanca({ on, accent }) {
  return (
    <span aria-hidden style={{
      width: 42, height: 24, borderRadius: 8, padding: 3, flexShrink: 0, boxSizing: "border-box", display: "flex",
      justifyContent: on ? "flex-end" : "flex-start", background: on ? accent : C.bordeFuerte, transition: "background .15s",
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 6, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }} />
    </span>
  );
}
