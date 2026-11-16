"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { confirmar } from "@/app/Dialogo";
import { useEnVivo } from "@/app/useEnVivo";
import { C, RADIO, campo, etiqueta as rotulo, botonPrimario, botonSecundario, botonPequeno, solapa, tinte, aviso } from "@/app/ui";
import {
  COLUMNAS, HECHA, RESPONSABLES, PERSONAS, COLORES_ETIQUETA, MAX_TITULO, MAX_NOTA, MAX_NOMBRE_ETIQUETA, MAX_ETIQUETAS,
  porColumna, repartir, esDeClaude, tintaSobre, ordenEntre, esDe, personasDe, idDeEtiqueta,
} from "@/lib/tareas";

// ============================================================================
// PLATAFORMA → TAREAS
// ----------------------------------------------------------------------------
// El tablero de Víctor y Diego: cuatro columnas (las del vault) y debajo, sin
// columnas, lo que apuntó Claude desde el vault y nadie ha hecho suyo todavía.
//
// Poco a la vista, a propósito (16-11-2026: «abruma»): la tarjeta ES su color (el
// de la etiqueta la rellena; la fila de arriba hace de leyenda y de filtro) y solo
// lleva el título y quién. Archivar y borrar salen al pasar el ratón; con el dedo,
// dentro de la tarea. Una tarea nueva se escribe en la propia columna.
//
// Se arrastra con el ratón; en el móvil (sin arrastrar fiable) la columna se cambia
// desde la tarea. Mover se pinta al momento y la petición va detrás; si falla,
// vuelve a donde estaba.
// ============================================================================

const HECHAS_A_LA_VISTA = 6;
const DE_CLAUDE_A_LA_VISTA = 12;
// Lo bastante a menudo para que se vea lo que mueve el otro casi al momento; cada
// pregunta es pequeña (la huella), y solo con el tablero a la vista.
const SEGUNDOS_EN_VIVO = 5;
const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
const nombreDeColumna = (id) => COLUMNAS.find((c) => c.id === id)?.nombre || "";

