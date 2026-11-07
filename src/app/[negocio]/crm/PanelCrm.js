"use client";

import Icono from "@/app/Icono";
import { useEffect, useMemo, useRef, useState } from "react";
import { cadenciaTexto, GRUPOS, ideaDeGrupo } from "@/lib/crm";
import { ultimaVezTexto, fechaHoraTexto, zonaDe } from "@/lib/actividad";
import { enlaceDeAccion } from "@/lib/observaciones";
import { csvClientes } from "@/lib/exportar";
import { Chip } from "./piezas";
import Resumen from "./Resumen";
import Ficha from "./Ficha";
import Exportar, { bajarCsv } from "./Exportar";
import Actividad from "./Actividad";
import Solapas from "../Solapas";
import { pestanasDe } from "./pestanas";
import { tiene } from "@/lib/planes";
import { saldoCorto } from "@/lib/cartillas";
import { C, panel, campo, h2, botonPequeno, chipCodigo, legible, tinte } from "@/app/ui";
import { useGestion } from "../MarcoGestion";
import { useEnVivo } from "@/app/useEnVivo";
import { Visto } from "@/app/useVisto";
import Rueda from "@/app/Rueda";

const POR_PAGINA = 50; // con cientos de clientes la tabla se pinta a tramos
// Filtro de la lista que no es un grupo del CRM: las tarjetas que nadie guardó
// ni usó (lib/crm.js, `descartada`). No son clientes: fuera de "Todos" salvo
// que se busquen por código o nombre.
const DESCARTADAS = "descartadas";

// ============================================================================
// CRM DE UNA TIENDA
// ----------------------------------------------------------------------------
// Una pestaña por pregunta:
//   RESUMEN   ¿cómo va la tienda? cifras, el camino de la tarjeta (de sacarla a
//             canjear) y dónde se queda la cartilla, reparto de clientes,
//             cuándo vienen y lo que dicen los números (lib/observaciones.js)
//   GRUPOS    los grupos del CRM en tarjetas: quién hay en cada uno y, con un
//             toque, escribirles (lleva a Avisos con el grupo ya elegido)
//   CLIENTES  ¿quién es este? la tabla, la búsqueda, la ficha de cada uno y la
//             exportación (de lo que se está viendo, y solo aquí)
//   ACTIVIDAD ¿cuadra con la caja? lo que pasó un día, hora a hora y movimiento
//             a movimiento, para compararlo con los tickets (lib/actividad.js)
// Escribir el mensaje vive en Avisos: aquí se ve a quién, allí se dice qué.
//
// Todo llega en UNA petición a /api/crm; las cuentas que dependen de la hora
// local (a qué hora viene la gente) se hacen aquí, con el reloj de la tienda.
// ============================================================================

const ORDENES = {
  reciente: { label: "Última visita", cmp: (a, b) => (a.perfil.diasSinVenir ?? 1e9) - (b.perfil.diasSinVenir ?? 1e9) },
  visitas: { label: "Más visitas", cmp: (a, b) => b.perfil.visitas - a.perfil.visitas },
  alta: { label: "Más nuevos", cmp: (a, b) => (b.creado || "").localeCompare(a.creado || "") },
  riesgo: { label: "Más retraso", cmp: (a, b) => (b.perfil.retraso ?? -1) - (a.perfil.retraso ?? -1) },
};

