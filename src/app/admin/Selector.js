"use client";

import { useEffect, useRef, useState } from "react";
import { comoDataUri } from "@/lib/apple/dibujo";
import { C, etiqueta as estiloEtiqueta } from "@/app/ui";

// ============================================================================
// SELECTOR CON MINIATURAS
// ----------------------------------------------------------------------------
// Un desplegable normal obliga a leer "hexagono" y a imaginárselo. Aquí se
// toca el botón, se abre una rejilla con TODAS las opciones dibujadas (con el
// color de esta tienda) y se elige viéndolas. Las miniaturas salen de vistas.js,
// que a su vez usa las funciones del pase de verdad.
// ============================================================================

/**
 * @param {object} props
 * @param {string} props.titulo        lo que va encima ("Marca", "Casilla del sello"…)
 * @param {string} props.valor         opción elegida
 * @param {string[]} props.opciones    todas las posibles
 * @param {(v:string)=>string} props.vista   SVG de la miniatura de una opción
 * @param {Record<string,string>} props.rotulos  nombre legible de cada opción
 * @param {(v:string)=>void} props.onChange
 * @param {number} [props.ancho]       ancho de cada miniatura en la rejilla
 */
export default function Selector({ titulo, valor, opciones, vista, rotulos, onChange, ancho = 96 }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // Cerrar al tocar fuera o con Escape: es un menú, no un diálogo.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const nombre = rotulos?.[valor] || valor;

  return (
    <div ref={caja} style={{ position: "relative" }}>
      <label style={estiloEtiqueta}>{titulo}</label>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} style={boton}>
        <Mini svg={vista(valor)} alto={26} />
        <span style={{ flex: 1, textAlign: "left" }}>{nombre}</span>
        <span style={{ color: C.tenue, fontSize: 11 }}>{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div style={panel}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${ancho}px, 1fr))`, gap: 8 }}>
            {opciones.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setAbierto(false); }}
                aria-pressed={o === valor}
                style={opcion(o === valor)}
                title={rotulos?.[o] || o}
              >
                <Mini svg={vista(o)} alto={44} />
                <span style={{ fontSize: 11, lineHeight: 1.2, color: o === valor ? C.texto : C.suave }}>
                  {rotulos?.[o] || o}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** El SVG de la miniatura, sin recortar y sin estirarlo. */
function Mini({ svg, alto }) {
  if (!svg) return <span style={{ height: alto, display: "block" }} />;
  return (
    <img
      src={comoDataUri(svg)}
      alt=""
      style={{ height: alto, maxWidth: "100%", objectFit: "contain", display: "block" }}
    />
  );
}

const boton = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.borde}`,
  background: C.panel, color: C.texto, font: "inherit", fontSize: 14, cursor: "pointer",
};

const panel = {
  position: "absolute", zIndex: 40, top: "100%", left: 0, marginTop: 6,
  width: "min(420px, 84vw)", maxHeight: 340, overflowY: "auto",
  background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 12,
  boxShadow: "0 12px 32px rgba(16,20,28,.18)", padding: 10,
};

const opcion = (activa) => ({
  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  padding: 8, borderRadius: 10, cursor: "pointer", textAlign: "center",
  border: `2px solid ${activa ? "#2563eb" : "transparent"}`,
  background: activa ? "#eff4ff" : C.panelSuave || "#f7f8fa",
});