export default function Tareas({ accent, flash }) {
  const [datos, setDatos] = useState(null); // { tareas, etiquetas, yo }
  const [error, setError] = useState(null);
  const [quien, setQuien] = useState("todas");
  const [deEtiqueta, setDeEtiqueta] = useState(null);
  const [abierta, setAbierta] = useState(null); // la tarea en el editor
  const [anadiendo, setAnadiendo] = useState(null); // la columna donde se está escribiendo una nueva
  const [conEtiquetas, setConEtiquetas] = useState(false);
  const [conArchivo, setConArchivo] = useState(false);
  const [arrastrada, setArrastrada] = useState(null);
  const [destino, setDestino] = useState(null); // { columna, indice } donde caería
  const [todasHechas, setTodasHechas] = useState(false);
  const [todasDeClaude, setTodasDeClaude] = useState(false);
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
  const cambiar = (id, cuerpo) => pedir(`/api/admin/tareas?id=${encodeURIComponent(id)}`, "PATCH", cuerpo);

  const ponTarea = (t) => setDatos((d) => ({
    ...d,
    tareas: d.tareas.some((x) => x.id === t.id) ? d.tareas.map((x) => (x.id === t.id ? t : x)) : [...d.tareas, t],
  }));
  const quitaTarea = (id) => setDatos((d) => ({ ...d, tareas: d.tareas.filter((x) => x.id !== id) }));

  const etiquetas = datos?.etiquetas || [];
  const etiquetaDe = (id) => etiquetas.find((e) => e.id === id) || null;
  const pilas = useMemo(() => repartir(datos?.tareas || []), [datos]);
  const columnas = useMemo(() => porColumna(pilas.tablero), [pilas]);
  const seVe = (t) => (quien === "todas" || esDe(t, quien)) && (!deEtiqueta || t.etiqueta === deEtiqueta);

  /** Al final de su columna (en «Hecho», arriba: va por fecha). */
  const ordenAlFinal = (columna, sin) => ordenEntre(columnas[columna].filter((t) => t.id !== sin).at(-1)?.orden ?? null, null);
  /** Subir al tablero una de las de Claude es ponerle autor: el servidor dice quién. */
  const alSubir = (tarea) => (esDeClaude(tarea) ? { adoptar: true } : {});
  const yaSubida = (tarea) => (esDeClaude(tarea) ? { autor: datos.yo || "admin" } : {});

  async function mover(tarea, columna, orden) {
    const ahora = new Date().toISOString();
    ponTarea({
      ...tarea, ...yaSubida(tarea), columna, orden,
      terminada: columna === HECHA ? (tarea.columna === HECHA ? tarea.terminada : ahora) : null,
    });
    try {
      ponTarea(await cambiar(tarea.id, { columna, orden, ...alSubir(tarea) }));
    } catch (e) {
      ponTarea(tarea);
      flash(e.message);
    }
  }

  /** Una de las de Claude pasa al tablero, a la columna que ya tenía. */
  async function subir(tarea) {
    const orden = ordenAlFinal(tarea.columna, tarea.id);
    ponTarea({ ...tarea, ...yaSubida(tarea), orden });
    try {
      ponTarea(await cambiar(tarea.id, { orden, adoptar: true }));
      setAbierta(null);
    } catch (e) {
      ponTarea(tarea);
      flash(e.message);
    }
  }

  async function crear(columna, titulo) {
    try {
      ponTarea(await pedir("/api/admin/tareas", "POST", {
        titulo, columna, orden: ordenAlFinal(columna),
        // Con un filtro puesto, lo nuevo nace dentro de él: si no, desaparecería al crearlo.
        quien: quien !== "todas" ? quien : datos.yo,
        etiqueta: deEtiqueta,
      }));
      return true;
    } catch (e) {
      flash(e.message);
      return false;
    }
  }

  async function guardar(cambios) {
    const vieja = datos.tareas.find((t) => t.id === abierta.id);
    if (!vieja) throw new Error("Esa tarea ya no existe");
    const cuerpo = { ...cambios };
    if (cuerpo.columna !== vieja.columna) cuerpo.orden = ordenAlFinal(cuerpo.columna, vieja.id);
    ponTarea(await cambiar(vieja.id, cuerpo));
    setAbierta(null);
  }

  /** Archivar la quita de la vista (ni la borra ni toca el vault); `si` false la devuelve. */
  async function archivar(tarea, si = true) {
    ponTarea({ ...tarea, archivada: si ? new Date().toISOString() : null });
    setAbierta(null);
    try {
      ponTarea(await cambiar(tarea.id, { archivada: si }));
      if (si) flash("Archivada");
    } catch (e) {
      ponTarea(tarea);
      flash(e.message);
    }
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
    // Una de las de Claude no está en ninguna columna: soltarla siempre es subirla.
    const enSuSitio = !esDeClaude(tarea) && tarea.columna === columna
      && (columna === HECHA || visibles.findIndex((t) => t.id === tarea.id) === d.indice);
    if (enSuSitio) return;
    const orden = columna === HECHA ? tarea.orden : ordenEntre(resto[d.indice - 1]?.orden ?? null, resto[d.indice]?.orden ?? null);
    mover(tarea, columna, orden);
  }

  if (error) return <div style={aviso(false)}>{error}</div>;
  if (!datos) return <p style={{ color: C.suave }}>Cargando…</p>;

  const deArrastre = (t) => ({
    arrastrada: t.id === arrastrada,
    onAbrir: () => setAbierta(t),
    onEmpezar: (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); setArrastrada(t.id); },
    onAcabar: () => { setArrastrada(null); setDestino(null); },
  });
  const deClaude = pilas.deClaude.filter(seVe);
  const deClaudeVisibles = todasDeClaude ? deClaude : deClaude.slice(0, DE_CLAUDE_A_LA_VISTA);

  return (
    <div className="tb">
      <style>{CSS}</style>

      {/* Una sola fila: quién, de qué (la leyenda de colores es también el filtro) y, a la derecha, lo que se toca poco. */}
      <div style={{ display: "flex", gap: "8px 16px", flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {PERSONAS.map((p) => (
            <button
              key={p.id} type="button" className="tb-quieto" aria-pressed={quien === p.id}
              onClick={() => setQuien(quien === p.id ? "todas" : p.id)}
              title={quien === p.id ? "Ver las de todos" : `Solo las de ${p.nombre}`}
            >
              <Avatar persona={p} tam={20} />
              {p.nombre}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", flex: "1 1 240px", minWidth: 0 }}>
          {etiquetas.map((e) => {
            const activa = deEtiqueta === e.id;
            return (
              <button
                key={e.id} type="button" className="tb-etiqueta" aria-pressed={activa}
                onClick={() => setDeEtiqueta(activa ? null : e.id)}
                style={{ background: e.color, color: tintaSobre(e.color), opacity: deEtiqueta && !activa ? 0.3 : 1 }}
              >
                {e.nombre}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button type="button" className="tb-quieto" onClick={() => setConEtiquetas(true)} aria-label="Editar etiquetas" title="Editar etiquetas">
            <Icono nombre="editar" tam={16} />
          </button>
          <button type="button" className="tb-quieto" onClick={() => setConArchivo(true)} aria-label="Archivo" title="Archivo">
            <Icono nombre="archivo" tam={16} />
            {pilas.archivadas.length > 0 && <span style={{ color: C.tenue, fontWeight: 500 }}>{pilas.archivadas.length}</span>}
          </button>
        </div>
      </div>

      <div className="tb-tablero">
        {COLUMNAS.map((col) => {
          const todas = columnas[col.id].filter(seVe);
          const ocultas = col.id === HECHA && !todasHechas ? Math.max(0, todas.length - HECHAS_A_LA_VISTA) : 0;
          const visibles = ocultas ? todas.slice(0, HECHAS_A_LA_VISTA) : todas;
          const sinLaArrastrada = visibles.filter((t) => t.id !== arrastrada);
          const encima = destino?.columna === col.id;
          const linea = (i) => encima && destino.indice === i && <div key={`linea-${i}`} style={lineaDestino(accent)} />;
          let k = 0;
          return (
            <section
              key={col.id}
              aria-label={col.nombre}
              className="tb-columna"
              onDragOver={(e) => alPasar(e, col.id, sinLaArrastrada)}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino(null); }}
              onDrop={(e) => soltar(e, col.id, visibles)}
              style={{ background: encima ? tinte(accent, 9) : C.panelSuave }}
            >
              <header style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 2px 0 4px", minHeight: 26 }}>
                <h3 style={{ fontSize: 13, fontWeight: 650, margin: 0 }}>{col.nombre}</h3>
                <span style={{ fontSize: 12, color: C.tenue, flex: 1 }}>{todas.length || ""}</span>
                {col.id !== HECHA && (
                  <button
                    type="button" className="tb-quieto tb-mas" aria-label={`Añadir a ${col.nombre}`} title="Añadir tarea"
                    onClick={() => setAnadiendo(anadiendo === col.id ? null : col.id)}
                  >
                    <Icono nombre="mas" tam={15} />
                  </button>
                )}
              </header>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 34 }}>
                {visibles.flatMap((t) => {
                  const antes = t.id === arrastrada ? null : linea(k++);
                  return [
                    antes,
                    <Tarjeta key={t.id} tarea={t} etiqueta={etiquetaDe(t.etiqueta)} {...deArrastre(t)} onArchivar={() => archivar(t)} onBorrar={() => borrar(t)} />,
                  ];
                })}
                {linea(k)}
                {anadiendo === col.id && <Anadir accent={accent} onCrear={(titulo) => crear(col.id, titulo)} onCerrar={() => setAnadiendo(null)} />}
              </div>

              {col.id === HECHA && todas.length > HECHAS_A_LA_VISTA && (
                <button type="button" className="tb-quieto" style={{ justifyContent: "center" }} onClick={() => setTodasHechas(!todasHechas)}>
                  {todasHechas ? "Solo las últimas" : `${ocultas} más`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {/* Lo que apuntó Claude: sin columnas, hasta que alguien lo sube a la suya. */}
      {pilas.deClaude.length > 0 && (
        <section aria-label="De Claude" style={{ marginTop: 30 }}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "0 4px 10px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 650, margin: 0 }}>De Claude</h3>
            <span style={{ fontSize: 12, color: C.tenue }}>{deClaude.length}</span>
            <span className="tb-pista" style={{ fontSize: 12, color: C.tenue }}>Las apuntó Claude desde el vault. Arrastra una a su columna para quedártela.</span>
          </header>
          <div className="tb-claude">
            {deClaudeVisibles.map((t) => (
              <Tarjeta
                key={t.id} tarea={t} etiqueta={etiquetaDe(t.etiqueta)} {...deArrastre(t)}
                pie={t.columna !== COLUMNAS[0].id ? nombreDeColumna(t.columna) : null}
                onSubir={() => subir(t)} onArchivar={() => archivar(t)} onBorrar={() => borrar(t)}
              />
            ))}
          </div>
          {!deClaude.length && <p style={{ fontSize: 13, color: C.tenue, margin: "0 4px" }}>Ninguna con ese filtro.</p>}
          {deClaude.length > DE_CLAUDE_A_LA_VISTA && (
            <button type="button" className="tb-quieto" style={{ marginTop: 8 }} onClick={() => setTodasDeClaude(!todasDeClaude)}>
              {todasDeClaude ? "Ver menos" : `Ver las ${deClaude.length}`}
            </button>
          )}
        </section>
      )}

      {abierta && (
        <EditorTarea
          key={abierta.id}
          tarea={abierta} etiquetas={etiquetas} accent={accent}
          onGuardar={guardar} onBorrar={borrar} onArchivar={archivar} onSubir={subir} onCerrar={() => setAbierta(null)}
        />
      )}
      {conEtiquetas && (
        <EditorEtiquetas
          etiquetas={etiquetas} tareas={datos.tareas} accent={accent}
          onGuardar={guardarEtiquetas} onCerrar={() => setConEtiquetas(false)}
        />
      )}
      {conArchivo && (
        <Archivo
          tareas={pilas.archivadas} etiquetaDe={etiquetaDe}
          onDevolver={(t) => archivar(t, false)} onBorrar={borrar} onCerrar={() => setConArchivo(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- una tarjeta
// El color de la etiqueta la rellena entera. Lo terminado va desvaído (el mismo
// color, aclarado): «Hecho» no puede pesar más que lo que queda por hacer.
function Tarjeta({ tarea, etiqueta, pie, arrastrada, onAbrir, onEmpezar, onAcabar, onSubir, onArchivar, onBorrar }) {
  const hecha = tarea.columna === HECHA;
  const color = etiqueta?.color;
  const rellena = Boolean(color) && !hecha;
  const fondo = rellena ? color : color ? `color-mix(in srgb, ${color} 15%, ${C.panel})` : C.panel;
  const tinta = rellena ? tintaSobre(color) : hecha ? C.suave : C.texto;
  const accion = (fn) => (e) => { e.stopPropagation(); fn(); };
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
      // Solo la tarjeta: Enter sobre «Archivar» no abre además el editor.
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrir(); } }}
      className="tb-tarea"
      title={etiqueta?.nombre}
      style={{
        "--tb-fondo": fondo,
        background: fondo,
        color: tinta,
        border: `1px solid ${color ? "transparent" : C.borde}`,
        opacity: arrastrada ? 0.4 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 550, lineHeight: 1.35, overflowWrap: "anywhere" }}>{tarea.titulo}</div>
        {(hecha || pie) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, marginTop: 3, opacity: 0.8 }}>
            {hecha ? <><Icono nombre="check" tam={12} /> {fechaCorta(tarea.terminada)}</> : pie}
          </div>
        )}
      </div>
      {tarea.nota && <span title="Tiene nota" style={{ display: "inline-flex", opacity: 0.75, marginTop: 2 }}><Icono nombre="nota" tam={14} /></span>}
      <Avatares quien={tarea.quien} sobre={rellena ? tinta : null} />

      <div className="tb-acciones">
        {onSubir && <button type="button" className="tb-accion" aria-label="Pasar al tablero" title="Pasar al tablero" onClick={accion(onSubir)}><Icono nombre="subir" tam={14} /></button>}
        <button type="button" className="tb-accion" aria-label="Archivar" title="Archivar" onClick={accion(onArchivar)}><Icono nombre="archivo" tam={14} /></button>
        <button type="button" className="tb-accion" aria-label="Borrar" title="Borrar" onClick={accion(onBorrar)}><Icono nombre="papelera" tam={14} /></button>
      </div>
    </div>
  );
}

/** Escribir una tarea nueva en su columna: Enter la crea y deja escribir la siguiente. */
function Anadir({ accent, onCrear, onCerrar }) {
  const [titulo, setTitulo] = useState("");
  // Un ref y no un estado: dos Enter seguidos llegan antes de que se vuelva a pintar,
  // y con el estado se creaba la tarea dos veces.
  const ocupado = useRef(false);
  async function enviar(e) {
    e.preventDefault();
    if (!titulo.trim() || ocupado.current) return;
    ocupado.current = true;
    if (await onCrear(titulo)) setTitulo("");
    ocupado.current = false;
  }
  return (
    <form onSubmit={enviar}>
      <input
        autoFocus value={titulo} maxLength={MAX_TITULO} aria-label="Tarea nueva" placeholder="Qué hay que hacer"
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCerrar(); }}
        onBlur={() => { if (!titulo.trim()) onCerrar(); }}
        style={{
          width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, color: C.texto,
          background: C.panel, border: `1px solid ${accent}`, borderRadius: 10, padding: "9px 11px", outline: "none",
        }}
      />
    </form>
  );
}

// Sobre una tarjeta rellena el avatar va del color de su letra (el azul de Víctor
// encima del azul de «Producto» no se vería); fuera, con el color de cada uno.
function Avatar({ persona, tam = 22, sobre = null }) {
  return (
    <span
      title={persona.nombre}
      style={{
        width: tam, height: tam, borderRadius: "50%", flexShrink: 0,
        background: sobre ? tinte(sobre, 24) : persona.color, color: sobre || "#fff",
        display: "inline-grid", placeItems: "center", fontSize: Math.round(tam * 0.5), fontWeight: 700,
      }}
    >
      {persona.inicial}
    </span>
  );
}

function Avatares({ quien, sobre = null }) {
  const personas = personasDe(quien);
  if (!personas.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }} aria-label={RESPONSABLES.find((r) => r.id === quien)?.nombre}>
      {personas.map((p) => <Avatar key={p.id} persona={p} sobre={sobre} />)}
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

function EditorTarea({ tarea, etiquetas, accent, onGuardar, onBorrar, onArchivar, onSubir, onCerrar }) {
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
  const deClaude = esDeClaude(tarea);

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
    <Ventana titulo="Tarea" cambiado={cambiado} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <label style={rotulo} htmlFor="tarea-titulo">Qué hay que hacer</label>
        <input id="tarea-titulo" value={f.titulo} maxLength={MAX_TITULO} onChange={(e) => set("titulo", e.target.value)} style={campo} />

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

        <p style={{ fontSize: 12, color: C.tenue, margin: "8px 0 0" }}>
          Creada el {fechaCorta(tarea.creado)} por {PERSONAS.find((p) => p.id === tarea.autor)?.nombre || (tarea.autor ? tarea.autor : "Claude")}
          {tarea.terminada ? ` · terminada el ${fechaCorta(tarea.terminada)}` : ""}
        </p>
        {error && <div style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
          <button type="button" onClick={() => onBorrar(tarea)} aria-label="Borrar" title="Borrar" style={{ ...botonSecundario, color: C.mal, display: "inline-flex", padding: "0.6rem" }}>
            <Icono nombre="papelera" tam={16} />
          </button>
          <button type="button" onClick={() => onArchivar(tarea)} aria-label="Archivar" title="Archivar" style={{ ...botonSecundario, display: "inline-flex", padding: "0.6rem" }}>
            <Icono nombre="archivo" tam={16} />
          </button>
          <div style={{ flex: 1 }} />
          {/* Con el dedo no se arrastra: una de las de Claude se sube al tablero desde aquí. */}
          {deClaude && !cambiado
            ? <button type="button" onClick={() => onSubir(tarea)} style={botonPrimario(accent)}>Pasar al tablero</button>
            : <button type="submit" disabled={ocupado} aria-busy={ocupado || undefined} style={botonPrimario(accent)}>Guardar</button>}
        </div>
      </form>
    </Ventana>
  );
}

// Lo archivado: fuera de la vista, sin borrar. Desde aquí vuelve a donde estaba o se borra del todo.
function Archivo({ tareas, etiquetaDe, onDevolver, onBorrar, onCerrar }) {
  return (
    <Ventana titulo="Archivo" cambiado={false} onCerrar={onCerrar} ancho={480}>
      {!tareas.length && <p style={{ fontSize: 14, color: C.suave, margin: "10px 0 4px" }}>Nada archivado. Lo que archives sale del tablero y espera aquí.</p>}
      <div style={{ display: "grid", gap: 2, marginTop: 10, maxHeight: "60vh", overflowY: "auto" }}>
        {tareas.map((t) => {
          const e = etiquetaDe(t.etiqueta);
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span title={e?.nombre} style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: e?.color || C.bordeFuerte }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, overflowWrap: "anywhere" }}>{t.titulo}</div>
                <div style={{ fontSize: 12, color: C.tenue }}>{nombreDeColumna(t.columna)} · archivada el {fechaCorta(t.archivada)}</div>
              </div>
              <button type="button" className="tb-quieto" onClick={() => onDevolver(t)} aria-label={`Devolver «${t.titulo}» al tablero`} title="Devolver al tablero">
                <Icono nombre="deshacer" tam={16} />
              </button>
              <button type="button" className="tb-quieto" onClick={() => onBorrar(t)} aria-label={`Borrar «${t.titulo}»`} title="Borrar" style={{ color: C.mal }}>
                <Icono nombre="papelera" tam={16} />
              </button>
            </div>
          );
        })}
      </div>
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
const lineaDestino = (accent) => ({ height: 3, borderRadius: 2, background: accent, margin: "-1px 2px" });

// Cuatro columnas en el ordenador; en el móvil, una tras otra deslizando de lado
// (como Trello): apiladas, «Hecho» quedaba a varias pantallas de distancia.
// Archivar y borrar solo donde hay ratón: con el dedo se tocarían al ir a abrir la
// tarea, y ahí están dentro de ella.
const CSS = `
  .tb-tablero { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: start; }
  .tb-columna { border-radius: ${RADIO.panel}px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-width: 0; transition: background 0.12s; }
  .tb-claude { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; align-items: start; }

  .tb-tarea { position: relative; display: flex; align-items: flex-start; gap: 8px; border-radius: 10px; padding: 9px 11px; cursor: grab; }
  .tb-tarea:focus-visible { outline: 2px solid ${C.azul}; outline-offset: 2px; }
  .tb-acciones {
    position: absolute; top: 5px; right: 5px; display: flex; gap: 2px; padding-left: 4px;
    background: var(--tb-fondo); box-shadow: -8px 0 8px var(--tb-fondo); border-radius: 8px;
    opacity: 0; pointer-events: none; transition: opacity 0.12s;
  }
  .tb-tarea:hover .tb-acciones, .tb-tarea:focus-within .tb-acciones { opacity: 1; pointer-events: auto; }
  .tb-accion {
    width: 26px; height: 26px; border: 0; border-radius: 7px; padding: 0; cursor: pointer;
    display: grid; place-items: center; color: inherit; background: color-mix(in srgb, currentColor 14%, transparent);
  }
  .tb-accion:hover { background: color-mix(in srgb, currentColor 30%, transparent); }
  .tb-accion:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }

  .tb-quieto {
    display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: ${C.suave};
    font: inherit; font-size: 13px; font-weight: 600; padding: 5px 8px; border-radius: 8px; cursor: pointer;
  }
  .tb-quieto:hover { background: ${C.panelSuave}; color: ${C.texto}; }
  .tb-quieto[aria-pressed="true"] { background: ${C.panelSuave}; color: ${C.texto}; box-shadow: inset 0 0 0 1px ${C.bordeFuerte}; }
  .tb-quieto:focus-visible, .tb-etiqueta:focus-visible { outline: 2px solid ${C.azul}; outline-offset: 2px; }
  .tb-columna .tb-quieto:hover { background: ${C.borde}; }
  .tb-mas { padding: 5px; }
  .tb-etiqueta { border: 0; border-radius: 7px; padding: 3px 9px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }

  @media (hover: none) { .tb-acciones { display: none; } }
  @media (max-width: 759px) {
    .tb-tablero { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 0 16px 8px; scroll-padding: 0 16px; }
    .tb-tablero > section { flex: 0 0 82%; scroll-snap-align: start; }
    .tb-pista { display: none; }
  }
`;
