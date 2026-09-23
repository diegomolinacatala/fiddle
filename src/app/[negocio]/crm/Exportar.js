"use client";

import { useState } from "react";
import { C, panel, botonPrimario, botonPequeno } from "@/app/ui";

// "Exportar" no descarga a ciegas: primero dice qué hay en el fichero y qué se
// puede hacer con él. La mayoría de dueños no sabe qué es un CSV.
export default function Exportar({ href, accent, texto = "Exportar", queContiene = "tus clientes", alinear = "derecha" }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} style={botonPequeno}>
        {texto}
      </button>
      {abierto && (
        <div role="dialog" aria-label="Exportar" style={{ ...caja, [alinear === "derecha" ? "right" : "left"]: 0 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 650 }}>Descargar {queContiene} en una hoja de cálculo</p>
          <p style={parrafo}>
            Una fila por cliente: código, nombre, estado, visitas, sellos, premios, fechas y notas.
            Se abre con <strong>Excel</strong>, Numbers o Google Sheets.
          </p>
          <p style={parrafo}>
            También puedes subirla a una IA (ChatGPT, Claude…) y preguntarle, por ejemplo,
            «¿qué clientes han dejado de venir?».
          </p>
          <p style={{ ...parrafo, color: C.tenue }}>Lleva nombres y notas de clientes: no la compartas.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a href={href} onClick={() => setAbierto(false)} style={{ ...botonPrimario(accent), textDecoration: "none", padding: "0.5rem 0.95rem", fontSize: 14 }}>
              Descargar
            </a>
            <button type="button" onClick={() => setAbierto(false)} style={botonPequeno}>Cancelar</button>
          </div>
        </div>
      )}
    </span>
  );
}

const caja = {
  ...panel,
  position: "absolute", top: "calc(100% + 8px)", zIndex: 20,
  width: "min(340px, 88vw)", padding: 16, fontSize: 14, lineHeight: 1.5,
  boxShadow: "0 12px 32px -12px rgba(16,20,28,.3)",
};
const parrafo = { margin: "0 0 8px", color: C.suave };
