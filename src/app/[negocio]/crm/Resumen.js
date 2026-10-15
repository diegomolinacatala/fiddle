"use client";

import { useMemo } from "react";
import Icono from "@/app/Icono";
import { serieVisitas, rejillaHoraria, cambio, cadenciaTexto } from "@/lib/crm";
import { observaciones, enlaceDeAccion, suficiencia } from "@/lib/observaciones";
import { Cifra, Barras, Rejilla, Reparto, FaltanDatos, Embudo, Cartilla, LeyendaCartilla } from "./piezas";
import { C, panel, h2, botonPequeno, legible } from "@/app/ui";

// ============================================================================
// RESUMEN: ¿CÓMO VA LA TIENDA?
// ----------------------------------------------------------------------------
// De arriba abajo, una pregunta por bloque:
//   ¿cuántos y cómo?       las cifras de cabecera
//   ¿funciona la tarjeta?  el camino de la tarjeta (de sacarla a canjear) y
//                          dónde se queda la cartilla
//   ¿quién se va?          el reparto por estado
//   ¿cuándo vienen?        los 30 días y la rejilla horaria
//   ¿y ahora qué?          lo que dicen los números, con su botón a Avisos
// Las cuentas son de lib/crm.js; aquí solo se enseñan. Las etiquetas de las
// cifras las copia la web (home/Panel.js): si cambian aquí, también allí.
// ============================================================================

const numero = (x) => (x ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 1 });

export default function Resumen({ d, slug, accent, onVerDescartadas }) {
  const { negocio: n, metricas: m } = d;
  const esCupon = n.tipo === "descuento";
  const enLaEscalera = d.estados.filter((e) => e.key !== "descartada");

  // La serie va por días de la tienda (su zona y su horario: los cerrados se
  // marcan); la rejilla, con la hora del navegador, que es la de la tienda.
  const serie = useMemo(() => serieVisitas(d.eventos, 30, Date.now(), n.horario), [d.eventos, n.horario]);
  const rejilla = useMemo(() => rejillaHoraria(d.eventos), [d.eventos]);
  const hay = useMemo(() => suficiencia({ eventos: d.eventos, horario: n.horario }), [d.eventos, n.horario]);
  const ideas = useMemo(
    () => observaciones({ rejilla, horario: n.horario, metricas: m, grupos: d.grupos, suficiencia: hay }),
    [rejilla, n.horario, m, d.grupos, hay],
  );

  return (
    // Sin `minmax(0, 1fr)` la columna crece con lo de dentro: las seis cifras se
    // ponían a 437 px y en un móvil de 320 se salía toda la página.
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
      <Cifras m={m} esCupon={esCupon} accent={accent} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 18 }}>
        <section style={panel}>
          <h2 style={h2}>El camino de la tarjeta</h2>
          <Embudo pasos={m.embudo} accent={accent} />
          {!esCupon && <FraseEmbudo pasos={m.embudo} premios={m.premios} />}
        </section>
        {d.cartillas?.length > 0 && (
          <section style={panel}>
            <h2 style={h2}>Dónde se queda la cartilla</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 20 }}>
              {d.cartillas.map((c) => <Cartilla key={c.indice} c={c} conNombre={d.cartillas.length > 1} />)}
            </div>
            <LeyendaCartilla />
          </section>
        )}
      </div>

      <section style={panel}>
        <h2 style={h2}>Estado de los clientes</h2>
        <Reparto porEstado={m.porEstado} estados={enLaEscalera} total={m.total} />
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 18, fontSize: 13, color: C.suave }}>
          <span>Instalan el pase: <strong style={{ color: C.texto }}>{m.tasaInstalacion}%</strong></span>
          <span title="El de la mitad de los clientes: uno que viene a diario no lo arrastra">
            Ritmo habitual: <strong style={{ color: C.texto }}>{cadenciaTexto(m.cadenciaHabitual)}</strong>
          </span>
          <span title="La mitad de los clientes lleva estas visitas o más">
            Visitas por cliente: <strong style={{ color: C.texto }}>{numero(m.visitasHabituales)}</strong>
          </span>
        </div>
        {m.total > 0 && m.tasaInstalacion < 60 && (
          <p style={{ ...nota, marginTop: 14 }}>
            Solo el {m.tasaInstalacion}% ha añadido la tarjeta al teléfono; al resto no le llegan los avisos.
          </p>
        )}
        {m.descartadas > 0 && (
          <p style={{ fontSize: 12.5, color: C.tenue, margin: "14px 0 0" }}>
            Aparte, {m.descartadas} tarjeta{m.descartadas === 1 ? "" : "s"} que nadie guardó en el teléfono ni usó en caja: no
            cuenta{m.descartadas === 1 ? "" : "n"} como cliente{m.descartadas === 1 ? "" : "s"}.{" "}
            <button type="button" onClick={onVerDescartadas} style={enlaceSuave}>Verlas</button>
          </p>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 18 }}>
        <section style={panel}>
          <h2 style={h2}>Visitas de los últimos 30 días</h2>
          <Barras serie={serie} accent={accent} />
        </section>
        <section style={panel}>
          <h2 style={h2}>A qué horas viene la gente</h2>
          {hay.suficiente ? <Rejilla rejilla={rejilla} accent={accent} /> : <FaltanDatos s={hay} accent={accent} />}
        </section>
      </div>

      {ideas.length > 0 && <LoQueDicen ideas={ideas} slug={slug} accent={accent} suficiente={hay.suficiente} />}

      {d.cohortes.length > 1 && <Cohortes cohortes={d.cohortes} accent={accent} />}
    </div>
  );
}

