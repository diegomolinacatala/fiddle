"use client";

import { useEffect, useMemo, useState } from "react";
import Icono from "@/app/Icono";
import {
  actividadDelRango, diaCompleto, zonaDe, diaCortoTexto, MODOS, periodoDe, periodoDeFechas, moverPeriodo,
  periodoAnterior, comparable, enCurso, nombrePeriodo, rangoCorto, mesTexto, textoComparacion,
} from "@/lib/actividad";
import { cambio } from "@/lib/crm";
import { csvActividad, QUE } from "@/lib/exportar";
import { quienTexto } from "@/lib/plantilla";
import { fechaLocal, relojLocal, sumarDias } from "@/lib/horario";
import { cartillasDe } from "@/lib/cartillas";
import { Cifra } from "./piezas";
import Exportar, { bajarCsv } from "./Exportar";
import { C, panel, campo, h2, botonPequeno, chipCodigo, solapa } from "@/app/ui";

// ============================================================================
// ACTIVIDAD: ¿CUADRA CON LA CAJA?
// ----------------------------------------------------------------------------
// Un día de la tienda, una semana o un mes: cuántos puntos y premios salieron,
// a qué hora y quién los dio. Es lo que el dueño pone al lado de los tickets:
// cada punto debería tener su compra. De un día se ve cada movimiento; de varios,
// una fila por día, y tocarla abre ese día. Las cuentas, en lib/actividad.js;
// aquí solo se enseñan.
// ============================================================================

// El modo que se usó la última vez, en este navegador: quien mira la semana cada
// lunes no tiene que volver a elegirla. Solo el modo; las fechas, siempre las de hoy.
const RECORDAR_MODO = "fiddle-actividad-modo";

