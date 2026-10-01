"use client";

import Icono from "@/app/Icono";
import { C, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// UNA FILA DE AJUSTE: la pieza con la que se arman Tienda y Ajustes
// ----------------------------------------------------------------------------
// Todas iguales, para que la pantalla se lea de un vistazo: el icono en su
// cuadrado del color de la tienda, el título, una línea con cómo está ahora y
// UN botón, siempre del mismo tipo. Lo que se pone una vez y se toca poco (el
// horario, el mapa) va plegado: la fila dice cómo está y el botón lo abre debajo.
//
// Antes cada trozo tenía su forma (un título grande, una etiqueta en
// mayúsculas, un botón de color y otro blanco) sin que eso quisiera decir nada.
// ============================================================================

/**
 * @param {object} props
 * @param {string} props.icono       nombre de Icono
 * @param {string} props.titulo
 * @param {React.ReactNode} props.resumen  cómo está ahora, en una línea
 * @param {{texto:string, icono?:string, onClick:Function}} [props.accion]
 * @param {boolean} [props.abierto]  si lo de dentro (children) se ve
 * @param {boolean} [props.falta]    el resumen en rojo: falta ponerlo
 * @param {string} props.accent
 */
export default function Bloque({ icono, titulo, resumen, accion = null, abierto = false, falta = false, accent, children = null, primero = false, ...resto }) {
  return (
    <div {...resto} style={{ padding: "14px 0", borderTop: primero ? "none" : `1px solid ${C.borde}`, scrollMarginTop: 20 }}>
      {/* El botón siempre debajo del resumen, alineado con el texto: al lado
          cabía en unas filas y en otras no, y cada una acababa con su forma. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: RADIO.boton, background: `${accent}14`, color: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icono nombre={icono} tam={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 650, margin: 0 }}>{titulo}</h2>
          <div style={{ fontSize: 13, color: falta ? C.mal : C.suave, marginTop: 2, lineHeight: 1.35 }}>{resumen}</div>
          {accion && (
            <button type="button" onClick={accion.onClick} aria-expanded={children ? abierto : undefined}
              style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9 }}>
              {accion.icono && <Icono nombre={accion.icono} tam={15} />}
              {accion.texto}
            </button>
          )}
        </div>
      </div>
      {abierto && children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}