/**
 * Las cifras de cabecera. «En riesgo» ya no va aquí: sale con su número en el
 * reparto de justo debajo y en Grupos. Tampoco los premios canjeados de
 * siempre (están en el camino de la tarjeta): arriba, lo que la tienda DEBE.
 */
function Cifras({ m, esCupon, accent }) {
  const v = m.vuelta;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      <Cifra label="Clientes" valor={m.total} pie={`${m.instalados} con la tarjeta en el teléfono`} accent={accent} />
      <Cifra label="Activos" valor={m.activos} accent={C.ok}
        pie={`${m.porEstado.activo} a su ritmo, ${m.porEstado.nuevo} nuevo${m.porEstado.nuevo === 1 ? "" : "s"}`}
        titulo="Siguen viniendo: a su ritmo de siempre o recién llegados" />
      <Cifra label={`Vuelven en ${v.dias} días`} valor={v.tasa === null ? "—" : `${v.tasa}%`}
        pie={v.tasa === null ? "aún pocos clientes para saberlo" : `${v.volvieron} de ${v.base} que la estrenaron`}
        titulo={`De los que estrenaron la tarjeta hace más de ${v.dias} días, cuántos volvieron en esos ${v.dias} días`} />
      <Cifra label="Visitas (30 d)" valor={m.visitas30} cambio={cambio(m.visitas30, m.visitas30Previas)}
        pie={m.visitas30Previas === null ? "aún sin un mes anterior entero" : "frente a los 30 días anteriores"} />
      <Cifra label="Altas (30 d)" valor={m.nuevos30} cambio={cambio(m.nuevos30, m.nuevos30Previos)} pie="tarjetas nuevas" />
      {esCupon
        ? <Cifra label="Cupones usados" valor={m.premios} pie="en total" />
        : <Cifra label="Premios por dar" valor={m.porDar} pie="guardados o con la cartilla llena" />}
    </div>
  );
}

/**
 * Debajo del embudo, el escalón que más importa en una frase: ¿vuelven? Solo con
 * cartilla: en un cupón, «volvieron» va detrás de usarlo y la frase no saldría.
 */
function FraseEmbudo({ pasos, premios }) {
  const estrenaron = pasos.find((p) => p.key === "estrenaron");
  const volvieron = pasos.find((p) => p.key === "volvieron");
  const deCada10 = estrenaron?.n >= 5 ? Math.round(volvieron.paso / 10) : null;
  return (
    <>
      {deCada10 !== null && (
        <p style={{ fontSize: 13.5, margin: "14px 0 0" }}>
          {deCada10
            ? `De cada 10 que la estrenan en caja, vuelve${deCada10 === 1 ? "" : "n"} ${deCada10}.`
            : "De los que la estrenan en caja, todavía no vuelve casi nadie."}
        </p>
      )}
      {premios > 0 && (
        <p style={{ fontSize: 12, color: C.tenue, margin: "6px 0 0" }}>
          {premios} premio{premios === 1 ? "" : "s"} canjeado{premios === 1 ? "" : "s"} en total.
        </p>
      )}
    </>
  );
}

function LoQueDicen({ ideas, slug, accent, suficiente }) {
  return (
    <section style={panel}>
      <h2 style={h2}>Lo que dicen los números</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {ideas.map((o) => (
          <div key={o.id} style={idea}>
            <span style={{ color: legible(accent), display: "inline-flex", marginTop: 2 }}><Icono nombre={o.accion?.tipo === "grupo" ? "clientes" : o.id === "pocos" ? "reloj" : "diana"} tam={18} /></span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{o.texto}</div>
              {o.detalle && <div style={{ fontSize: 13, color: C.suave, marginTop: 2 }}>{o.detalle}</div>}
            </div>
            {o.accion && (
              <a href={enlaceDeAccion(slug, o.accion, o.texto)} style={{ ...botonPequeno, textDecoration: "none", whiteSpace: "nowrap", alignSelf: "center" }}>
                {o.accion.label}
              </a>
            )}
          </div>
        ))}
      </div>
      {suficiente && (
        <p style={{ fontSize: 12, color: C.tenue, margin: "12px 0 0" }}>
          Salen de las visitas de los últimos meses y del horario de la tienda. Son orientativas: mira la rejilla de arriba.
        </p>
      )}
    </section>
  );
}

function Cohortes({ cohortes, accent }) {
  return (
    <section style={panel}>
      <h2 style={h2}>Por mes de alta</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tabla}>
          <thead>
            <tr>{["Mes", "Altas", "Repitieron", "Siguen activos", ""].map((t) => <th key={t} style={th}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {cohortes.map((c) => (
              <tr key={c.mes}>
                <td style={td}>{new Date(`${c.mes}-15`).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</td>
                <td style={td}>{c.altas}</td>
                <td style={td}>{c.repiten}</td>
                <td style={td}>{c.vivos}</td>
                <td style={{ ...td, width: "35%" }}>
                  <div style={{ height: 8, background: C.borde, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${c.retencion}%`, height: "100%", background: accent }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.tenue }}>{c.retencion}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const idea = { display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", padding: "12px 14px", border: `1px solid ${C.borde}`, borderRadius: 12, background: C.panelSuave };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
const enlaceSuave = { background: "none", border: 0, padding: 0, font: "inherit", color: C.suave, textDecoration: "underline", cursor: "pointer" };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle", whiteSpace: "nowrap" };
