"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { DIAS, DIAS_CORTOS, diaDeFecha, sumarDias } from "@/lib/horario";
import { C, RADIO } from "@/app/ui";

// ============================================================================
// FESTIVOS Y VACACIONES, EN UN CALENDARIO
// ----------------------------------------------------------------------------
// Un mes a la vista y un toque por día: cerrado / abierto. Nada de elegir una
// fecha en un selector y apilar etiquetas debajo: así se ven de golpe las
// vacaciones de agosto o el puente de diciembre, y se quitan igual de rápido.
//
// Los días que la tienda cierra cada semana (el domingo) salen apagados y no se
// tocan: ya están cerrados por el horario. Los pasados, tampoco.
// ============================================================================

const MESES_ADELANTE = 12;

// "Octubre de 2026": solo la primera en mayúscula (text-transform pondría "De").
const nombreMes = (mes) => {
  const t = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const sumarMeses = (mes, n) => {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

const diasDelMes = (mes) => {
  const siguiente = `${sumarMeses(mes, 1)}-01`;
  const out = [];
  for (let f = `${mes}-01`; f < siguiente; f = sumarDias(f, 1)) out.push(f);
  return out;
};

export default function CalendarioCerrados({ horario, hoy, accent, onAlternar }) {
  const primero = hoy.slice(0, 7);
  const [mes, setMes] = useState(primero);
  const dias = diasDelMes(mes);
  const hueco = diaDeFecha(dias[0]);
  const cerrados = new Set(horario.cerrados);
  const enEsteMes = dias.filter((f) => cerrados.has(f)).length;
  const proximos = horario.cerrados.filter((f) => f >= hoy).length;

  return (
    <div style={caja}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} disabled={mes <= primero} aria-label="Mes anterior" style={flecha(mes <= primero)}>
          <Icono nombre="volver" tam={16} />
        </button>
        <strong style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 650 }} aria-live="polite">
          {nombreMes(mes)}
          {enEsteMes > 0 && <span style={{ color: C.mal, fontWeight: 500 }}> · {enEsteMes} {enEsteMes === 1 ? "cerrado" : "cerrados"}</span>}
        </strong>
        <button
          type="button" onClick={() => setMes(sumarMeses(mes, 1))} disabled={mes >= sumarMeses(primero, MESES_ADELANTE)}
          aria-label="Mes siguiente" style={flecha(mes >= sumarMeses(primero, MESES_ADELANTE))}
        >
          <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icono nombre="volver" tam={16} /></span>
        </button>
      </div>

      <div role="grid" aria-label={`Días de ${nombreMes(mes)}`} style={rejilla}>
        {DIAS_CORTOS.map((d) => <span key={d} aria-hidden style={cabecera}>{d}</span>)}
        {Array.from({ length: hueco }, (_, i) => <span key={`h${i}`} />)}
        {dias.map((f) => {
          const semanal = !horario.semana[diaDeFecha(f)];
          const pasado = f < hoy;
          const cerrado = cerrados.has(f);
          const nombre = new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
          if (semanal || pasado) {
            return (
              <span
                key={f} style={celda("apagado", accent, f === hoy)}
                title={semanal ? `Cierra todos los ${DIAS[diaDeFecha(f)]}${DIAS[diaDeFecha(f)].endsWith("s") ? "" : "s"}` : undefined}
              >
                {Number(f.slice(8))}
              </span>
            );
          }
          return (
            <button
              key={f} type="button" onClick={() => onAlternar(f)} aria-pressed={cerrado}
              aria-label={`${nombre}: ${cerrado ? "cerrado, toca para abrir" : "abierto, toca para cerrar"}`}
              style={celda(cerrado ? "cerrado" : "abierto", accent, f === hoy)}
            >
              {Number(f.slice(8))}
            </button>
          );
        })}
      </div>

      <p style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "10px 0 0", fontSize: 12, color: C.tenue }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={muestra("cerrado")} /> Cerrado</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={muestra("apagado")} /> Cierra siempre</span>
        <span style={{ marginLeft: "auto" }}>{proximos ? `${proximos} ${proximos === 1 ? "día cerrado" : "días cerrados"} por delante` : "Ningún festivo marcado"}</span>
      </p>
    </div>
  );
}

const caja = { border: `1px solid ${C.borde}`, borderRadius: RADIO.fila, padding: 10, background: C.panelSuave };
const rejilla = { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 };
const cabecera = { textAlign: "center", fontSize: 11, fontWeight: 600, color: C.tenue, padding: "2px 0 4px" };
const flecha = (off) => ({
  width: 30, height: 30, display: "grid", placeItems: "center", padding: 0, border: `1px solid ${C.borde}`,
  borderRadius: RADIO.boton, background: "#fff", color: C.suave, cursor: off ? "default" : "pointer", opacity: off ? 0.35 : 1,
});

// Tres aspectos: abierto (blanco, se toca), cerrado (rojo, tachado: se ve de lejos)
// y apagado (pasado o cierre semanal: no se toca). Hoy lleva el borde del acento.
function celda(tipo, accent, esHoy) {
  const base = {
    height: 34, display: "grid", placeItems: "center", fontSize: 13, fontVariantNumeric: "tabular-nums",
    // Borde por partes, nunca `border` + `borderColor`: React avisa al cambiar
    // solo el color cuando un día pasa de abierto a cerrado.
    borderRadius: 8, padding: 0, fontFamily: "inherit", borderWidth: 1, borderStyle: "solid", borderColor: esHoy ? accent : "transparent",
  };
  if (tipo === "cerrado") {
    return { ...base, cursor: "pointer", background: C.malFondo, color: C.mal, fontWeight: 650, textDecoration: "line-through", borderColor: esHoy ? accent : "#f5c2bd" };
  }
  if (tipo === "apagado") return { ...base, color: C.bordeFuerte, background: "transparent" };
  return { ...base, cursor: "pointer", background: "#fff", color: C.texto, borderColor: esHoy ? accent : C.borde };
}

const muestra = (tipo) => ({
  width: 12, height: 12, borderRadius: 3, display: "inline-block",
  ...(tipo === "cerrado" ? { background: C.malFondo, border: "1px solid #f5c2bd" } : { background: C.borde }),
});
