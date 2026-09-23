"use client";

import Icono from "@/app/Icono";
import { useEffect, useMemo, useState } from "react";
import CabeceraGestion from "../CabeceraGestion";
import { serieVisitas, rejillaHoraria, tendencia, haceTexto, cadenciaTexto } from "@/lib/crm";
import { Cifra, Barras, Rejilla, Reparto, Chip } from "./piezas";
import Campana from "./Campana";
import Ficha from "./Ficha";
import Exportar from "./Exportar";
import { saldoCorto } from "@/lib/cartillas";
import { C, pagina, panel, campo, h2, botonPequeno, chipCodigo, solapa } from "@/app/ui";

const POR_PAGINA = 50; // con cientos de clientes la tabla se pinta a tramos

// ============================================================================
// CRM DE UNA TIENDA
// ----------------------------------------------------------------------------
// Tres pestañas, tres preguntas:
//   RESUMEN   ¿cómo va la tienda? cifras, reparto de clientes, cuándo vienen
//   GRUPOS    ¿a quién le hablo hoy? bloques de gente con algo en común
//   CLIENTES  ¿quién es este? la tabla, la búsqueda y la ficha de cada uno
//
// Todo llega en UNA petición a /api/crm; las cuentas que dependen de la hora
// local (a qué hora viene la gente) se hacen aquí, con el reloj de la tienda.
// ============================================================================

const PESTANAS = [["resumen", "Resumen"], ["grupos", "Grupos y avisos"], ["clientes", "Clientes"]];
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
  const [grupo, setGrupo] = useState(null);
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

  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return d.clientes
      .filter((c) => !q || (c.nombre || "").toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q))
      .sort(ORDENES[orden].cmp);
  }, [d, busca, orden]);
  useEffect(() => setMostrar(POR_PAGINA), [busca, orden]);

  const { negocio: n, metricas: m, grupos, estados } = d;
  const accent = n.tema.accent;
  const grupoActivo = grupos.find((g) => g.key === grupo);

  return (
    <main style={pagina}>
      <div style={{ width: "min(1100px, 96vw)" }}>
        <CabeceraGestion negocio={n} slug={slug} activa="crm" />

        <div style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
          {PESTANAS.map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setPestana(id)} style={solapa(pestana === id, accent)}>
              {texto}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <Exportar href={`/api/crm/export?b=${slug}`} accent={accent} />
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
              <section style={panel}>
                <h2 style={h2}>Visitas de los últimos 30 días</h2>
                <Barras serie={serie} accent={accent} />
              </section>
              <section style={panel}>
                <h2 style={h2}>A qué horas viene la gente</h2>
                <Rejilla rejilla={rejilla} accent={accent} />
              </section>
            </div>

            {d.cohortes.length > 1 && (
              <section style={panel}>
                <h2 style={h2}>Por mes de alta</h2>
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
              </section>
            )}
          </div>
        )}

        {/* ------------------------------------------------------- grupos */}
        {pestana === "grupos" && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {grupos.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGrupo(g.key === grupo ? null : g.key)}
                  disabled={!g.total}
                  style={tarjetaGrupo(g.key === grupo, accent, g.total)}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ color: accent, alignSelf: "center" }}><Icono nombre={g.icon} tam={18} /></span>
                    <strong style={{ fontSize: 14, fontWeight: 650 }}>{g.label}</strong>
                    <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 650 }}>{g.total}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.suave, margin: "6px 0 0", textAlign: "left" }}>{g.descripcion}</p>
                  <div style={{ fontSize: 11, color: C.tenue, marginTop: 6, textAlign: "left" }}>
                    {g.contactables} avisable{g.contactables === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>

            {grupoActivo ? (
              <section style={panel}>
                <Campana
                  negocio={n}
                  grupo={grupo}
                  catalogo={grupos}
                  flash={flash}
                  onEnviada={() => { cargar(); setGrupo(null); }}
                />
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.borde}` }}>
                  <Exportar
                    href={`/api/crm/export?b=${slug}&grupo=${grupo}`}
                    accent={accent}
                    texto="Exportar este grupo"
                    alinear="izquierda"
                    queContiene={`los clientes de «${grupoActivo.label}»`}
                  />
                </div>
              </section>
            ) : (
              <p style={nota}>
                Un cliente puede estar en varios grupos. Elige uno para enviarle un aviso.
              </p>
            )}

            {d.campanas.length > 0 && (
              <section style={panel}>
                <h2 style={h2}>Avisos enviados</h2>
                <table style={tabla}>
                  <thead>
                    <tr>{["Cuándo", "Grupo", "Mensaje", "A", "Volvieron"].map((t) => <th key={t} style={th}>{t}</th>)}</tr>
                  </thead>
                  <tbody>
                    {d.campanas.map((c) => (
                      <tr key={c.id}>
                        <td style={td}>{new Date(c.creado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</td>
                        <td style={td}>{d.catalogoGrupos.find((g) => g.key === c.grupo)?.label || c.grupo}</td>
                        <td style={{ ...td, maxWidth: 260 }}>{c.texto}</td>
                        <td style={td}>{c.destinatarios}</td>
                        <td style={td}>
                          <strong style={{ color: c.volvieron ? C.ok : C.suave }}>{c.volvieron}</strong>
                          <span style={{ color: C.tenue, fontSize: 12 }}> · {c.tasa}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 12, color: C.tenue, marginTop: 10, marginBottom: 0 }}>
                  «Volvieron»: avisados que visitaron la tienda después del envío.
                </p>
              </section>
            )}
          </div>
        )}

        {/* ----------------------------------------------------- clientes */}
        {pestana === "clientes" && (
          <section style={panel}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nombre o código…"
                style={{ ...campo, flex: "1 1 220px", width: "auto" }}
              />
              <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ ...campo, width: "auto" }}>
                {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

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
                        {!c.perfil.contactable && <span title="No tiene la tarjeta en el teléfono" style={marcaFila}><Icono nombre="campanaNo" tam={14} titulo="No le llegan avisos" /></span>}
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
                  {busca ? "Ningún cliente con ese nombre o código." : "Todavía no hay clientes."}
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

const tarjetaGrupo = (activa, accent, hay) => ({
  ...panel, padding: 14, textAlign: "left", cursor: hay ? "pointer" : "default",
  borderColor: activa ? accent : C.borde,
  background: activa ? `${accent}0c` : hay ? "#fff" : C.panelSuave,
  opacity: hay ? 1 : 0.55,
  font: "inherit", color: C.texto,
});
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const marcaFila = { display: "inline-flex", verticalAlign: "-2px", marginLeft: 6, color: C.suave };
const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle" };
const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)", zIndex: 60,
};
