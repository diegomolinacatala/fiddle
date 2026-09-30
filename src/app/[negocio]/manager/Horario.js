"use client";

import { useEffect, useState } from "react";
import Icono from "@/app/Icono";
import { DIAS, ZONA_POR_DEFECTO, MAX_TRAMOS, aMinutos, aHora, fechaLocal, resumenHorario } from "@/lib/horario";
import CalendarioCerrados from "./CalendarioCerrados";
import { C, campo, h2, botonPrimario, RADIO } from "@/app/ui";

// ============================================================================
// CUÁNDO ABRE LA TIENDA
// ----------------------------------------------------------------------------
// Lo usan los avisos automáticos (solo salen con la tienda abierta, y la racha
// cuenta días de apertura), la tarjeta web ("Abierto hasta las 14:00") y el
// estado de la cabecera del pase de Wallet, que pone al día el reloj.
//
// Pensado para ponerlo en un minuto desde el móvil:
//   - cada día, uno o dos tramos: "+ tarde" parte el día en mañana y tarde;
//   - "copiar" pasa las horas de un día a todos los que abren;
//   - los festivos se tocan en un calendario: un toque cierra el día, otro lo abre.
//
// Plegado de partida: se pone una vez y se toca poco, y ocupaba media columna.
// Cerrado enseña el resumen ("L–V 9:00–14:00 y 17:00–20:30"); el calendario va
// plegado dentro. Se abre solo si llegan con #horario (el enlace de Avisos).
// Guardarlo no toca ningún pase a mano: el estado del pase lo mueve el reloj.
// ============================================================================

// Para una tienda que aún no lo ha puesto: un punto de partida, no un horario inventado.
const PARTIDA = {
  zona: ZONA_POR_DEFECTO,
  semana: [...Array(6).fill([{ abre: "09:00", cierra: "20:00" }]), null],
  cerrados: [],
};

const tramoValido = (t) => aMinutos(t.abre) !== null && aMinutos(t.cierra) !== null && aMinutos(t.abre) < aMinutos(t.cierra);

/**
 * Parte un tramo en mañana y tarde. Si cubre la hora de comer (14–17), se corta
 * ahí, que es lo normal; si no, la tarde empieza una hora después de cerrar.
 */
function partir(t) {
  const abre = aMinutos(t.abre);
  const cierra = aMinutos(t.cierra);
  if (abre < 14 * 60 && cierra > 17 * 60) return [{ abre: t.abre, cierra: "14:00" }, { abre: "17:00", cierra: t.cierra }];
  const tarde = Math.min(cierra + 60, 22 * 60);
  return [t, { abre: aHora(tarde), cierra: aHora(Math.min(tarde + 3 * 60, 23 * 60 + 55)) }];
}

