"use client";

import { useMemo, useState } from "react";
import Icono from "@/app/Icono";
import { Cifra, Rejilla } from "../crm/piezas";
import { BarrasPorPersona, SerieApilada, RejillaEquipo, Punto } from "./graficas";
import { cifra, unoDeCada } from "@/lib/plantilla";
import { fechaHoraTexto, diaCortoTexto } from "@/lib/actividad";
import { C, panel, h2, botonPequeno } from "@/app/ui";

// ============================================================================
// RENDIMIENTO: qué hace cada persona, contra la media del equipo
// ----------------------------------------------------------------------------
// Las cifras del equipo, las conclusiones (reglas fijas, lib/plantilla.js), la
// tabla por persona (se ordena por cualquier columna; una fila se abre y enseña
// sus jornadas y sus horas) y tres gráficas. Sin podio: cada uno contra lo
// normal en sus franjas, no contra los demás.
// ============================================================================

const COLUMNAS = [
  ["nombre", "Persona"],
  ["sellos", "Sellos"],
  ["sellosPorHora", "Por hora de caja"],
  ["premios", "Premios"],
  ["quitados", "Quitados"],
  ["clientes", "Clientes"],
  ["dias", "Días"],
  ["horas", "Horas de caja"],
  ["estrenos", "Estrenos"],
  ["fuera", "Fuera de horario"],
];
const ICONO_TONO = { bien: "check", ojo: "alerta", dato: "diana" };
const COLOR_TONO = { bien: C.ok, ojo: "#c26b04", dato: null };
const idDeFila = (clave) => `persona-${clave.replace(/[^a-z0-9]/gi, "-")}`;

