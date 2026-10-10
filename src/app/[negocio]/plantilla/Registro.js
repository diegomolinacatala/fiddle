"use client";

import { useEffect, useMemo, useState } from "react";
import Icono from "@/app/Icono";
import { csvRegistro } from "@/lib/exportar";
import { diaCortoTexto } from "@/lib/actividad";
import Exportar, { bajarCsv } from "../crm/Exportar";
import { Punto } from "./graficas";
import { C, panel, campo, h2, botonPequeno, chipCodigo } from "@/app/ui";

// ============================================================================
// REGISTRO: cada movimiento del periodo, con quién lo hizo
// ----------------------------------------------------------------------------
// La lista detrás de las cuentas: para mirar una franja, un día o a una persona
// movimiento a movimiento, y para bajarla en una hoja. Sin nombres de clientes
// (solo el código), como la Actividad de Clientes. Las filas salen de
// movimientosDePlantilla (lib/plantilla.js).
// ============================================================================

const POR_PAGINA = 150;

export default function Registro({ movimientos, filas, codigoDe, dias, accent, slug, colorDe }) {
  const [quien, setQuien] = useState("");
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const personas = useMemo(() => filas.filter((f) => f.movimientos > 0), [filas]);

  useEffect(() => setMostrar(POR_PAGINA), [quien, dias]);
  // Al acortar el periodo, la persona elegida puede quedarse sin movimientos: a «Todo el equipo».
  useEffect(() => {
    if (quien && !personas.some((f) => f.clave === quien)) setQuien("");
  }, [personas, quien]);

  const lista = useMemo(() => (quien ? movimientos.filter((m) => m.autor === quien) : movimientos), [movimientos, quien]);
  const nombreDe = (clave) => filas.find((f) => f.clave === clave)?.nombre || clave;
  const fuera = lista.filter((m) => m.fueraDeHorario).length;

  function descargar() {
    const csv = csvRegistro({ filas: lista, codigoDe });
    bajarCsv({ csv, fichero: `${slug}-plantilla-${dias}d${quien ? `-${quien.replace(/^e:/, "")}` : ""}.csv`, slug, cuantos: lista.length, que: "plantilla-registro" });
  }

  return (
    <section style={panel}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
        <select value={quien} onChange={(e) => setQuien(e.target.value)} aria-label="Persona" style={{ ...campo, width: "auto", padding: "0.5rem 0.75rem" }}>
          <option value="">Todo el equipo</option>
          {personas.map((f) => <option key={f.clave} value={f.clave}>{f.nombre}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <Exportar
          cuantos={lista.length} accent={accent} onDescargar={descargar}
          titulo={`Descargar los ${lista.length} movimientos de estos ${dias} días`}
          explicacion={<>
            <p style={parrafo}>
              Una fila por movimiento: fecha, hora, código de la tarjeta, qué se hizo y quién. Se abre con <strong>Excel</strong>,
              Numbers o Google Sheets.
            </p>
            <p style={{ ...parrafo, color: C.tenue }}>No lleva nombres de clientes. Queda apuntado que la descargaste.</p>
          </>}
        />
      </div>

      <h2 style={{ ...h2, margin: "18px 0 4px" }}>
        {quien ? nombreDe(quien) : "Todo el equipo"}, {lista.length} {lista.length === 1 ? "movimiento" : "movimientos"}
      </h2>
      <p style={{ fontSize: 13, color: C.suave, margin: "0 0 14px" }}>
        Del más reciente al más antiguo. {fuera > 0 ? `${fuera} con la tienda cerrada según el horario, marcados.` : "Ninguno con la tienda cerrada."}
      </p>

      {!lista.length ? (
        <p style={nota}>No hay movimientos en estos {dias} días{quien ? " de esta persona" : ""}.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tabla}>
            <thead>
              <tr>{["Día", "Hora", "Cliente", "Qué", "Quién"].map((x) => <th key={x} style={th}>{x}</th>)}</tr>
            </thead>
            <tbody>
              {lista.slice(0, mostrar).map((m, i) => (
                <tr key={`${m.ts}-${i}`} style={{ background: m.fueraDeHorario ? "#fff7ed" : undefined }}>
                  <td style={td}>{diaCortoTexto(m.fecha)}</td>
                  <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{m.hora}</td>
                  <td style={td}><span style={chipCodigo(accent)}>{codigoDe(m.serial)}</span></td>
                  <td style={{ ...td, color: m.clase === "correccion" ? C.mal : C.texto }}>
                    {m.mensaje}
                    {m.fueraDeHorario && (
                      <span style={{ marginLeft: 8, color: "#9a3412", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "-2px" }}>
                        <Icono nombre="reloj" tam={13} /> fuera de horario
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: C.suave }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Punto color={colorDe(m.autor)} /> {m.quien}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > mostrar && (
            <button type="button" onClick={() => setMostrar((v) => v + POR_PAGINA)} style={{ ...botonPequeno, marginTop: 12 }}>
              Ver {Math.min(POR_PAGINA, lista.length - mostrar)} más
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const parrafo = { margin: "0 0 8px", color: C.suave };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle", whiteSpace: "nowrap" };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