export default function Horario({ slug, inicial, accent, flash, onGuardado }) {
  const [h, setH] = useState(inicial || PARTIDA);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [calendario, setCalendario] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#horario") setAbierto(true);
  }, []);
  const hoy = fechaLocal(Date.now(), h.zona);
  const cambiado = !inicial || JSON.stringify(h) !== JSON.stringify(inicial);
  const roto = h.semana.some((dia) => dia?.some((t) => !tramoValido(t)));

  const cambiarDia = (i, dia) => setH((p) => ({ ...p, semana: p.semana.map((d, j) => (j === i ? dia : d)) }));
  const cambiarTramo = (i, k, campoTramo, valor) =>
    cambiarDia(i, h.semana[i].map((t, j) => (j === k ? { ...t, [campoTramo]: valor } : t)));

  function copiarATodos(i) {
    const dia = h.semana[i];
    const otros = h.semana.filter((d, j) => j !== i && d).length;
    if (!otros) return flash("No hay otros días abiertos a los que copiarlo");
    setH((p) => ({ ...p, semana: p.semana.map((d, j) => (j !== i && d ? dia.map((t) => ({ ...t })) : d)) }));
    flash(`Horario del ${DIAS[i]} copiado a los demás días que abren`);
  }

  const alternarCerrado = (fecha) =>
    setH((p) => ({
      ...p,
      cerrados: p.cerrados.includes(fecha) ? p.cerrados.filter((f) => f !== fecha) : [...p.cerrados, fecha].sort(),
    }));

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

  const proximos = h.cerrados.filter((f) => f >= hoy).length;

  return (
    <div id="horario" style={{ scrollMarginTop: 20 }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-controls="horario-cuerpo" style={plegable}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...h2, display: "block", margin: 0 }}>Horario</span>
          <span style={{ display: "block", fontSize: 13, color: inicial ? C.suave : C.mal, marginTop: 3 }}>
            {inicial ? resumenHorario(inicial) : "Sin horario: los avisos automáticos no salen hasta que lo pongas."}
          </span>
        </span>
        <Flecha abierta={abierto} />
      </button>

      {abierto && (
      <div id="horario-cuerpo" style={{ marginTop: 12 }}>

      <div style={{ display: "grid", gap: 6 }}>
        {DIAS.map((dia, i) => {
          const tramos = h.semana[i];
          return (
            <div key={dia} style={{ display: "grid", gap: 4 }}>
              <div style={fila}>
                {/* "Lun", "Mié": con el nombre entero, la fila no cabe en la columna del manager. */}
                <label title={dia} style={nombreDia}>
                  <input
                    type="checkbox" checked={Boolean(tramos)} aria-label={`${dia}: abre`}
                    onChange={(e) => cambiarDia(i, e.target.checked ? [{ abre: "09:00", cierra: "20:00" }] : null)}
                  />
                  {dia.slice(0, 3)}
                </label>
                {tramos ? (
                  <>
                    <Tramo dia={dia} tramo={tramos[0]} parte={tramos.length > 1 ? "mañana" : null} onCambio={(k, v) => cambiarTramo(i, 0, k, v)} />
                    {tramos.length < MAX_TRAMOS ? (
                      <button type="button" onClick={() => cambiarDia(i, partir(tramos[0]))} title="Partir en mañana y tarde" aria-label={`${dia}: añadir horario de tarde`} style={iconoBoton}>
                        <Icono nombre="mas" tam={16} />
                      </button>
                    ) : <span style={{ width: 30, flexShrink: 0 }} />}
                    <button type="button" onClick={() => copiarATodos(i)} title="Copiar a los demás días que abren" aria-label={`Copiar el horario del ${dia} a los demás días`} style={iconoBoton}>
                      <Icono nombre="copiar" tam={15} />
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: C.tenue }}>Cerrado</span>
                )}
              </div>
              {tramos?.[1] && (
                <div style={fila}>
                  <span style={{ ...nombreDia, cursor: "default" }} />
                  <Tramo dia={dia} tramo={tramos[1]} parte="tarde" onCambio={(k, v) => cambiarTramo(i, 1, k, v)} />
                  <button type="button" onClick={() => cambiarDia(i, [tramos[0]])} title="Quitar la tarde" aria-label={`${dia}: quitar el horario de tarde`} style={iconoBoton}>
                    <Icono nombre="cerrar" tam={14} />
                  </button>
                  <span style={{ width: 30, flexShrink: 0 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: C.tenue, margin: "8px 0 0", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Icono nombre="mas" tam={13} /> parte el día en mañana y tarde · <Icono nombre="copiar" tam={13} /> lo copia a los demás días
      </p>
      {roto && <p role="alert" style={{ fontSize: 13, color: C.mal, margin: "8px 0 0" }}>Hay un tramo que cierra antes de abrir.</p>}

      <button
        type="button" onClick={() => setCalendario((v) => !v)} aria-expanded={calendario} aria-controls="horario-calendario"
        style={{ ...plegable, marginTop: 16, padding: "10px 12px", border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, background: "#fff" }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
          Festivos y vacaciones
          <span style={{ fontWeight: 400, color: proximos ? C.mal : C.tenue, marginLeft: 6 }}>
            {proximos ? `· ${proximos} ${proximos === 1 ? "día cerrado" : "días cerrados"}` : "· ninguno"}
          </span>
        </span>
        <Flecha abierta={calendario} />
      </button>
      {calendario && (
        <div id="horario-calendario" style={{ marginTop: 8 }}>
          <p style={{ ...texto, margin: "0 0 8px" }}>Toca un día para cerrarlo; otra vez, para abrirlo.</p>
          <CalendarioCerrados horario={h} hoy={hoy} accent={accent} onAlternar={alternarCerrado} />
        </div>
      )}

      <button
        type="button" onClick={guardar} disabled={guardando || !cambiado || roto}
        style={{ ...botonPrimario(accent), marginTop: 14, opacity: guardando || !cambiado || roto ? 0.45 : 1 }}
      >
        {guardando ? "Guardando…" : "Guardar horario"}
      </button>
      </div>
      )}
    </div>
  );
}

// La de "volver", girada: apunta abajo plegado y arriba desplegado.
function Flecha({ abierta }) {
  return (
    <span aria-hidden style={{ display: "inline-flex", color: C.suave, transform: `rotate(${abierta ? 90 : -90}deg)`, transition: "transform .15s" }}>
      <Icono nombre="volver" tam={18} />
    </span>
  );
}

function Tramo({ dia, tramo, parte, onCambio }) {
  const mal = !tramoValido(tramo);
  const estilo = mal ? { ...hora, borderColor: C.mal, color: C.mal } : hora;
  const de = parte ? `${dia} por la ${parte}` : dia;
  return (
    <>
      <input type="time" aria-label={`${de}: hora de abrir`} value={tramo.abre} step={300} onChange={(e) => onCambio("abre", e.target.value)} style={estilo} />
      <span style={{ color: C.tenue }}>–</span>
      <input type="time" aria-label={`${de}: hora de cerrar`} value={tramo.cierra} step={300} onChange={(e) => onCambio("cierra", e.target.value)} style={estilo} />
    </>
  );
}

const texto = { color: C.suave, fontSize: 13, margin: "-6px 0 10px" };
const plegable = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 0, border: 0, background: "transparent",
  textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.texto,
};
const fila = { display: "flex", alignItems: "center", gap: 5, minHeight: 38 };
const nombreDia = { display: "flex", alignItems: "center", gap: 7, width: 58, flexShrink: 0, fontSize: 14, cursor: "pointer", textTransform: "capitalize" };
// Las dos horas se reparten lo que quede de fila: en la columna estrecha del
// manager, con ancho fijo, el cierre se salía y la página entera hacía scroll.
const hora = { ...campo, width: "auto", flex: "1 1 0", minWidth: 0, padding: "0.45rem 0.3rem", fontSize: 14 };
const iconoBoton = {
  width: 30, height: 30, flexShrink: 0, display: "grid", placeItems: "center", padding: 0, cursor: "pointer",
  border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, background: "#fff", color: C.suave,
};
