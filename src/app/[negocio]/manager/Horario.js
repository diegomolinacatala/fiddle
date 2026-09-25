"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { DIAS, ZONA_POR_DEFECTO, fechaLocal, resumenHorario } from "@/lib/horario";
import { C, campo, h2, botonPrimario, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// CUÁNDO ABRE LA TIENDA
// ----------------------------------------------------------------------------
// Lo usan los avisos automáticos: solo salen con la tienda abierta, y los
// "días seguidos" de la racha cuentan días de apertura (el domingo cerrado no
// la rompe). Y la tarjeta web dice con él si está abierta (app/AbiertoAhora.js).
// Guardarlo no toca ningún pase: Wallet no lo enseña, y la tarjeta web lo lee sola.
// ============================================================================

// Para una tienda que aún no lo ha puesto: un punto de partida, no un horario inventado.
const PARTIDA = {
  zona: ZONA_POR_DEFECTO,
  semana: [...Array(6).fill({ abre: "09:00", cierra: "20:00" }), null],
  cerrados: [],
};

const fechaBonita = (f) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function Horario({ slug, inicial, accent, flash, onGuardado }) {
  const [h, setH] = useState(inicial || PARTIDA);
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const hoy = fechaLocal(Date.now(), h.zona);
  const proximos = h.cerrados.filter((f) => f >= hoy);
  const cambiado = !inicial || JSON.stringify(h) !== JSON.stringify(inicial);

  const cambiarDia = (i, tramo) => setH((p) => ({ ...p, semana: p.semana.map((t, j) => (j === i ? tramo : t)) }));
  const quitarCerrado = (f) => setH((p) => ({ ...p, cerrados: p.cerrados.filter((x) => x !== f) }));
  function anadirCerrado(e) {
    e.preventDefault();
    if (!fecha || h.cerrados.includes(fecha)) return setFecha("");
    setH((p) => ({ ...p, cerrados: [...p.cerrados, fecha].sort() }));
    setFecha("");
  }

  async function guardar() {
    setGuardando(true);
    try {
      // Los días cerrados que ya pasaron no sirven de nada: fuera.
      const horario = { ...h, cerrados: h.cerrados.filter((f) => f >= hoy) };
      const r = await fetch(`/api/negocio?b=${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horario }),
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || "No se pudo guardar el horario");
      setH(data.horario);
      onGuardado(data);
      flash("Horario guardado");
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div id="horario" style={{ scrollMarginTop: 20 }}>
      <h2 style={h2}>Horario</h2>
      <p style={texto}>
        {inicial ? resumenHorario(inicial) : "Sin horario: los avisos automáticos no salen hasta que lo guardes."}
        {" "}Los avisos automáticos solo salen con la tienda abierta.
      </p>

      <div style={{ display: "grid", gap: 6 }}>
        {DIAS.map((dia, i) => {
          const t = h.semana[i];
          return (
            <div key={dia} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 38 }}>
              {/* "Lun", "Mié": con el nombre entero, la fila no cabe en la columna del manager. */}
              <label title={dia} style={{ display: "flex", alignItems: "center", gap: 7, width: 62, flexShrink: 0, fontSize: 14, cursor: "pointer", textTransform: "capitalize" }}>
                <input
                  type="checkbox" checked={Boolean(t)} aria-label={`${dia}: abre`}
                  onChange={(e) => cambiarDia(i, e.target.checked ? { abre: "09:00", cierra: "20:00" } : null)}
                />
                {dia.slice(0, 3)}
              </label>
              {t ? (
                <>
                  <input type="time" aria-label={`${dia}: hora de abrir`} value={t.abre} step={300} onChange={(e) => cambiarDia(i, { ...t, abre: e.target.value })} style={hora} />
                  <span style={{ color: C.tenue }}>a</span>
                  <input type="time" aria-label={`${dia}: hora de cerrar`} value={t.cierra} step={300} onChange={(e) => cambiarDia(i, { ...t, cierra: e.target.value })} style={hora} />
                </>
              ) : (
                <span style={{ fontSize: 13, color: C.tenue }}>Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ ...texto, margin: "14px 0 8px" }}>Días cerrados (festivos, vacaciones):</p>
      {proximos.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {proximos.map((f) => (
            <li key={f} style={chip}>
              {fechaBonita(f)}
              <button type="button" onClick={() => quitarCerrado(f)} aria-label={`Quitar ${fechaBonita(f)}`} style={quitar}>
                <Icono nombre="cerrar" tam={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={anadirCerrado} style={{ display: "flex", gap: 8 }}>
        <input type="date" aria-label="Día cerrado" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} style={{ ...campo, width: "auto", flex: 1 }} />
        <button type="submit" disabled={!fecha} style={botonPequeno}>Añadir</button>
      </form>

      <button
        type="button" onClick={guardar} disabled={guardando || !cambiado}
        style={{ ...botonPrimario(accent), marginTop: 14, opacity: guardando || !cambiado ? 0.45 : 1 }}
      >
        {guardando ? "Guardando…" : "Guardar horario"}
      </button>
    </div>
  );
}

const texto = { color: C.suave, fontSize: 13, margin: "-6px 0 10px" };
// Las dos horas se reparten lo que quede de fila: en la columna estrecha del
// manager, con ancho fijo, el cierre se salía y la página entera hacía scroll.
const hora = { ...campo, width: "auto", flex: "1 1 0", minWidth: 0, padding: "0.45rem 0.4rem", fontSize: 14 };
const chip = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 4px 3px 9px", fontSize: 13,
  border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, background: C.panelSuave,
};
const quitar = { border: 0, background: "transparent", padding: 4, cursor: "pointer", color: C.suave, display: "inline-flex" };
