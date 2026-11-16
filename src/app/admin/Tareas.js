"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { confirmar } from "@/app/Dialogo";
import { useEnVivo } from "@/app/useEnVivo";
import { C, RADIO, campo, etiqueta as rotulo, botonPrimario, botonSecundario, botonPequeno, solapa, tinte, legible, aviso } from "@/app/ui";
import {
  COLUMNAS, HECHA, RESPONSABLES, PERSONAS, COLORES_ETIQUETA, MAX_TITULO, MAX_NOTA, MAX_NOMBRE_ETIQUETA, MAX_ETIQUETAS,
  porColumna, ordenEntre, esDe, personasDe, idDeEtiqueta,
} from "@/lib/tareas";

// ============================================================================
// PLATAFORMA → TAREAS
// ----------------------------------------------------------------------------
// El tablero de Víctor y Diego: cuatro columnas (las del vault), quién la lleva y
// una etiqueta de color que dice de qué va. Se arrastra con el ratón; en el móvil
// (sin arrastrar fiable) la columna se cambia desde la propia tarea. Mover se pinta
// al momento y la petición va detrás; si falla, vuelve a donde estaba.
// ============================================================================

const HECHAS_A_LA_VISTA = 8;
// Lo bastante a menudo para que se vea lo que mueve el otro casi al momento; cada
// pregunta es pequeña (la huella), y solo con el tablero a la vista.
const SEGUNDOS_EN_VIVO = 5;
const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");