export default function Actividad({ d, n, slug, accent, onVerFicha }) {
  const zona = zonaDe(n);
  const ahora = Date.now();
  const hoy = fechaLocal(ahora, zona);
  const [periodo, setPeriodo] = useState(() => periodoDe("dia", hoy));

  useEffect(() => {
    let modo = null;
    try { modo = localStorage.getItem(RECORDAR_MODO); } catch {}
    if (modo === "semana" || modo === "mes") setPeriodo(periodoDe(modo, hoy));
    // Solo al entrar: luego manda lo que se toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegirModo(modo) {
    // Se queda en el día que se miraba: el martes 7 en Semana es su semana.
    const ancla = periodo.hasta > hoy ? hoy : periodo.hasta;
    setPeriodo(periodoDe(modo, ancla));
    try { localStorage.setItem(RECORDAR_MODO, modo); } catch {}
  }

  // El primer día del que está TODO (ver historialCompletoDesde en crmDatos).
  const primero = useMemo(() => {
    const desde = d.historialCompletoDesde;
    if (!desde) return null;
    const f = fechaLocal(Date.parse(desde), zona);
    return diaCompleto(f, zona, desde) ? f : sumarDias(f, 1);
  }, [d.historialCompletoDesde, zona]);

  const cartillas = n.tipo === "descuento" ? [] : cartillasDe({}, n);
  const dos = cartillas.length > 1;
  const cuantas = Math.max(1, cartillas.length);
  const hasta = periodo.hasta > hoy ? hoy : periodo.hasta; // de esta semana, hasta hoy: el resto no ha pasado
  const unDia = periodo.desde === hasta;
  const act = useMemo(
    () => actividadDelRango(d.eventos, periodo.desde, hasta, { zona, horario: n.horario, cartillas: cuantas }),
    [d.eventos, periodo.desde, hasta, zona, n.horario, cuantas],
  );

  // Las flechas: contra el periodo anterior, si existía la tienda y está entero en el panel.
  const primeraAlta = useMemo(() => Math.min(...d.clientes.map((c) => Date.parse(c.creado)).filter(Boolean)), [d.clientes]);
  const anterior = periodoAnterior(periodo, hoy, relojLocal(ahora, zona).minutos);
  const comparar = !unDia && comparable(anterior, { zona, primeraAlta, completoDesde: d.historialCompletoDesde });
  const { desde: aDesde, hasta: aHasta, hastaMinutos } = anterior;
  const antes = useMemo(
    () => (comparar ? actividadDelRango(d.eventos, aDesde, aHasta, { zona, horario: n.horario, cartillas: cuantas, hastaMinutos }) : null),
    [comparar, d.eventos, aDesde, aHasta, hastaMinutos, zona, n.horario, cuantas],
  );
  const flecha = (ahoraN, antesN) => (antes ? cambio(ahoraN, antesN) : null);

  const porSerial = useMemo(() => new Map(d.clientes.map((c) => [c.serial, c])), [d.clientes]);
  const codigoDe = (serial) => porSerial.get(serial)?.codigo || "—";

  const completo = diaCompleto(periodo.desde, zona, d.historialCompletoDesde);
  const t = act.totales;
  const premios = t.porCartilla.reduce((a, k) => a + k.premios, 0);
  const guardados = t.porCartilla.reduce((a, k) => a + k.guardados, 0);
  const sumaAntes = (campo) => antes?.totales.porCartilla.reduce((a, k) => a + k[campo], 0);
  const cerrada = unDia && act.porDia[0]?.cerrado;
  const textoFechas = unDia ? hasta.split("-").reverse().join("/") : rangoCorto(periodo.desde, hasta);

  const anteriorP = moverPeriodo(periodo, -1);
  const siguiente = moverPeriodo(periodo, 1);
  const puedeAtras = !primero || anteriorP.hasta >= primero;
  const puedeAdelante = siguiente.desde <= hoy;
  const actual = periodo.modo !== "fechas" && enCurso(periodo, hoy);
  const VOLVER = { dia: "Hoy", semana: "Esta semana", mes: "Este mes" };

  function descargar() {
    const csv = csvActividad({ fecha: periodo.desde, filas: act.filas, codigoDe, negocio: n, quienDe: (f) => quienTexto(f, n.plantilla) });
    const que = unDia ? periodo.desde : `${periodo.desde}-${hasta}`;
    bajarCsv({ csv, fichero: `${slug}-actividad-${que}.csv`, slug, cuantos: act.filas.length, que: `actividad-${que}` });
  }

  return (
    // minmax(0, 1fr): sin él, una tabla ancha ensancha la rejilla y la página entera se sale en el móvil.
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <section style={panel}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div role="group" aria-label="Periodo" style={{ display: "flex", gap: 6 }}>
            {MODOS.map(([modo, texto]) => (
              <button key={modo} type="button" aria-pressed={periodo.modo === modo} onClick={() => elegirModo(modo)} style={modoBtn(periodo.modo === modo, accent)}>
                {texto}
              </button>
            ))}
          </div>

          {periodo.modo === "fechas" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date" value={periodo.desde} min={primero || undefined} max={hoy} aria-label="Desde"
                onChange={(e) => e.target.value && setPeriodo(periodoDeFechas(e.target.value, periodo.hasta))}
                style={fechaCampo}
              />
              <span style={{ color: C.tenue }}>a</span>
              <input
                type="date" value={periodo.hasta} min={primero || undefined} max={hoy} aria-label="Hasta"
                onChange={(e) => e.target.value && setPeriodo(periodoDeFechas(periodo.desde, e.target.value > hoy ? hoy : e.target.value))}
                style={fechaCampo}
              />
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPeriodo(anteriorP)} disabled={!puedeAtras} aria-label="Anterior" style={flechaBtn}>‹</button>
              {periodo.modo === "dia" ? (
                <input
                  type="date" value={periodo.desde} max={hoy} min={primero || undefined} aria-label="Día"
                  onChange={(e) => e.target.value && setPeriodo(periodoDe("dia", e.target.value > hoy ? hoy : e.target.value))}
                  style={fechaCampo}
                />
              ) : (
                <span style={etiquetaRango}>
                  {periodo.modo === "mes" ? mesTexto(periodo.desde) : rangoCorto(periodo.desde, periodo.hasta)}
                </span>
              )}
              <button type="button" onClick={() => setPeriodo(siguiente)} disabled={!puedeAdelante} aria-label="Siguiente" style={flechaBtn}>›</button>
              {!actual && (
                <button type="button" onClick={() => setPeriodo(periodoDe(periodo.modo, hoy))} style={botonPequeno}>{VOLVER[periodo.modo]}</button>
              )}
            </div>
          )}

          {periodo.modo !== "fechas" && (
            <button type="button" onClick={() => setPeriodo(periodoDeFechas(periodo.desde, hasta))} style={enlace}>Otras fechas</button>
          )}

          <span style={{ flex: 1 }} />
          <Exportar
            cuantos={completo ? act.filas.length : 0} accent={accent} onDescargar={descargar}
            titulo={`Descargar los ${act.filas.length} movimientos del ${textoFechas}`}
            explicacion={<>
              <p style={parrafo}>
                Una fila por movimiento: {unDia ? "" : "día, "}hora, código de la tarjeta, qué se hizo y quién. Se abre con <strong>Excel</strong>,
                Numbers o Google Sheets, para ponerla al lado de los tickets.
              </p>
              <p style={{ ...parrafo, color: C.tenue }}>No lleva nombres de clientes. Queda apuntado que la descargaste.</p>
            </>}
          />
        </div>

        <h2 style={{ ...h2, margin: "18px 0 4px" }}>{nombrePeriodo(periodo, hoy)}</h2>
        <p style={{ fontSize: 13, color: C.suave, margin: "0 0 14px" }}>
          {unDia
            ? "Cada punto debería ser una compra: compara estas cifras con los tickets del día. Si no cuadran, abajo está cada movimiento con su hora para encontrar cuál."
            : "Cada punto debería ser una compra: compara estas cifras con los tickets de esos días. Si uno no cuadra, tócalo abajo para ver sus movimientos."}
          {antes && <> Las flechas, frente a {textoComparacion(periodo, hoy)}.</>}
        </p>

        {!completo ? (
          <p style={nota}>
            {unDia ? "De ese día" : "Del principio de ese periodo"} ya no están todos los movimientos en el panel. Elige uno más reciente.
          </p>
        ) : !act.filas.length ? (
          <p style={nota}>{cerrada ? "La tienda cerraba ese día y no" : "No"} hubo movimientos en la caja.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {cartillas.map((k, i) => (
              <Cifra
                key={k.clave} label={dos ? `Puntos · ${k.nombre}` : "Puntos dados"} valor={t.porCartilla[i].sellos} accent={accent}
                cambio={flecha(t.porCartilla[i].sellos, antes?.totales.porCartilla[i].sellos)}
                pie={t.porCartilla[i].quitados ? `y ${t.porCartilla[i].quitados} quitado${t.porCartilla[i].quitados === 1 ? "" : "s"} al corregir` : "en la caja"}
              />
            ))}
            <Cifra
              label={n.tipo === "descuento" ? "Cupones usados" : "Premios"} valor={premios} cambio={flecha(premios, sumaAntes("premios"))}
              pie={guardados ? `y ${guardados} guardado${guardados === 1 ? "" : "s"} para otro día` : "entregados"}
            />
            <Cifra label="Clientes" valor={t.atendidos} cambio={flecha(t.atendidos, antes?.totales.atendidos)} pie="distintos en la caja" />
            <Cifra label="Tarjetas nuevas" valor={t.altas} cambio={flecha(t.altas, antes?.totales.altas)} pie={unDia ? "altas del día" : "altas en esos días"} />
          </div>
        )}
        {completo && t.fueraDeHorario > 0 && (
          <p style={{ ...nota, marginTop: 14, background: C.ojoFondo, borderColor: C.ojoBorde, color: C.ojoTexto }}>
            {t.fueraDeHorario === 1 ? "Un movimiento" : `${t.fueraDeHorario} movimientos`} con la tienda cerrada, según el
            horario. {unDia ? "Están marcados abajo." : "Abre su día para verlos marcados."}
          </p>
        )}
      </section>

      {completo && !unDia && act.filas.length > 0 && (
        <DiaADia porDia={act.porDia} cartillas={cartillas} descuento={n.tipo === "descuento"} onAbrir={(fecha) => setPeriodo(periodoDe("dia", fecha))} />
      )}

      {completo && act.porHora.length > 0 && (
        <section style={panel}>
          <h2 style={h2}>Hora a hora</h2>
          {!unDia && <p style={{ fontSize: 13, color: C.suave, margin: "-6px 0 12px" }}>Sumando los {act.porDia.length} días.</p>}
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>
                  {["Hora", ...cartillas.map((k) => (dos ? k.nombre : "Puntos")), "Quitados", n.tipo === "descuento" ? "Cupones" : "Premios"]
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

      {completo && unDia && act.filas.length > 0 && (
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
                      style={{ cursor: c ? "pointer" : "default", background: f.fueraDeHorario ? C.ojoFondo : undefined }}>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{f.hora}</td>
                      <td style={td}><span style={chipCodigo(accent)}>{c?.codigo || "—"}</span></td>
                      <td style={td}>{c ? c.nombre || <span style={{ color: C.tenue }}>sin nombre</span> : <span style={{ color: C.tenue }}>ya no está</span>}</td>
                      <td style={{ ...td, color: f.clase === "correccion" ? C.mal : C.texto }}>
                        {/* El texto de la caja ya dice qué y de qué cartilla ("Punto Cafés 3/8"). */}
                        {f.clase === "alta" ? QUE.alta : f.mensaje}
                        {f.fueraDeHorario && (
                          <span style={{ marginLeft: 8, color: C.ojoTexto, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "-2px" }}>
                            <Icono nombre="reloj" tam={13} /> fuera de horario
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, color: C.suave }}>{quienTexto(f, n.plantilla) || "—"}</td>
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

/** Una fila por día del periodo, también los de cero: un martes sin nada también es un dato. */
function DiaADia({ porDia, cartillas, descuento, onAbrir }) {
  const dos = cartillas.length > 1;
  return (
    <section style={panel}>
      <h2 style={h2}>Día a día</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tabla}>
          <thead>
            <tr>
              {["Día", ...cartillas.map((k) => (dos ? k.nombre : "Puntos")), "Quitados", descuento ? "Cupones" : "Premios", "Clientes", ""]
                .map((x, i) => <th key={i} style={th}>{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {porDia.map((dia) => {
              const premios = dia.porCartilla.reduce((a, k) => a + k.premios, 0);
              const quitados = dia.porCartilla.reduce((a, k) => a + k.quitados, 0);
              const vacio = !dia.atendidos && !dia.altas;
              const apagado = vacio ? C.tenue : C.texto;
              return (
                <tr key={dia.fecha} onClick={() => onAbrir(dia.fecha)} style={{ cursor: "pointer" }} title="Ver los movimientos de ese día">
                  <td style={{ ...td, color: apagado }}>
                    {diaCortoTexto(dia.fecha)}
                    {dia.cerrado && <span style={{ marginLeft: 8, fontSize: 12, color: C.tenue }}>cerrado</span>}
                  </td>
                  {cartillas.map((k, i) => <td key={k.clave} style={{ ...td, color: apagado }}>{dia.porCartilla[i].sellos}</td>)}
                  <td style={{ ...td, color: quitados ? C.mal : C.tenue }}>{quitados}</td>
                  <td style={{ ...td, color: apagado }}>{premios}</td>
                  <td style={{ ...td, color: apagado }}>{dia.atendidos}</td>
                  <td style={{ ...td, color: C.tenue, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {dia.fueraDeHorario > 0 && <span style={{ color: C.ojoTexto, display: "inline-flex" }} title="Con movimientos fuera de horario"><Icono nombre="reloj" tam={13} /></span>}
                      ›
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const modoBtn = (activo, accent) => ({ ...solapa(activo, accent), padding: "0.4rem 0.75rem", fontSize: 13 });
const flechaBtn = { ...botonPequeno, minWidth: 40, fontSize: 18, lineHeight: 1 };
const fechaCampo = { ...campo, width: "auto" };
const etiquetaRango = { minWidth: 110, textAlign: "center", fontSize: 14, fontWeight: 600, color: C.texto };
const enlace = {
  border: 0, background: "none", padding: "6px 2px", color: C.suave, fontSize: 13, fontWeight: 600,
  cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
};
const parrafo = { margin: "0 0 8px", color: C.suave };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle", whiteSpace: "nowrap" };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