// Llega con los datos ya cargados en el servidor (page.js): nada de pantalla
// vacía esperando a otra petición. `cargar()` recarga tras un cambio y cuando
// la huella de la tienda dice que hay algo nuevo (useEnVivo): con la pantalla
// abierta, los clientes nuevos entran solos y las cifras ruedan.
//
// `deMemoria`: lo pinta loading.js con lo último que se vio en esta visita
// (MarcoGestion, `memoria`) mientras llega lo del servidor. Ese no pregunta
// nada ni guarda nada: en un segundo lo sustituye el de verdad, que arranca en
// la misma pestaña, el mismo filtro y la misma búsqueda.
export default function PanelCrm({ slug, inicial, deMemoria = false }) {
  const g = useGestion();
  const clave = `crm:${slug}`;
  const recuerdo = g?.memoria?.get(clave);
  const [d, setD] = useState(inicial);
  // Las que deja su plan (lib/planes.js); se abre en la primera.
  const pestanas = pestanasDe(inicial.negocio.funciones);
  const [pestana, setPestana] = useState(() => (pestanas.some(([k]) => k === recuerdo?.pestana) ? recuerdo.pestana : pestanas[0][0]));
  const conGrupos = tiene(inicial.negocio, "grupos");
  const [grupo, setGrupo] = useState(recuerdo?.grupo ?? "");
  const [verFicha, setVerFicha] = useState(null);
  const [busca, setBusca] = useState(recuerdo?.busca ?? "");
  const [orden, setOrden] = useState(recuerdo?.orden ?? "reciente");
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

  useEnVivo({ url: `/api/crm/huella?b=${slug}`, huella: d.huella, alCambiar: cargar, activo: !deMemoria });

  // Para volver a esta pestaña sin esqueleto (ver arriba).
  useEffect(() => {
    if (!deMemoria) g?.memoria?.set(clave, { d, pestana, grupo, busca, orden });
  }, [d, pestana, grupo, busca, orden, deMemoria, clave, g?.memoria]);

  // Los clientes que no estaban la última vez que se miró en esta visita (al volver
  // a la pestaña) o que llegan con ella abierta: entran en la lista iluminados.
  const conocidos = useRef(null);
  const [nuevos, setNuevos] = useState(() => new Set());
  useEffect(() => {
    if (deMemoria) return;
    const ahora = d.clientes.map((c) => c.serial);
    if (!conocidos.current) {
      conocidos.current = new Set((recuerdo?.d ?? inicial).clientes.map((c) => c.serial));
    }
    const llegan = ahora.filter((s) => !conocidos.current.has(s));
    ahora.forEach((s) => conocidos.current.add(s));
    if (!llegan.length) return undefined;
    setNuevos((antes) => new Set([...antes, ...llegan]));
    // Pasado el brillo dejan de ser nuevos: al filtrar o pasar de página no vuelven a entrar.
    setTimeout(() => setNuevos((antes) => new Set([...antes].filter((s) => !llegan.includes(s)))), 3000);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const [grupoVisto, setGrupoVisto] = useState(null);

  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return d.clientes
      .filter((c) => (grupo === DESCARTADAS ? c.perfil.descartada : (!grupo || GRUPOS[grupo]?.incluye(c.perfil)) && (q || !c.perfil.descartada)))
      .filter((c) => !q || (c.nombre || "").toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q))
      .sort(ORDENES[orden].cmp);
  }, [d, busca, orden, grupo]);
  useEffect(() => setMostrar(POR_PAGINA), [busca, orden, grupo]);

  const { negocio: n, metricas: m, grupos, estados } = d;
  const accent = n.tema.accent;
  const zona = zonaDe(n);
  const grupoActivo = grupos.find((g) => g.key === grupo);

  // La hoja se arma AQUÍ, con la lista que se ve: lo que hay en pantalla es lo que baja.
  function descargar() {
    const csv = csvClientes(lista.map((c) => ({ cliente: c, perfil: c.perfil })), n);
    bajarCsv({ csv, fichero: `${slug}-${grupo || "clientes"}.csv`, slug, cuantos: lista.length, que: grupo || "todos" });
  }
  const queContiene = [
    grupoActivo ? `Los de «${grupoActivo.label}»` : grupo === DESCARTADAS ? "Las tarjetas sin guardar ni usar" : "Todos tus clientes",
    busca.trim() && `que coinciden con «${busca.trim()}»`,
  ].filter(Boolean).join(" ");

  return (
    <>

        <Solapas pestanas={pestanas} activa={pestana} accent={accent} onCambiar={setPestana} />

        {/* ------------------------------------------------------ resumen */}
        {pestana === "resumen" && (
          <Resumen d={d} slug={slug} accent={accent} onVerDescartadas={() => { setGrupo(DESCARTADAS); setPestana("clientes"); }} />
        )}

        {/* ------------------------------------------------------- grupos */}
        {pestana === "grupos" && (
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ ...nota }}>
              Cada cliente puede estar en varios grupos a la vez: quien está a un punto del premio también puede llevar
              semanas sin venir. Toca uno para ver quién hay y escribirles.
            </p>
            <Visto id={`${slug}:grupos`} valor={grupos.map(({ key, total, contactables }) => ({ key, total, contactables }))}>
              {(cuentas, finales, gira) => (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))", gap: 12 }}>
              {grupos.map((g, i) => (
                <button key={g.key} type="button" disabled={!g.total} onClick={() => setGrupoVisto(g.key === grupoVisto ? null : g.key)}
                  style={tarjetaGrupo(g.key === grupoVisto, accent, g.total)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: legible(accent), display: "inline-flex" }}><Icono nombre={g.icon} tam={18} /></span>
                    <strong style={{ fontSize: 14, fontWeight: 650 }}>{g.label}</strong>
                    <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 650 }}><Rueda valor={finales[i]?.total ?? g.total} gira={gira} /></span>
                  </div>
                  <p style={{ fontSize: 12.5, color: C.suave, margin: "6px 0 0", textAlign: "left" }}>{g.descripcion}</p>
                  <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 6, textAlign: "left" }}>
                    {cuentas[i]?.contactables ?? g.contactables} avisable{g.contactables === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
              )}
            </Visto>
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
                <option value="">{conGrupos ? "Todos los grupos" : "Todos"}</option>
                {conGrupos && grupos.map((g) => <option key={g.key} value={g.key} disabled={!g.total}>{g.label} · {g.total}</option>)}
                {m.descartadas > 0 && <option value={DESCARTADAS}>Sin guardar ni usar · {m.descartadas}</option>}
              </select>
              <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden" style={{ ...campo, width: "auto" }}>
                {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <Exportar cuantos={lista.length} queContiene={queContiene} accent={accent} onDescargar={descargar} />
            </div>
            {grupo === DESCARTADAS && (
              <p style={{ ...nota, marginBottom: 14 }}>{estados.find((e) => e.key === "descartada")?.descripcion}</p>
            )}
            {grupoActivo && (
              <p style={{ ...nota, marginBottom: 14 }}>
                {grupoActivo.descripcion} ¿Quieres decirles algo? <a href={`/${slug}/avisos`} style={{ color: legible(accent), fontWeight: 600 }}>Avisos</a>.
              </p>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={tabla}>
                <thead>
                  <tr>{["", "Cliente", "Estado", "Visitas", "Ritmo", "Última", "Cartilla"].map((t, i) => <th key={i} style={th}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {lista.slice(0, mostrar).map((c) => (
                    <tr key={c.serial} onClick={() => setVerFicha(c.serial)} className={nuevos.has(c.serial) ? "fila-nueva" : undefined}
                      style={{ cursor: "pointer", opacity: c.perfil.descartada ? 0.6 : 1, "--fila-nueva": tinte(accent, 22) }}>
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
                      <td style={{ ...td, color: C.suave }} title={fechaHoraTexto(c.ultima_visita || c.creado, zona)}>
                        {ultimaVezTexto(c.ultima_visita || c.creado, zona)}
                      </td>
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
              {!grupo && !busca.trim() && m.descartadas > 0 && (
                <p style={{ fontSize: 12.5, color: C.tenue, margin: "12px 0 0" }}>
                  No salen {m.descartadas} tarjeta{m.descartadas === 1 ? "" : "s"} sin guardar ni usar.{" "}
                  <button type="button" onClick={() => setGrupo(DESCARTADAS)} style={enlaceSuave}>Verlas</button>
                </p>
              )}
            </div>
          </section>
        )}

        {/* ---------------------------------------------------- actividad */}
        {pestana === "actividad" && <Actividad d={d} n={n} slug={slug} accent={accent} onVerFicha={setVerFicha} />}

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
    </>
  );
}

/** Un grupo abierto: quién hay y qué hacer con ellos (escribirles es en Avisos). */
function DetalleGrupo({ g, d, n, slug, accent, onVerFicha, onVerLista }) {
  const dentro = d.clientes.filter((c) => GRUPOS[g.key]?.incluye(c.perfil));
  const programar = enlaceDeAccion(slug, {
    tipo: "programar",
    base: { nombre: g.label, disparo: "grupo", valor: g.key, texto: ideaDeGrupo(g.idea, n), hora: "11:00", caduca: false },
  });
  return (
    <section style={panel}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ ...h2, margin: 0, flex: 1 }}>{g.label} · {g.total}</h2>
        <a href={`/${slug}/avisos?grupo=${g.key}`} style={botonPrimarioEnlace(accent)}>
          <Icono nombre="megafono" tam={16} /> Escribirles
        </a>
        {/* Los programados solo existen si el admin los encendió; si no, la hora se elige en Enviar. */}
        {n.avisosAvanzados && <a href={programar} style={{ ...botonPequeno, textDecoration: "none" }}>Programarles un aviso</a>}
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
            <span style={{ fontSize: 13, color: C.suave, whiteSpace: "nowrap" }}>{ultimaVezTexto(c.ultima_visita || c.creado, zonaDe(n))} · {saldoCorto(c, n)}</span>
          </button>
        ))}
        {dentro.length > 8 && <span style={{ fontSize: 13, color: C.suave }}>Y {dentro.length - 8} más: «Ver en la lista».</span>}
      </div>
    </section>
  );
}

const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const tarjetaGrupo = (activa, accent, hay) => ({
  ...panel, padding: 14, textAlign: "left", cursor: hay ? "pointer" : "default",
  borderColor: activa ? accent : C.borde, background: activa ? `${accent}0c` : hay ? C.panel : C.panelSuave,
  opacity: hay ? 1 : 0.55, font: "inherit", color: C.texto,
});
const filaGrupo = {
  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.borde}`,
  background: C.panel, cursor: "pointer", font: "inherit", color: C.texto, width: "100%",
};
const botonPrimarioEnlace = (accent) => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: accent, color: "#fff",
  fontWeight: 600, fontSize: 14, textDecoration: "none",
});
const enlaceSuave = { background: "none", border: 0, padding: 0, font: "inherit", color: C.suave, textDecoration: "underline", cursor: "pointer" };
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
  background: C.toastFondo, color: C.toastTexto, padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)", zIndex: 60,
};