export default function Rendimiento({ cuentas, ideas, serie, dias, accent, colorDe, zona }) {
  const [orden, setOrden] = useState({ clave: "sellos", desc: true });
  const [abierta, setAbierta] = useState(null);
  const { filas, equipo, media } = cuentas;

  const visibles = useMemo(() => filas.filter((f) => f.movimientos > 0 || f.activo), [filas]);
  const ordenadas = useMemo(() => {
    const v = (f) => (f[orden.clave] === null || f[orden.clave] === undefined ? -1 : f[orden.clave]);
    return [...visibles].sort((a, b) => {
      if (orden.clave === "nombre") return (orden.desc ? -1 : 1) * a.nombre.localeCompare(b.nombre, "es");
      return (orden.desc ? -1 : 1) * (v(a) - v(b)) || a.nombre.localeCompare(b.nombre, "es");
    });
  }, [visibles, orden]);
  const conMovimientos = visibles.filter((f) => f.movimientos > 0);
  const claves = conMovimientos.map((f) => f.clave);
  const nombreDe = (k) => filas.find((f) => f.clave === k)?.nombre || k;

  function ordenar(clave) {
    setOrden((o) => (o.clave === clave ? { clave, desc: !o.desc } : { clave, desc: clave !== "nombre" }));
  }
  /** Abre (o cierra) el detalle de una fila. Desde una conclusión, además la trae a la vista. */
  function abrir(clave, llevar = false) {
    const cerrar = abierta === clave;
    setAbierta(cerrar ? null : clave);
    if (!cerrar && llevar) requestAnimationFrame(() => document.getElementById(idDeFila(clave))?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    // minmax(0, 1fr): sin eso la tabla ancha estira la rejilla y en el móvil se sale TODA la página.
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Cifra label="Sellos" valor={equipo.sellos} pie={`en ${dias} días, ${equipo.personas} ${equipo.personas === 1 ? "persona" : "personas"}`} accent={accent} />
        <Cifra label="Por hora de caja" valor={media?.sellosPorHora ? cifra(media.sellosPorHora) : "–"} pie="sellos, media del equipo" />
        <Cifra label="Premios" valor={equipo.premios} pie="entregados" />
        <Cifra label="Quitados" valor={equipo.quitados} pie={equipo.quitados ? `${unoDeCada(equipo.quitados, equipo.sellos)} sellos` : "ninguno al corregir"} accent={equipo.quitados ? C.mal : undefined} />
        <Cifra label="Clientes" valor={equipo.clientes} pie="distintos atendidos" />
      </div>

      {ideas.length > 0 && (
        <section style={panel}>
          <h2 style={h2}>Lo que dicen los números</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {ideas.map((o) => (
              <div key={o.id} style={idea}>
                <span style={{ color: COLOR_TONO[o.tono] || accent, display: "inline-flex", marginTop: 2 }}><Icono nombre={ICONO_TONO[o.tono]} tam={18} grosor={2.1} /></span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{o.texto}</div>
                  {o.detalle && <div style={{ fontSize: 13, color: C.suave, marginTop: 2 }}>{o.detalle}</div>}
                </div>
                {o.clave && filas.some((f) => f.clave === o.clave) && (
                  <button type="button" onClick={() => abrir(o.clave, true)} style={{ ...botonPequeno, whiteSpace: "nowrap", alignSelf: "center" }}>
                    Ver sus días
                  </button>
                )}
              </div>
            ))}
          </div>
          <p style={pie}>
            Salen de los movimientos de la caja de estos {dias} días. Una «hora de caja» es una hora del reloj con algún movimiento
            de esa persona: lo más parecido al tiempo trabajado sin apuntar turnos.
          </p>
        </section>
      )}

      <section style={panel}>
        <h2 style={h2}>Por persona</h2>
        {!visibles.length ? (
          <p style={nota}>Todavía no hay nadie en la plantilla ni movimientos en la caja.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>
                  {COLUMNAS.map(([clave, texto]) => (
                    <th key={clave} style={th} aria-sort={orden.clave === clave ? (orden.desc ? "descending" : "ascending") : undefined}>
                      <button type="button" onClick={() => ordenar(clave)} style={cabecera}>
                        {texto}{orden.clave === clave ? (orden.desc ? " ▼" : " ▲") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f) => {
                  const ritmo = f.sellosPorHora !== null && f.esperado
                    ? f.sellosPorHora >= f.esperado * 1.3 ? C.ok : f.sellosPorHora <= f.esperado * 0.7 ? "#c26b04" : null
                    : null;
                  const abiertaEsta = abierta === f.clave;
                  return [
                    <tr key={f.clave} id={idDeFila(f.clave)} onClick={() => abrir(f.clave)} style={{ cursor: "pointer", background: abiertaEsta ? C.panelSuave : undefined, scrollMarginTop: 20 }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {/* Un botón de verdad: la fila se abre también con el teclado. */}
                        <button type="button" aria-expanded={abiertaEsta} onClick={(e) => { e.stopPropagation(); abrir(f.clave); }}
                          style={{ ...cabecera, color: f.persona ? C.texto : C.tenue, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <Punto color={colorDe(f.clave)} />{f.nombre}
                          {!f.activo && f.persona && <span style={{ fontSize: 11, color: C.tenue, fontWeight: 500 }}>(baja)</span>}
                        </button>
                      </td>
                      <td style={{ ...td, fontWeight: 650 }}>{f.sellos}</td>
                      <td style={td}>
                        {f.sellosPorHora === null ? <span style={{ color: C.tenue }}>–</span> : (
                          <>
                            <span style={{ fontWeight: 600, color: ritmo || C.texto }}>{cifra(f.sellosPorHora)}</span>
                            {f.esperado ? <span style={{ fontSize: 11, color: C.tenue, marginLeft: 6 }}>lo normal {cifra(f.esperado)}</span> : null}
                          </>
                        )}
                      </td>
                      <td style={td}>{f.premios}</td>
                      <td style={{ ...td, color: f.quitados ? C.mal : C.tenue }}>{f.quitados}</td>
                      <td style={td}>{f.clientes}</td>
                      <td style={td}>{f.dias}</td>
                      <td style={td}>{f.horas}</td>
                      <td style={td}>{f.estrenos}</td>
                      <td style={{ ...td, color: f.fuera ? "#9a3412" : C.tenue }}>{f.fuera}</td>
                    </tr>,
                    abiertaEsta && (
                      <tr key={`${f.clave}-detalle`}>
                        <td colSpan={COLUMNAS.length} style={{ ...td, whiteSpace: "normal", background: C.panelSuave }}>
                          <Detalle f={f} color={colorDe(f.clave)} zona={zona} />
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
            <p style={pie}>Toca una fila para ver sus jornadas. «Lo normal» es lo que da el equipo en los mismos días y tramos que esa persona.</p>
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 18 }}>
        <section style={panel}>
          <h2 style={h2}>Sellos por persona</h2>
          <BarrasPorPersona filas={conMovimientos.filter((f) => f.sellos > 0)} colorDe={colorDe} />
        </section>
        <section style={panel}>
          <h2 style={h2}>Quién selló cada día</h2>
          <SerieApilada serie={serie} claves={claves} colorDe={colorDe} nombreDe={nombreDe} />
        </section>
      </div>

      <section style={panel}>
        <h2 style={h2}>Quién cubre cada hora</h2>
        <RejillaEquipo filas={conMovimientos} colorDe={colorDe} />
        <p style={pie}>Cada casilla, del color de quien más movimientos hizo a esa hora de ese día de la semana; más oscura cuanto más movimiento.</p>
      </section>
    </div>
  );
}

/** Las jornadas de una persona (del primer al último movimiento de cada día) y sus horas. */
function Detalle({ f, color, zona }) {
  const [todas, setTodas] = useState(false);
  const jornadas = todas ? f.jornadas : f.jornadas.slice(0, 12);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 18, padding: "6px 0 4px" }}>
      <div>
        <h3 style={h3}>Jornadas, {f.jornadas.length}</h3>
        {!f.jornadas.length ? <p style={nota}>Sin movimientos en este periodo.</p> : (
          <>
            <table style={tabla}>
              <thead><tr>{["Día", "De", "A", "Sellos", "Premios", "Quitados"].map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
              <tbody>
                {jornadas.map((j) => (
                  <tr key={j.fecha}>
                    <td style={td}>{diaCortoTexto(j.fecha)}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{j.primero}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{j.ultimo}</td>
                    <td style={td}>{j.sellos}</td>
                    <td style={td}>{j.premios}</td>
                    <td style={{ ...td, color: j.quitados ? C.mal : C.tenue }}>{j.quitados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {f.jornadas.length > 12 && !todas && (
              <button type="button" onClick={() => setTodas(true)} style={{ ...botonPequeno, marginTop: 10 }}>Ver los {f.jornadas.length - 12} días más</button>
            )}
            <p style={pie}>«De» y «A» son su primer y su último movimiento del día, no un horario.</p>
          </>
        )}
      </div>
      <div>
        <h3 style={h3}>Sus horas</h3>
        <Rejilla rejilla={f.rejilla} accent={color} />
        {f.primeraVez && (
          <p style={pie}>
            Primer movimiento del periodo: {fechaHoraTexto(f.primeraVez, zona)}. Último: {fechaHoraTexto(f.ultimaVez, zona)}.
          </p>
        )}
      </div>
    </div>
  );
}

const idea = { display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", padding: "12px 14px", border: `1px solid ${C.borde}`, borderRadius: 12, background: C.panelSuave };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const cabecera = { border: 0, background: "transparent", padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textTransform: "inherit", letterSpacing: "inherit" };
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle", whiteSpace: "nowrap" };
const h3 = { fontSize: 13, fontWeight: 650, margin: "0 0 10px" };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
const pie = { fontSize: 12, color: C.tenue, margin: "12px 0 0" };
