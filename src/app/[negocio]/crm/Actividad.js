"use client";

import { useMemo, useState } from "react";
import Icono from "@/app/Icono";
import { actividadDelDia, diaCompleto, zonaDe } from "@/lib/actividad";
import { csvActividad, QUIEN, QUE } from "@/lib/exportar";
import { fechaLocal, sumarDias, abreEl } from "@/lib/horario";
import { cartillasDe } from "@/lib/cartillas";
import { Cifra } from "./piezas";
import Exportar, { bajarCsv } from "./Exportar";
import { C, panel, campo, h2, botonPequeno, chipCodigo } from "@/app/ui";

// ============================================================================
// ACTIVIDAD: ¿CUADRA CON LA CAJA?
// ----------------------------------------------------------------------------
// Un día de la tienda: cuántos sellos y premios salieron, a qué hora y quién los
// dio. Es lo que el dueño pone al lado de los tickets: cada sello debería tener
// su compra. Las cuentas, en lib/actividad.js; aquí solo se enseñan.
// ============================================================================

function nombreDelDia(fecha, hoy) {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";
  const t = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function Actividad({ d, n, slug, accent, onVerFicha }) {
  const zona = zonaDe(n);
  const hoy = fechaLocal(Date.now(), zona);
  const [fecha, setFecha] = useState(hoy);

  // El primer día del que está TODO (ver historialCompletoDesde en crmDatos).
  const primero = useMemo(() => {
    const desde = d.historialCompletoDesde;
    if (!desde) return null;
    const f = fechaLocal(Date.parse(desde), zona);
    return diaCompleto(f, zona, desde) ? f : sumarDias(f, 1);
  }, [d.historialCompletoDesde, zona]);

  const cartillas = n.tipo === "descuento" ? [] : cartillasDe({}, n);
  const dos = cartillas.length > 1;
  const act = useMemo(
    () => actividadDelDia(d.eventos, fecha, { zona, horario: n.horario, cartillas: Math.max(1, cartillas.length) }),
    [d.eventos, fecha, zona, n.horario, cartillas.length],
  );
  const porSerial = useMemo(() => new Map(d.clientes.map((c) => [c.serial, c])), [d.clientes]);
  const codigoDe = (serial) => porSerial.get(serial)?.codigo || "—";

  const completo = diaCompleto(fecha, zona, d.historialCompletoDesde);
  const nombre = nombreDelDia(fecha, hoy);
  const t = act.totales;
  const premios = t.porCartilla.reduce((a, k) => a + k.premios, 0);
  const guardados = t.porCartilla.reduce((a, k) => a + k.guardados, 0);
  const cerrada = n.horario && !abreEl(n.horario, fecha);

  function mover(dias) {
    const f = sumarDias(fecha, dias);
    if (f > hoy || (primero && f < primero)) return;
    setFecha(f);
  }

  function descargar() {
    const csv = csvActividad({ fecha, filas: act.filas, codigoDe, negocio: n });
    bajarCsv({ csv, fichero: `${slug}-actividad-${fecha}.csv`, slug, cuantos: act.filas.length, que: `actividad-${fecha}` });
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={panel}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
          <button type="button" onClick={() => mover(-1)} disabled={primero && fecha <= primero} aria-label="Día anterior" style={flecha}>‹</button>
          <input
            type="date" value={fecha} max={hoy} min={primero || undefined} aria-label="Día"
            onChange={(e) => e.target.value && setFecha(e.target.value > hoy ? hoy : e.target.value)}
            style={{ ...campo, width: "auto" }}
          />
          <button type="button" onClick={() => mover(1)} disabled={fecha >= hoy} aria-label="Día siguiente" style={flecha}>›</button>
          {fecha !== hoy && <button type="button" onClick={() => setFecha(hoy)} style={botonPequeno}>Hoy</button>}
          <span style={{ flex: 1 }} />
          <Exportar
            cuantos={completo ? act.filas.length : 0} accent={accent} onDescargar={descargar}
            titulo={`Descargar los ${act.filas.length} movimientos del ${fecha.split("-").reverse().join("/")}`}
            explicacion={<>
              <p style={parrafo}>
                Una fila por movimiento: hora, código de la tarjeta, qué se hizo y quién. Se abre con <strong>Excel</strong>,
                Numbers o Google Sheets, para ponerla al lado de los tickets del día.
              </p>
              <p style={{ ...parrafo, color: C.tenue }}>No lleva nombres de clientes. Queda apuntado que la descargaste.</p>
            </>}
          />
        </div>

        <h2 style={{ ...h2, margin: "18px 0 4px" }}>{nombre}</h2>
        <p style={{ fontSize: 13, color: C.suave, margin: "0 0 14px" }}>
          Cada sello debería ser una compra: compara estas cifras con los tickets del día. Si no cuadran, abajo está
          cada movimiento con su hora para encontrar cuál.
        </p>

        {!completo ? (
          <p style={nota}>De ese día ya no están todos los movimientos en el panel. Elige uno más reciente.</p>
        ) : !act.filas.length ? (
          <p style={nota}>{cerrada ? "La tienda cerraba ese día y no" : "No"} hubo movimientos en la caja.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {cartillas.map((k, i) => (
              <Cifra
                key={k.clave} label={dos ? `Sellos · ${k.nombre}` : "Sellos dados"} valor={t.porCartilla[i].sellos} accent={accent}
                pie={t.porCartilla[i].quitados ? `y ${t.porCartilla[i].quitados} quitado${t.porCartilla[i].quitados === 1 ? "" : "s"} al corregir` : "en la caja"}
              />
            ))}
            <Cifra
              label={n.tipo === "descuento" ? "Cupones usados" : "Premios"} valor={premios}
              pie={guardados ? `y ${guardados} guardado${guardados === 1 ? "" : "s"} para otro día` : "entregados"}
            />
            <Cifra label="Clientes" valor={t.atendidos} pie="distintos en la caja" />
            <Cifra label="Tarjetas nuevas" valor={t.altas} pie="altas del día" />
          </div>
        )}
        {completo && t.fueraDeHorario > 0 && (
          <p style={{ ...nota, marginTop: 14, background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}>
            {t.fueraDeHorario === 1 ? "Un movimiento" : `${t.fueraDeHorario} movimientos`} con la tienda cerrada, según el
            horario. Están marcados abajo.
          </p>
        )}
      </section>

      {completo && act.porHora.length > 0 && (
        <section style={panel}>
          <h2 style={h2}>Hora a hora</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>
                  {["Hora", ...(cartillas.length ? cartillas.map((k) => (dos ? k.nombre : "Sellos")) : []), "Quitados", n.tipo === "descuento" ? "Cupones" : "Premios"]
                    .map((x, i) => <th key={i} style={th}>{x}</th>)}
                </tr>
              </thead>
              <tbody>
                {act.porHora.map((h) => (
                  <tr key={h.hora}>
                    <td style={td}>{String(h.hora).padStart(2, "0")}:00 – {String(h.hora + 1).padStart(2, "0")}:00</td>
                    {cartillas.map((k, i) => <td key={k.clave} style={td}>{h.sellos[i] || 0}</td>)}
                    <td style={{ ...td, color: h.quitados ? C.mal : C.tenue }}>{h.quitados}</td>
                    <td style={td}>{h.premios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {completo && act.filas.length > 0 && (
        <section style={panel}>
          <h2 style={h2}>Movimientos · {act.filas.length}</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>{["Hora", "", "Cliente", "Qué", "Quién"].map((x, i) => <th key={i} style={th}>{x}</th>)}</tr>
              </thead>
              <tbody>
                {act.filas.map((f, i) => {
                  const c = porSerial.get(f.serial);
                  return (
                    <tr key={`${f.ts}-${i}`} onClick={c ? () => onVerFicha(f.serial) : undefined}
                      style={{ cursor: c ? "pointer" : "default", background: f.fueraDeHorario ? "#fff7ed" : undefined }}>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{f.hora}</td>
                      <td style={td}><span style={chipCodigo(accent)}>{c?.codigo || "—"}</span></td>
                      <td style={td}>{c ? c.nombre || <span style={{ color: C.tenue }}>sin nombre</span> : <span style={{ color: C.tenue }}>ya no está</span>}</td>
                      <td style={{ ...td, color: f.clase === "correccion" ? C.mal : C.texto }}>
                        {/* El texto de la caja ya dice qué y de qué cartilla ("Sello Cafés 3/8"). */}
                        {f.clase === "alta" ? QUE.alta : f.mensaje}
                        {f.fueraDeHorario && (
                          <span style={{ marginLeft: 8, color: "#9a3412", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "-2px" }}>
                            <Icono nombre="reloj" tam={13} /> fuera de horario
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, color: C.suave }}>{QUIEN[f.actor] || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const flecha = { ...botonPequeno, minWidth: 40, fontSize: 18, lineHeight: 1 };
const parrafo = { margin: "0 0 8px", color: C.suave };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle", whiteSpace: "nowrap" };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
