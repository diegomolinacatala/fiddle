"use client";

import Icono from "@/app/Icono";
import { useEffect, useMemo, useState } from "react";
import CabeceraGestion from "../CabeceraGestion";
import { serieVisitas, rejillaHoraria, tendencia, haceTexto, cadenciaTexto, GRUPOS } from "@/lib/crm";
import { observaciones, enlaceDeAccion } from "@/lib/observaciones";
import { csvClientes } from "@/lib/exportar";
import { Cifra, Barras, Rejilla, Reparto, Chip } from "./piezas";
import Ficha from "./Ficha";
import Exportar from "./Exportar";
import { saldoCorto } from "@/lib/cartillas";
import { C, pagina, panel, campo, h2, botonPequeno, chipCodigo, solapa } from "@/app/ui";

const POR_PAGINA = 50; // con cientos de clientes la tabla se pinta a tramos

// ============================================================================
// CRM DE UNA TIENDA
// ----------------------------------------------------------------------------
// Dos pestañas, dos preguntas:
//   RESUMEN   ¿cómo va la tienda? cifras, reparto de clientes, cuándo vienen y
//             lo que dicen los números (lib/observaciones.js), con su botón
//   GRUPOS    los grupos del CRM en tarjetas: quién hay en cada uno y, con un
//             toque, escribirles (lleva a Avisos con el grupo ya elegido)
//   CLIENTES  ¿quién es este? la tabla, la búsqueda, la ficha de cada uno y la
//             exportación (de lo que se está viendo, y solo aquí)
// Escribir el mensaje vive en Avisos: aquí se ve a quién, allí se dice qué.
//
// Todo llega en UNA petición a /api/crm; las cuentas que dependen de la hora
// local (a qué hora viene la gente) se hacen aquí, con el reloj de la tienda.
// ============================================================================

const PESTANAS = [["resumen", "Resumen"], ["grupos", "Grupos"], ["clientes", "Clientes"]];
const ORDENES = {
  reciente: { label: "Última visita", cmp: (a, b) => (a.perfil.diasSinVenir ?? 1e9) - (b.perfil.diasSinVenir ?? 1e9) },
  visitas: { label: "Más visitas", cmp: (a, b) => b.perfil.visitas - a.perfil.visitas },
  alta: { label: "Más nuevos", cmp: (a, b) => (b.creado || "").localeCompare(a.creado || "") },
  riesgo: { label: "Más retraso", cmp: (a, b) => (b.perfil.retraso ?? -1) - (a.perfil.retraso ?? -1) },
};

