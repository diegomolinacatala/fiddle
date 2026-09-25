"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { C, panel, botonPrimario, botonPequeno } from "@/app/ui";

// El ÚNICO sitio desde el que se exporta: junto a la lista de clientes, y baja
// justo esa lista (con la búsqueda y el grupo que se estén viendo). Antes había
// un botón en cada pestaña y otro en cada grupo, y no se sabía qué bajaba cada uno.
//
// No descarga a ciegas: primero dice qué hay en el fichero y qué se puede hacer
// con él. La mayoría de dueños no sabe qué es un CSV.
export default function Exportar({ cuantos, queContiene, accent, onDescargar }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} disabled={!cuantos}
        style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6, height: "100%", opacity: cuantos ? 1 : 0.5 }}
      >
        <Icono nombre="descargar" tam={15} /> Exportar
      </button>
      {abierto && (
        <div role="dialog" aria-label="Exportar" style={caja}>
          <p style={{ margin: "0 0 8px", fontWeight: 650 }}>
            Descargar {cuantos} {cuantos === 1 ? "cliente" : "clientes"} en una hoja de cálculo
          </p>
          <p style={parrafo}>
            {queContiene}. Una fila por cliente: código, nombre, estado, visitas, sellos, premios, fechas y notas.
            Se abre con <strong>Excel</strong>, Numbers o Google Sheets.
          </p>
          <p style={parrafo}>
            También puedes subirla a una IA (ChatGPT, Claude…) y preguntarle, por ejemplo,
            «¿qué clientes han dejado de venir?».
          </p>
          <p style={{ ...parrafo, color: C.tenue }}>Lleva nombres y notas de clientes: no la compartas.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => { onDescargar(); setAbierto(false); }} style={{ ...botonPrimario(accent), padding: "0.5rem 0.95rem" }}>
              Descargar
            </button>
            <button type="button" onClick={() => setAbierto(false)} style={botonPequeno}>Cancelar</button>
          </div>
        </div>
      )}
    </span>
  );
}

const caja = {
  ...panel,
  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 20,
  width: "min(340px, 88vw)", padding: 16, fontSize: 14, lineHeight: 1.5,
  boxShadow: "0 12px 32px -12px rgba(16,20,28,.3)",
};
const parrafo = { margin: "0 0 8px", color: C.suave };