export default function Tareas({ accent, flash }) {
  const [datos, setDatos] = useState(null); // { tareas, etiquetas, yo }
  const [error, setError] = useState(null);
  const [quien, setQuien] = useState("todas");
  const [deEtiqueta, setDeEtiqueta] = useState(null);
  const [abierta, setAbierta] = useState(null); // la tarea en el editor; sin id, una nueva
  const [conEtiquetas, setConEtiquetas] = useState(false);
  const [arrastrada, setArrastrada] = useState(null);
  const [destino, setDestino] = useState(null); // { columna, indice } donde caería
  const [todasHechas, setTodasHechas] = useState(false);
  // Con algo a medio guardar o una tarjeta en la mano, lo que traiga una recarga no se
  // pinta: lo primero aún no lo lleva y lo segundo movería el sitio donde se suelta.
  const enVuelo = useRef(0);
  const enLaMano = useRef(null);
  enLaMano.current = arrastrada;

  const cargar = useCallback(async ({ callado = false } = {}) => {
    try {
      const r = await fetch("/api/admin/tareas", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudieron cargar");
      if (enVuelo.current === 0 && !enLaMano.current) setDatos(d);
      setError(null);
    } catch (e) {
      if (!callado) setError(String(e?.message || e));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  // Lo que mueve el otro aparece solo: con el tablero a la vista, cada pocos segundos se
  // pregunta si cambió algo (tres consultas de una fila) y solo entonces se pide entero.
  // Con la pestaña oculta no pregunta; al volver, enseguida.
  useEnVivo({
    url: "/api/admin/tareas?huella=1",
    huella: datos?.huella,
    alCambiar: () => cargar({ callado: true }),
    cada: SEGUNDOS_EN_VIVO * 1000,
    activo: Boolean(datos),
  });

  async function pedir(url, method, cuerpo) {
    enVuelo.current++;
    try {
      const r = await fetch(url, {
        method,
        headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo guardar");
      return d;
    } finally {
      enVuelo.current--;
    }
  }

  const ponTarea = (t) => setDatos((d) => ({
    ...d,
    tareas: d.tareas.some((x) => x.id === t.id) ? d.tareas.map((x) => (x.id === t.id ? t : x)) : [...d.tareas, t],
  }));
  const quitaTarea = (id) => setDatos((d) => ({ ...d, tareas: d.tareas.filter((x) => x.id !== id) }));

  const etiquetas = datos?.etiquetas || [];
  const etiquetaDe = (id) => etiquetas.find((e) => e.id === id) || null;
  const columnas = useMemo(() => porColumna(datos?.tareas || []), [datos]);
  const seVe = (t) => (quien === "todas" || esDe(t, quien)) && (!deEtiqueta || t.etiqueta === deEtiqueta);

  /** Al final de su columna (en «Hecho», arriba: va por fecha). */
  const ordenAlFinal = (columna, sin) => ordenEntre(columnas[columna].filter((t) => t.id !== sin).at(-1)?.orden ?? null, null);

  async function mover(tarea, columna, orden) {
    const ahora = new Date().toISOString();
    ponTarea({ ...tarea, columna, orden, terminada: columna === HECHA ? (tarea.columna === HECHA ? tarea.terminada : ahora) : null });
    try {
      ponTarea(await pedir(`/api/admin/tareas?id=${encodeURIComponent(tarea.id)}`, "PATCH", { columna, orden }));
    } catch (e) {
      ponTarea(tarea);
      flash(e.message);
    }
  }

  async function guardar(cambios) {
    const vieja = abierta?.id ? datos.tareas.find((t) => t.id === abierta.id) : null;
    if (vieja) {
      const cuerpo = { ...cambios };
      if (cuerpo.columna !== vieja.columna) cuerpo.orden = ordenAlFinal(cuerpo.columna, vieja.id);
      ponTarea(await pedir(`/api/admin/tareas?id=${encodeURIComponent(vieja.id)}`, "PATCH", cuerpo));
    } else {
      ponTarea(await pedir("/api/admin/tareas", "POST", { ...cambios, orden: ordenAlFinal(cambios.columna) }));
    }
    setAbierta(null);
  }

  async function borrar(tarea) {
    const si = await confirmar({ titulo: "Borrar esta tarea", texto: `«${tarea.titulo}» desaparece del tablero. No se puede deshacer.`, si: "Borrar", peligro: true, accent });
    if (!si) return;
    try {
      await pedir(`/api/admin/tareas?id=${encodeURIComponent(tarea.id)}`, "DELETE");
      quitaTarea(tarea.id);
      setAbierta(null);
      flash("Tarea borrada");
    } catch (e) {
      flash(e.message);
    }
  }

  async function guardarEtiquetas(lista) {
    const guardadas = await pedir("/api/admin/tareas/etiquetas", "PUT", lista);
    setDatos((d) => ({ ...d, etiquetas: guardadas }));
    if (deEtiqueta && !guardadas.some((e) => e.id === deEtiqueta)) setDeEtiqueta(null);
    setConEtiquetas(false);
    flash("Etiquetas guardadas");
  }

  // ------------------------------------------------------------- arrastrar
  function alPasar(e, columna, sinLaArrastrada) {
    if (!arrastrada) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    let indice = 0;
    if (columna !== HECHA) {
      const nodos = [...e.currentTarget.querySelectorAll("[data-tarea]:not([data-arrastrada])")];
      indice = nodos.findIndex((n) => { const r = n.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (indice < 0) indice = sinLaArrastrada.length;
    }
    if (destino?.columna !== columna || destino?.indice !== indice) setDestino({ columna, indice });
  }

  function soltar(e, columna, visibles) {
    e.preventDefault();
    const tarea = datos.tareas.find((t) => t.id === arrastrada);
    const d = destino;
    setArrastrada(null);
    setDestino(null);
    if (!tarea || !d || d.columna !== columna) return;
    const resto = visibles.filter((t) => t.id !== tarea.id);
    if (tarea.columna === columna && (columna === HECHA || visibles.findIndex((t) => t.id === tarea.id) === d.indice)) return;
    const orden = columna === HECHA ? tarea.orden : ordenEntre(resto[d.indice - 1]?.orden ?? null, resto[d.indice]?.orden ?? null);
    mover(tarea, columna, orden);
  }

  if (error) return <div style={aviso(false)}>{error}</div>;
  if (!datos) return <p style={{ color: C.suave }}>Cargando…</p>;

  const abiertasDe = (p) => datos.tareas.filter((t) => t.columna !== HECHA && esDe(t, p)).length;

  return (
    <div>
      <style>{CSS}</style>

      {/* Quién y de qué: la leyenda de colores es también el filtro. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <button type="button" onClick={() => setQuien("todas")} style={solapa(quien === "todas", accent)}>Todas</button>
        {PERSONAS.map((p) => (
          <button key={p.id} type="button" onClick={() => setQuien(quien === p.id ? "todas" : p.id)} style={solapa(quien === p.id, accent)}>
            <Avatar persona={p} tam={18} />
            {p.nombre}{datos.yo === p.id ? " (tú)" : ""}
            <span style={{ color: C.tenue, fontWeight: 500 }}>{abiertasDe(p.id)}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {etiquetas.map((e) => {
          const activa = deEtiqueta === e.id;
          return (
            <button
              key={e.id} type="button" aria-pressed={activa}
              onClick={() => setDeEtiqueta(activa ? null : e.id)}
              style={{
                ...chipEtiqueta(e.color), cursor: "pointer", fontSize: 13, padding: "4px 10px",
                border: `1px solid ${activa ? e.color : "transparent"}`,
                background: activa ? tinte(e.color, 24) : tinte(e.color, 12),
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, background: e.color }} />
              {e.nombre}
            </button>
          );
        })}
        <button type="button" onClick={() => setConEtiquetas(true)} style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icono nombre="editar" tam={14} /> Etiquetas
        </button>
      </div>

      <div className="tablero">
        {COLUMNAS.map((col) => {
          let visibles = columnas[col.id].filter(seVe);
          const ocultas = col.id === HECHA && !todasHechas ? Math.max(0, visibles.length - HECHAS_A_LA_VISTA) : 0;
          if (ocultas) visibles = visibles.slice(0, HECHAS_A_LA_VISTA);
          const sinLaArrastrada = visibles.filter((t) => t.id !== arrastrada);
          const linea = (i) => destino?.columna === col.id && destino.indice === i && <div key={`linea-${i}`} style={lineaDestino(accent)} />;
          let k = 0;
          return (
            <section
              key={col.id}
              aria-label={col.nombre}
              onDragOver={(e) => alPasar(e, col.id, sinLaArrastrada)}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino(null); }}
              onDrop={(e) => soltar(e, col.id, visibles)}
              style={{
                background: C.panelSuave, border: `1px solid ${destino?.columna === col.id ? accent : C.borde}`,
                borderRadius: RADIO.panel, padding: 10, display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
              }}
            >
              <header style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "2px 4px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0 }}>{col.nombre}</h3>
                <span style={{ fontSize: 13, color: C.tenue }}>{columnas[col.id].filter(seVe).length}</span>
              </header>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 36 }}>
                {visibles.flatMap((t) => {
                  const esLa = t.id === arrastrada;
                  const antes = esLa ? null : linea(k++);
                  return [
                    antes,
                    <Tarjeta
                      key={t.id} tarea={t} etiqueta={etiquetaDe(t.etiqueta)} arrastrada={esLa}
                      onAbrir={() => setAbierta(t)}
                      onEmpezar={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); setArrastrada(t.id); }}
                      onAcabar={() => { setArrastrada(null); setDestino(null); }}
                    />,
                  ];
                })}
                {linea(k)}
                {!visibles.length && !destino && (
                  <p style={{ fontSize: 13, color: C.tenue, margin: "6px 4px" }}>
                    {col.id === HECHA ? "Lo terminado cae aquí." : "Nada por aquí."}
                  </p>
                )}
              </div>

              {ocultas > 0 && (
                <button type="button" onClick={() => setTodasHechas(true)} style={{ ...botonPequeno, background: "transparent" }}>
                  Ver {ocultas} más
                </button>
              )}
              {col.id === HECHA && todasHechas && columnas[col.id].filter(seVe).length > HECHAS_A_LA_VISTA && (
                <button type="button" onClick={() => setTodasHechas(false)} style={{ ...botonPequeno, background: "transparent" }}>
                  Solo las últimas
                </button>
              )}
              {col.id !== HECHA && (
                <button
                  type="button"
                  onClick={() => setAbierta({
                    columna: col.id,
                    quien: quien !== "todas" ? quien : datos.yo,
                    etiqueta: deEtiqueta,
                  })}
                  style={{ ...botonPequeno, background: "transparent", border: `1px dashed ${C.bordeFuerte}`, color: C.suave, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Icono nombre="mas" tam={14} /> Añadir tarea
                </button>
              )}
            </section>
          );
        })}
      </div>

      {abierta && (
        <EditorTarea
          key={abierta.id || "nueva"}
          tarea={abierta} etiquetas={etiquetas} accent={accent}
          onGuardar={guardar} onBorrar={borrar} onCerrar={() => setAbierta(null)}
        />
      )}
      {conEtiquetas && (
        <EditorEtiquetas
          etiquetas={etiquetas} tareas={datos.tareas} accent={accent}
          onGuardar={guardarEtiquetas} onCerrar={() => setConEtiquetas(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- una tarjeta
function Tarjeta({ tarea, etiqueta, arrastrada, onAbrir, onEmpezar, onAcabar }) {
  const hecha = tarea.columna === HECHA;
  return (
    <div
      data-tarea={tarea.id}
      data-arrastrada={arrastrada || undefined}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onEmpezar}
      onDragEnd={onAcabar}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir(); } }}
      className="tarea"
      style={{
        background: C.panel,
        border: `1px solid ${C.borde}`,
        borderLeft: `4px solid ${etiqueta?.color || C.bordeFuerte}`,
        borderRadius: RADIO.fila,
        padding: "9px 10px 9px 11px",
        cursor: "grab",
        opacity: arrastrada ? 0.4 : 1,
        display: "grid",
        gap: 6,
      }}
    >
      {etiqueta && <span style={{ ...chipEtiqueta(etiqueta.color), justifySelf: "start" }}>{etiqueta.nombre}</span>}
      <div style={{ fontSize: 14, fontWeight: 550, lineHeight: 1.35, overflowWrap: "anywhere", color: hecha ? C.suave : C.texto }}>
        {tarea.titulo}
      </div>
      {(tarea.nota || hecha || tarea.quien) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.tenue }}>
          {hecha && <><Icono nombre="check" tam={13} /> {fechaCorta(tarea.terminada)}</>}
          {tarea.nota && <span title="Tiene nota" style={{ display: "inline-flex" }}><Icono nombre="nota" tam={14} /></span>}
          <div style={{ flex: 1 }} />
          <Avatares quien={tarea.quien} />
        </div>
      )}
    </div>
  );
}

function Avatar({ persona, tam = 22, borde = false }) {
  return (
    <span
      title={persona.nombre}
      style={{
        width: tam, height: tam, borderRadius: "50%", background: persona.color, color: "#fff",
        display: "inline-grid", placeItems: "center", fontSize: Math.round(tam * 0.5), fontWeight: 700, flexShrink: 0,
        boxShadow: borde ? `0 0 0 2px ${C.panel}` : "none",
      }}
    >
      {persona.inicial}
    </span>
  );
}

function Avatares({ quien }) {
  const personas = personasDe(quien);
  if (!personas.length) return null;
  return (
    <span style={{ display: "inline-flex" }} aria-label={RESPONSABLES.find((r) => r.id === quien)?.nombre}>
      {personas.map((p, i) => <span key={p.id} style={{ marginLeft: i ? -6 : 0 }}><Avatar persona={p} borde /></span>)}
    </span>
  );
}

// ------------------------------------------------------------- ventanas
// Las dos van en un <dialog> como las de app/Dialogo.js: Escape cierra y el foco
// queda dentro. Tocar fuera solo cierra si no se ha cambiado nada: perder una nota
// escrita por rozar el fondo no compensa.
function Ventana({ titulo, cambiado, onCerrar, children, ancho = 520 }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal enfoca lo primero que encuentra (la X); lo que se va a escribir va antes.
    d?.querySelector("[data-foco]")?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="ventana"
      aria-label={titulo}
      onCancel={(e) => { e.preventDefault(); onCerrar(); }}
      onClick={(e) => { if (e.target === ref.current && !cambiado) onCerrar(); }}
      style={{ border: 0, padding: 0, background: "transparent", color: C.texto, width: `min(${ancho}px, calc(100% - 32px))`, maxWidth: "none" }}
    >
      <div style={{ background: C.panel, borderRadius: RADIO.panel + 2, padding: "18px 20px 16px", boxShadow: "0 18px 50px rgb(0 0 0 / 0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: 17, fontWeight: 650, margin: 0, flex: 1 }}>{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ border: 0, background: "transparent", color: C.suave, cursor: "pointer", padding: 4, display: "inline-flex" }}>
            <Icono nombre="cerrar" tam={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Opciones({ opciones, valor, onCambio, accent }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opciones.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={valor === o.id} onClick={() => onCambio(o.id)} style={{ ...solapa(valor === o.id, accent), fontSize: 13, padding: "0.4rem 0.75rem" }}>
          {o.contenido || o.nombre}
        </button>
      ))}
    </div>
  );
}

function EditorTarea({ tarea, etiquetas, accent, onGuardar, onBorrar, onCerrar }) {
  const nueva = !tarea.id;
  const inicial = {
    titulo: tarea.titulo || "",
    nota: tarea.nota || "",
    // Una etiqueta que ya no existe se edita como «sin etiqueta».
    etiqueta: etiquetas.some((e) => e.id === tarea.etiqueta) ? tarea.etiqueta : null,
    quien: tarea.quien ?? null,
    columna: tarea.columna,
  };
  const [f, setF] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const cambiado = JSON.stringify(f) !== JSON.stringify(inicial);

  async function enviar(e) {
    e?.preventDefault();
    if (!f.titulo.trim()) return setError("Escribe qué hay que hacer");
    setOcupado(true);
    setError(null);
    try {
      await onGuardar(f);
    } catch (err) {
      setError(String(err?.message || err));
      setOcupado(false);
    }
  }

  return (
    <Ventana titulo={nueva ? "Nueva tarea" : "Tarea"} cambiado={cambiado} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <label style={rotulo} htmlFor="tarea-titulo">Qué hay que hacer</label>
        <input
          id="tarea-titulo" value={f.titulo} maxLength={MAX_TITULO} data-foco={nueva || undefined}
          onChange={(e) => set("titulo", e.target.value)} placeholder="Escribir a la cafetería de la esquina"
          style={campo}
        />

        <span style={rotulo}>De qué va</span>
        <Opciones
          accent={accent} valor={f.etiqueta} onCambio={(v) => set("etiqueta", v)}
          opciones={[
            ...etiquetas.map((e) => ({
              id: e.id,
              contenido: <><span style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />{e.nombre}</>,
            })),
            { id: null, nombre: "Sin etiqueta" },
          ]}
        />

        <span style={rotulo}>Quién la lleva</span>
        <Opciones
          accent={accent} valor={f.quien} onCambio={(v) => set("quien", v)}
          opciones={[
            ...RESPONSABLES.map((r) => ({ id: r.id, contenido: <><Avatares quien={r.id} />{r.nombre}</> })),
            { id: null, nombre: "Sin decidir" },
          ]}
        />

        <span style={rotulo}>Columna</span>
        <Opciones accent={accent} valor={f.columna} onCambio={(v) => set("columna", v)} opciones={COLUMNAS} />

        <label style={rotulo} htmlFor="tarea-nota">Nota</label>
        <textarea
          id="tarea-nota" value={f.nota} maxLength={MAX_NOTA} rows={3}
          onChange={(e) => set("nota", e.target.value)} placeholder="Lo que haga falta saber (opcional)"
          style={{ ...campo, resize: "vertical", fontFamily: "inherit", fontSize: 14 }}
        />

        {!nueva && (
          <p style={{ fontSize: 12, color: C.tenue, margin: "8px 0 0" }}>
            Creada el {fechaCorta(tarea.creado)}{tarea.autor ? ` por ${PERSONAS.find((p) => p.id === tarea.autor)?.nombre || tarea.autor}` : ""}
            {tarea.terminada ? ` · terminada el ${fechaCorta(tarea.terminada)}` : ""}
          </p>
        )}
        {error && <div style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
          {!nueva && (
            <button type="button" onClick={() => onBorrar(tarea)} style={{ ...botonSecundario, color: C.mal, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icono nombre="papelera" tam={15} /> Borrar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onCerrar} style={botonSecundario}>Cancelar</button>
          <button type="submit" disabled={ocupado} aria-busy={ocupado || undefined} style={botonPrimario(accent)}>
            {nueva ? "Crear tarea" : "Guardar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}

function EditorEtiquetas({ etiquetas, tareas, accent, onGuardar, onCerrar }) {
  const [lista, setLista] = useState(etiquetas);
  const [paleta, setPaleta] = useState(null); // la que tiene los colores abiertos
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const cambiado = JSON.stringify(lista) !== JSON.stringify(etiquetas);
  const usos = (id) => tareas.filter((t) => t.etiqueta === id).length;
  const cambiar = (id, k, v) => setLista((l) => l.map((e) => (e.id === id ? { ...e, [k]: v } : e)));

  function nueva() {
    const color = COLORES_ETIQUETA.find((c) => !lista.some((e) => e.color === c)) || COLORES_ETIQUETA[0];
    const id = idDeEtiqueta(`nueva-${lista.length + 1}`, [...lista, ...etiquetas]);
    setLista((l) => [...l, { id, nombre: "", color }]);
    setPaleta(id);
  }

  async function quitar(e) {
    const n = usos(e.id);
    if (n) {
      const si = await confirmar({
        titulo: `Quitar «${e.nombre || "esta etiqueta"}»`,
        texto: `${n === 1 ? "Una tarea la lleva y se quedará" : `${n} tareas la llevan y se quedarán`} sin etiqueta.`,
        si: "Quitar", peligro: true, accent,
      });
      if (!si) return;
    }
    setLista((l) => l.filter((x) => x.id !== e.id));
  }

  async function enviar(ev) {
    ev.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      // Las nuevas toman el identificador de su nombre, que se lee mejor en la base.
      const usados = lista.filter((e) => etiquetas.some((x) => x.id === e.id));
      const final = lista.map((e) => {
        if (etiquetas.some((x) => x.id === e.id)) return e;
        const id = idDeEtiqueta(e.nombre, usados);
        usados.push({ id });
        return { ...e, id };
      });
      await onGuardar(final);
    } catch (err) {
      setError(String(err?.message || err));
      setOcupado(false);
    }
  }

  return (
    <Ventana titulo="Etiquetas" cambiado={cambiado} onCerrar={onCerrar} ancho={460}>
      <form onSubmit={enviar}>
        <p style={{ fontSize: 13, color: C.suave, margin: "6px 0 12px" }}>
          El color dice de qué va cada tarea. Quitar una no borra ninguna tarea.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map((e) => (
            <div key={e.id}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button" aria-label={`Color de ${e.nombre || "la etiqueta"}`} aria-expanded={paleta === e.id}
                  onClick={() => setPaleta(paleta === e.id ? null : e.id)}
                  style={{ width: 34, height: 34, borderRadius: RADIO.boton, border: `1px solid ${C.bordeFuerte}`, background: e.color, cursor: "pointer", flexShrink: 0 }}
                />
                <input
                  value={e.nombre} maxLength={MAX_NOMBRE_ETIQUETA} placeholder="Nombre" aria-label="Nombre de la etiqueta"
                  autoFocus={!e.nombre}
                  onChange={(ev) => cambiar(e.id, "nombre", ev.target.value)}
                  style={{ ...campo, padding: "0.45rem 0.65rem", fontSize: 14 }}
                />
                <span style={{ fontSize: 12, color: C.tenue, minWidth: 22, textAlign: "right" }} title="Tareas con esta etiqueta">{usos(e.id) || ""}</span>
                <button type="button" onClick={() => quitar(e)} aria-label={`Quitar ${e.nombre}`} style={{ ...botonPequeno, color: C.mal, display: "inline-flex", padding: "0.45rem" }}>
                  <Icono nombre="papelera" tam={15} />
                </button>
              </div>
              {paleta === e.id && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 4px 42px" }}>
                  {COLORES_ETIQUETA.map((c) => (
                    <button
                      key={c} type="button" aria-label={c} aria-pressed={e.color === c}
                      onClick={() => { cambiar(e.id, "color", c); setPaleta(null); }}
                      style={{
                        width: 26, height: 26, borderRadius: 8, background: c, cursor: "pointer",
                        border: 0, boxShadow: e.color === c ? `0 0 0 2px ${C.panel}, 0 0 0 4px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {lista.length < MAX_ETIQUETAS && (
          <button type="button" onClick={nueva} style={{ ...botonPequeno, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icono nombre="mas" tam={14} /> Nueva etiqueta
          </button>
        )}
        {error && <div style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" onClick={onCerrar} style={botonSecundario}>Cancelar</button>
          <button type="submit" disabled={ocupado || !cambiado} aria-busy={ocupado || undefined} style={{ ...botonPrimario(accent), opacity: cambiado ? 1 : 0.5 }}>
            Guardar
          </button>
        </div>
      </form>
    </Ventana>
  );
}

// ------------------------------------------------------------- estilos
const chipEtiqueta = (color) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  background: tinte(color, 14), color: legible(color),
});

const lineaDestino = (accent) => ({ height: 3, borderRadius: 2, background: accent, margin: "-2px 2px" });

// Cuatro columnas en el ordenador; en el móvil, una tras otra deslizando de lado
// (como Trello): apiladas, «Hecho» quedaba a varias pantallas de distancia.
const CSS = `
  .tablero { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: start; }
  .tablero .tarea:focus-visible { outline: 2px solid ${C.azul}; outline-offset: 2px; }
  .tablero .tarea:hover { box-shadow: 0 1px 5px rgb(0 0 0 / 0.08); }
  @media (max-width: 759px) {
    .tablero { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 0 16px 8px; scroll-padding: 0 16px; }
    .tablero > section { flex: 0 0 82%; scroll-snap-align: start; }
  }
`;