// Llega con los datos ya cargados en el servidor (page.js): nada de pantalla
// vacía esperando a otra petición. `cargar()` solo recarga tras un cambio.
export default function PanelCrm({ slug, inicial }) {
  const [d, setD] = useState(inicial);
  const [pestana, setPestana] = useState("resumen");
  const [grupo, setGrupo] = useState("");
  const [verFicha, setVerFicha] = useState(null);
  const [busca, setBusca] = useState("");
  const [orden, setOrden] = useState("reciente");
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [msg, setMsg] = useState(null);

  async function cargar() {
    try {
      const r = await fetch(`/api/crm?b=${slug}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo cargar");
      setD(data);
    } catch (e) {
      // Lo que ya se ve sigue valiendo: se avisa y no se tira la página.
      flash(`No se pudo actualizar: ${e?.message || e}`);
    }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 3500); }

  // Estas dos dependen de la hora del navegador, que es la de la tienda.
  const serie = useMemo(() => (d ? serieVisitas(d.eventos, 30) : []), [d]);
  const rejilla = useMemo(() => (d ? rejillaHoraria(d.eventos) : []), [d]);
  const ideas = useMemo(() => (d ? observaciones({ rejilla, horario: d.negocio.horario, metricas: d.metricas, grupos: d.grupos }) : []), [d, rejilla]);
  const [grupoVisto, setGrupoVisto] = useState(null);

  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return d.clientes
      .filter((c) => !grupo || GRUPOS[grupo]?.incluye(c.perfil))
      .filter((c) => !q || (c.nombre || "").toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q))
      .sort(ORDENES[orden].cmp);
  }, [d, busca, orden, grupo]);
  useEffect(() => setMostrar(POR_PAGINA), [busca, orden, grupo]);

  const { negocio: n, metricas: m, grupos, estados } = d;
  const accent = n.tema.accent;
  const grupoActivo = grupos.find((g) => g.key === grupo);

  // La hoja se arma AQUÍ, con la lista que se ve: lo que hay en pantalla es lo que baja.
  function descargar() {
    const csv = csvClientes(lista.map((c) => ({ cliente: c, perfil: c.perfil })), n);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${slug}-${grupo || "clientes"}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    // Queda apuntado quién bajó cuántos clientes (el registro de auditoría).
    fetch("/api/crm/exportar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b: slug, cuantos: lista.length, que: grupo || "todos" }),
    }).catch(() => {});
  }
  const queContiene = [
    grupoActivo ? `Los de «${grupoActivo.label}»` : "Todos tus clientes",
    busca.trim() && `que coinciden con «${busca.trim()}»`,
  ].filter(Boolean).join(" ");

  return (
    <main style={pagina}>
      <div style={{ width: "min(1100px, 100%)" }}>
        <CabeceraGestion negocio={n} slug={slug} activa="crm" />

        <div style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
          {PESTANAS.map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setPestana(id)} style={solapa(pestana === id, accent)}>
              {texto}
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------ resumen */}
        {pestana === "resumen" && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <Cifra label="Clientes" valor={m.total} pie={`${m.instalados} con la tarjeta en el teléfono`} accent={accent} />
              <Cifra label="Activos" valor={m.activos} pie="con su frecuencia habitual" accent={C.ok} />
              <Cifra label="En riesgo" valor={m.enRiesgo} pie="más tiempo del habitual sin venir" accent={m.enRiesgo ? "#c26b04" : C.texto} />
              <Cifra label="Visitas (30 d)" valor={m.visitas30} variacion={tendencia(m.visitas30, m.visitas30Previas)} pie="vs. los 30 anteriores" />
              <Cifra label="Altas (30 d)" valor={m.nuevos30} variacion={tendencia(m.nuevos30, m.nuevos30Previos)} pie="pases nuevos" />
              <Cifra label="Premios" valor={m.premios} pie="canjeados en total" />
            </div>

            <section style={panel}>
              <h2 style={h2}>Estado de los clientes</h2>
              <Reparto porEstado={m.porEstado} estados={estados} total={m.total} />
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 18, fontSize: 13, color: C.suave }}>
                <span>Vuelven una segunda vez: <strong style={{ color: C.texto }}>{m.tasaVuelta}%</strong></span>
                <span>Instalan el pase: <strong style={{ color: C.texto }}>{m.tasaInstalacion}%</strong></span>
                <span>Ritmo medio: <strong style={{ color: C.texto }}>{cadenciaTexto(m.cadenciaMedia)}</strong></span>
                <span>Visitas por cliente: <strong style={{ color: C.texto }}>{(m.visitasPorCliente ?? 0).toFixed(1)}</strong></span>
              </div>
              {m.total > 0 && m.tasaInstalacion < 60 && (
                <p style={{ ...nota, marginTop: 14 }}>
                  Solo el {m.tasaInstalacion}% ha añadido la tarjeta al teléfono; al resto no le llegan los avisos.
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
                <Rejilla rejilla={rejilla} accent={accent} />
              </section>
            </div>

            {ideas.length > 0 && (
              <section style={panel}>
                <h2 style={h2}>Lo que dicen los números</h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {ideas.map((o) => (
                    <div key={o.id} style={idea}>
                      <span style={{ color: accent, display: "inline-flex", marginTop: 2 }}><Icono nombre={o.accion?.tipo === "grupo" ? "clientes" : o.id === "pocos" ? "reloj" : "diana"} tam={18} /></span>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{o.texto}</div>
                        {o.detalle && <div style={{ fontSize: 13, color: C.suave, marginTop: 2 }}>{o.detalle}</div>}
                      </div>
                      {o.accion && (
                        <a href={enlaceDeAccion(slug, o.accion)} style={{ ...botonPequeno, textDecoration: "none", whiteSpace: "nowrap", alignSelf: "center" }}>
                          {o.accion.label}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: C.tenue, margin: "12px 0 0" }}>
                  Salen de las visitas de los últimos meses y del horario de la tienda. Son orientativas: mira la rejilla de arriba.
                </p>
              </section>
            )}

            {d.cohortes.length > 1 && (
              <section style={panel}>
                <h2 style={h2}>Por mes de alta</h2>
                <div style={{ overflowX: "auto" }}>
                <table style={tabla}>
                  <thead>
                    <tr>{["Mes", "Altas", "Repitieron", "Siguen activos", ""].map((t) => <th key={t} style={th}>{t}</th>)}</tr>
                  </thead>
                  <tbody>
                    {d.cohortes.map((c) => (
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
            )}
          </div>
        )}

        {/* ------------------------------------------------------- grupos */}
        {pestana === "grupos" && (
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ ...nota }}>
              Cada cliente puede estar en varios grupos a la vez: quien está a un sello del premio también puede llevar
              semanas sin venir. Toca uno para ver quién hay y escribirles.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))", gap: 12 }}>
              {grupos.map((g) => (
                <button key={g.key} type="button" disabled={!g.total} onClick={() => setGrupoVisto(g.key === grupoVisto ? null : g.key)}
                  style={tarjetaGrupo(g.key === grupoVisto, accent, g.total)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: accent, display: "inline-flex" }}><Icono nombre={g.icon} tam={18} /></span>
                    <strong style={{ fontSize: 14, fontWeight: 650 }}>{g.label}</strong>
                    <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 650 }}>{g.total}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: C.suave, margin: "6px 0 0", textAlign: "left" }}>{g.descripcion}</p>
                  <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 6, textAlign: "left" }}>
                    {g.contactables} avisable{g.contactables === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
            {grupoVisto && <DetalleGrupo g={grupos.find((x) => x.key === grupoVisto)} d={d} n={n} slug={slug} accent={accent}
              onVerFicha={setVerFicha} onVerLista={(k) => { setGrupo(k); setPestana("clientes"); }} />}
          </div>
        )}

        {/* ----------------------------------------------------- clientes */}
        {pestana === "clientes" && (
          <section style={panel}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "stretch" }}>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nombre o código…"
                aria-label="Buscar cliente"
                style={{ ...campo, flex: "1 1 220px", width: "auto" }}
              />
              <select value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo" style={{ ...campo, width: "auto" }}>
                <option value="">Todos los grupos</option>
                {grupos.map((g) => <option key={g.key} value={g.key} disabled={!g.total}>{g.label} · {g.total}</option>)}
              </select>
              <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden" style={{ ...campo, width: "auto" }}>
                {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <Exportar cuantos={lista.length} queContiene={queContiene} accent={accent} onDescargar={descargar} />
            </div>
            {grupoActivo && (
              <p style={{ ...nota, marginBottom: 14 }}>
                {grupoActivo.descripcion} ¿Quieres decirles algo? <a href={`/${slug}/avisos`} style={{ color: accent, fontWeight: 600 }}>Avisos</a>.
              </p>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={tabla}>
                <thead>
                  <tr>{["", "Cliente", "Estado", "Visitas", "Ritmo", "Última", "Cartilla"].map((t, i) => <th key={i} style={th}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {lista.slice(0, mostrar).map((c) => (
                    <tr key={c.serial} onClick={() => setVerFicha(c.serial)} style={{ cursor: "pointer" }}>
                      <td style={td}><span style={chipCodigo(accent)}>{c.codigo}</span></td>
                      <td style={td}>
                        {c.nombre || <span style={{ color: C.tenue }}>sin nombre</span>}
                        {c.nota && <span title={c.nota} style={marcaFila}><Icono nombre="nota" tam={14} titulo={`Nota: ${c.nota}`} /></span>}
                        {c.mensaje && <span title={`Mensaje en su pase: ${c.mensaje}`} style={marcaFila}><Icono nombre="megafono" tam={14} titulo="Tiene un mensaje en su tarjeta" /></span>}
                        {!c.perfil.avisable && <span title={c.perfil.contactable ? "No quiere promos" : "No tiene la tarjeta en el teléfono"} style={marcaFila}><Icono nombre="campanaNo" tam={14} titulo={c.perfil.contactable ? "No quiere promos" : "No le llegan avisos"} /></span>}
                      </td>
                      <td style={td}><Chip estado={c.perfil.estado} estados={estados} /></td>
                      <td style={td}>{c.perfil.visitas}</td>
                      <td style={{ ...td, color: C.suave }}>{cadenciaTexto(c.perfil.cadencia)}</td>
                      <td style={{ ...td, color: C.suave }}>{haceTexto(c.perfil.diasSinVenir)}</td>
                      <td style={td}>
                        {saldoCorto(c, n)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length > mostrar && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: C.suave }}>{mostrar} de {lista.length}</span>
                  <button type="button" onClick={() => setMostrar((m) => m + POR_PAGINA)} style={botonPequeno}>Ver {Math.min(POR_PAGINA, lista.length - mostrar)} más</button>
                </div>
              )}
              {!lista.length && (
                <p style={{ color: C.suave, fontSize: 14 }}>
                  {busca || grupo ? "Ningún cliente con esa búsqueda." : "Todavía no hay clientes."}
                </p>
              )}
            </div>
          </section>
        )}

        {verFicha && (
          <Ficha
            serial={verFicha}
            accent={accent}
            estados={estados}
            flash={flash}
            onCerrar={() => { setVerFicha(null); cargar(); }}
          />
        )}
        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

/** Un grupo abierto: quién hay y qué hacer con ellos (escribirles es en Avisos). */
function DetalleGrupo({ g, d, n, slug, accent, onVerFicha, onVerLista }) {
  const dentro = d.clientes.filter((c) => GRUPOS[g.key]?.incluye(c.perfil));
  const programar = enlaceDeAccion(slug, {
    tipo: "programar",
    base: { nombre: g.label, disparo: "grupo", valor: g.key, texto: (g.idea || "").replace("{premio}", n.premio), hora: "11:00", caduca: false },
  });
  return (
    <section style={panel}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ ...h2, margin: 0, flex: 1 }}>{g.label} · {g.total}</h2>
        <a href={`/${slug}/avisos?grupo=${g.key}`} style={botonPrimarioEnlace(accent)}>
          <Icono nombre="megafono" tam={16} /> Escribirles
        </a>
        <a href={programar} style={{ ...botonPequeno, textDecoration: "none" }}>Programarles un aviso</a>
        <button type="button" onClick={() => onVerLista(g.key)} style={botonPequeno}>Ver en la lista</button>
      </div>
      <p style={{ fontSize: 13, color: C.suave, margin: "8px 0 12px" }}>
        {g.descripcion} Les llega a {g.contactables} de {g.total}: al resto no, porque no tienen la tarjeta en el teléfono o no quieren promos.
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {dentro.slice(0, 8).map((c) => (
          <button key={c.serial} type="button" onClick={() => onVerFicha(c.serial)} style={filaGrupo}>
            <span style={chipCodigo(accent)}>{c.codigo}</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.nombre || <span style={{ color: C.tenue }}>sin nombre</span>}
            </span>
            <span style={{ fontSize: 13, color: C.suave, whiteSpace: "nowrap" }}>{haceTexto(c.perfil.diasSinVenir)} · {saldoCorto(c, n)}</span>
          </button>
        ))}
        {dentro.length > 8 && <span style={{ fontSize: 13, color: C.suave }}>Y {dentro.length - 8} más: «Ver en la lista».</span>}
      </div>
    </section>
  );
}

const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const idea = { display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", padding: "12px 14px", border: `1px solid ${C.borde}`, borderRadius: 12, background: C.panelSuave };
const tarjetaGrupo = (activa, accent, hay) => ({
  ...panel, padding: 14, textAlign: "left", cursor: hay ? "pointer" : "default",
  borderColor: activa ? accent : C.borde, background: activa ? `${accent}0c` : hay ? "#fff" : C.panelSuave,
  opacity: hay ? 1 : 0.55, font: "inherit", color: C.texto,
});
const filaGrupo = {
  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.borde}`,
  background: "#fff", cursor: "pointer", font: "inherit", color: C.texto, width: "100%",
};
const botonPrimarioEnlace = (accent) => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: accent, color: "#fff",
  fontWeight: 600, fontSize: 14, textDecoration: "none",
});
const marcaFila = { display: "inline-flex", verticalAlign: "-2px", marginLeft: 6, color: C.suave };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
// Sin partir líneas: en el móvil la tabla se desliza de lado en vez de apilar
// "sin nombre" en tres renglones por fila.
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle", whiteSpace: "nowrap" };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)", zIndex: 60,
};
