"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmar } from "@/app/Dialogo";
import { useEnVivo } from "@/app/useEnVivo";
import {
  COLUMNAS, HECHA, RESPONSABLES, PERSONAS, COLORES_ETIQUETA, MAX_TITULO, MAX_NOTA, MAX_NOMBRE_ETIQUETA, MAX_ETIQUETAS,
  porColumna, repartir, esDeClaude, tintaSobre, ordenEntre, esDe, personasDe, idDeEtiqueta,
} from "@/lib/tareas";

// ============================================================================
// EL TABLERO DE TAREAS (/admin/tareas)
// ----------------------------------------------------------------------------
// Un Trello de Víctor y Diego. Vive dentro de fiddle por comodidad, pero es una
// cosa APARTE (16-11-2026, lo pidió Víctor): pantalla completa, sin la cabecera del
// admin, con sus colores, sus iconos y sus piezas. Nada de `app/ui.js` ni de
// `app/Icono.js` aquí: lo que cambie en el resto de la app no tiene que moverlo.
// Lo único que comparte es el tema claro/oscuro (`data-tema` en <html>) y la
// pregunta de confirmación (`confirmar`).
//
// - Cuatro listas que ocupan la pantalla y se desplazan por dentro. La tarjeta se
//   rellena con el color de su etiqueta. Se arrastra (deja su hueco donde caería);
//   en el móvil la lista se cambia desde la tarea.
// - Abajo, «De Claude»: lo que entró del vault y nadie ha hecho suyo, en montones
//   por etiqueta. Un montón se abre y de ahí cada tarea sube al tablero.
// - Mover se pinta al momento y la petición va detrás; si falla, vuelve.
// ============================================================================

const HECHAS_A_LA_VISTA = 10;
// Lo bastante a menudo para que se vea lo que mueve el otro casi al momento; cada
// pregunta es pequeña (la huella), y solo con el tablero a la vista.
const SEGUNDOS_EN_VIVO = 5;
const TINTA = "#1f2937"; // el botón de «confirmar», que es de la app y pide un color
const SIN_ETIQUETA = "·sin";

const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
const nombreDeColumna = (id) => COLUMNAS.find((c) => c.id === id)?.nombre || "";
const plano = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ------------------------------------------------------------- iconos
const TRAZOS = {
  volver: "M15 5l-7 7 7 7",
  mas: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  cerrar: "M6 6l12 12M18 6L6 18",
  archivo: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  papelera: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6",
  subir: "M12 19V5M6 11l6-6 6 6",
  devolver: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  nota: "M5 7h14M5 12h14M5 17h8",
  lupa: "M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13zM16 16l4.5 4.5",
  etiqueta: "M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5zM8.4 8.4h.01",
  chispa: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
};
function Ico({ n, s = 16 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <path d={TRAZOS[n]} />
    </svg>
  );
}

export default function Tareas() {
  const [datos, setDatos] = useState(null); // { tareas, etiquetas, yo }
  const [error, setError] = useState(null);
  const [quien, setQuien] = useState("todas");
  const [deEtiqueta, setDeEtiqueta] = useState(null);
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState(null); // la tarea en el editor
  const [anadiendo, setAnadiendo] = useState(null); // la lista donde se escribe una nueva
  const [pila, setPila] = useState(null); // el montón de Claude abierto (id de etiqueta o SIN_ETIQUETA)
  const [conEtiquetas, setConEtiquetas] = useState(false);
  const [conArchivo, setConArchivo] = useState(false);
  const [arrastrada, setArrastrada] = useState(null);
  const [destino, setDestino] = useState(null); // { columna, indice } donde caería
  const [todasHechas, setTodasHechas] = useState(false);
  const [dicho, setDicho] = useState(null); // el aviso de abajo: { texto, n }
  // Con algo a medio guardar o una tarjeta en la mano, lo que traiga una recarga no se
  // pinta: lo primero aún no lo lleva y lo segundo movería el sitio donde se suelta.
  const enVuelo = useRef(0);
  const enLaMano = useRef(null);
  const alto = useRef(60); // lo que mide la tarjeta en la mano: su hueco es igual de alto
  const raiz = useRef(null);

  const decir = useCallback((texto) => setDicho({ texto, n: Date.now() }), []);
  useEffect(() => {
    if (!dicho) return undefined;
    const t = setTimeout(() => setDicho(null), 2600);
    return () => clearTimeout(t);
  }, [dicho]);

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
  const buscado = plano(busca.trim());
  const seVe = (t) => (quien === "todas" || esDe(t, quien))
    && (!deEtiqueta || t.etiqueta === deEtiqueta)
    && (!buscado || plano(t.titulo).includes(buscado) || plano(t.nota).includes(buscado));

  // Lo de Claude, en montones por etiqueta (en el orden de las etiquetas; al final, lo que no lleva).
  const montones = useMemo(() => {
    const por = new Map();
    for (const t of pilas.deClaude.filter(seVe)) {
      const k = etiquetas.some((e) => e.id === t.etiqueta) ? t.etiqueta : SIN_ETIQUETA;
      if (!por.has(k)) por.set(k, []);
      por.get(k).push(t);
    }
    return [...etiquetas.map((e) => e.id), SIN_ETIQUETA].filter((k) => por.has(k)).map((k) => ({ id: k, etiqueta: etiquetaDe(k), tareas: por.get(k) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilas, etiquetas, quien, deEtiqueta, buscado]);
  const monton = montones.find((m) => m.id === pila) || null;
  useEffect(() => { if (pila && !monton) setPila(null); }, [pila, monton]);

  /** Al final de su lista (en «Hecho», arriba: va por fecha). */
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
      decir(e.message);
    }
  }
  const terminar = (t) => mover(t, HECHA, t.orden);
  const reabrir = (t) => mover(t, COLUMNAS[0].id, ordenAlFinal(COLUMNAS[0].id, t.id));

  /** Una de las de Claude pasa al tablero, a la lista que ya tenía. */
  async function subir(tarea) {
    const orden = ordenAlFinal(tarea.columna, tarea.id);
    ponTarea({ ...tarea, ...yaSubida(tarea), orden });
    setAbierta(null);
    try {
      ponTarea(await cambiar(tarea.id, { orden, adoptar: true }));
      decir(`En «${nombreDeColumna(tarea.columna)}»`);
    } catch (e) {
      ponTarea(tarea);
      decir(e.message);
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
      decir(e.message);
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
      decir(si ? "Archivada" : "De vuelta en el tablero");
    } catch (e) {
      ponTarea(tarea);
      decir(e.message);
    }
  }

  async function borrar(tarea) {
    const si = await confirmar({ titulo: "Borrar esta tarea", texto: `«${tarea.titulo}» desaparece del tablero. No se puede deshacer.`, si: "Borrar", peligro: true, accent: TINTA });
    if (!si) return;
    try {
      await pedir(`/api/admin/tareas?id=${encodeURIComponent(tarea.id)}`, "DELETE");
      quitaTarea(tarea.id);
      setAbierta(null);
      decir("Tarea borrada");
    } catch (e) {
      decir(e.message);
    }
  }

  async function guardarEtiquetas(lista) {
    const guardadas = await pedir("/api/admin/tareas/etiquetas", "PUT", lista);
    setDatos((d) => ({ ...d, etiquetas: guardadas }));
    if (deEtiqueta && !guardadas.some((e) => e.id === deEtiqueta)) setDeEtiqueta(null);
    setConEtiquetas(false);
    decir("Etiquetas guardadas");
  }

  // ------------------------------------------------------------- arrastrar
  function alEmpezar(e, tarea) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    alto.current = r.height;
    enLaMano.current = tarea.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tarea.id);
    // Lo que va bajo el cursor: la misma tarjeta, un poco girada, como al cogerla de una mesa.
    const copia = el.cloneNode(true);
    copia.classList.add("tk-en-mano");
    copia.style.width = `${r.width}px`;
    raiz.current?.appendChild(copia);
    e.dataTransfer.setDragImage(copia, e.clientX - r.left, e.clientY - r.top);
    // Esconderla ya cancelaría el arrastre: se quita de la lista en el siguiente turno.
    setTimeout(() => { copia.remove(); setArrastrada(tarea.id); }, 0);
  }
  function alAcabar() {
    enLaMano.current = null;
    setArrastrada(null);
    setDestino(null);
  }

  function alPasar(e, columna, cuantas) {
    if (!enLaMano.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    let indice = 0;
    if (columna !== HECHA) {
      const nodos = [...e.currentTarget.querySelectorAll("[data-tarea]:not([data-arrastrada])")];
      indice = nodos.findIndex((n) => { const r = n.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (indice < 0) indice = cuantas;
    }
    if (destino?.columna !== columna || destino?.indice !== indice) setDestino({ columna, indice });
  }

  function soltar(e, columna, visibles) {
    e.preventDefault();
    const tarea = datos.tareas.find((t) => t.id === enLaMano.current);
    const d = destino;
    alAcabar();
    if (!tarea || !d || d.columna !== columna) return;
    const resto = visibles.filter((t) => t.id !== tarea.id);
    const enSuSitio = !esDeClaude(tarea) && tarea.columna === columna
      && (columna === HECHA || visibles.findIndex((t) => t.id === tarea.id) === d.indice);
    if (enSuSitio) return;
    const orden = columna === HECHA ? tarea.orden : ordenEntre(resto[d.indice - 1]?.orden ?? null, resto[d.indice]?.orden ?? null);
    mover(tarea, columna, orden);
  }

  const filtrando = quien !== "todas" || deEtiqueta || buscado;

  return (
    <div className="tk" ref={raiz}>
      <style>{CSS}</style>

      <header className="tk-barra">
        <a className="tk-volver" href="/admin" title="Volver a fiddle"><Ico n="volver" s={18} /><span>fiddle</span></a>
        <h1 className="tk-titulo">Tareas</h1>

        <div className="tk-filtros">
          <div className="tk-gente">
            {PERSONAS.map((p) => (
              <button
                key={p.id} type="button" className="tk-persona" aria-pressed={quien === p.id}
                onClick={() => setQuien(quien === p.id ? "todas" : p.id)}
                title={quien === p.id ? "Ver las de todos" : `Solo las de ${p.nombre}`}
              >
                <Avatar persona={p} tam={26} />
              </button>
            ))}
          </div>
          <span className="tk-raya" />
          {etiquetas.map((e) => {
            const activa = deEtiqueta === e.id;
            return (
              <button
                key={e.id} type="button" className="tk-chip" aria-pressed={activa}
                onClick={() => setDeEtiqueta(activa ? null : e.id)}
                style={activa ? { background: e.color, color: tintaSobre(e.color), borderColor: "transparent" } : undefined}
              >
                <i style={{ background: activa ? "currentColor" : e.color }} />{e.nombre}
              </button>
            );
          })}
          {filtrando && (
            <button type="button" className="tk-chip tk-chip-quitar" onClick={() => { setQuien("todas"); setDeEtiqueta(null); setBusca(""); }}>
              <Ico n="cerrar" s={13} /> Quitar filtros
            </button>
          )}
        </div>

        <label className="tk-busca">
          <Ico n="lupa" s={15} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar tareas" />
        </label>
        <button type="button" className="tk-icono" onClick={() => setConEtiquetas(true)} title="Etiquetas" aria-label="Editar etiquetas"><Ico n="etiqueta" s={17} /></button>
        <button type="button" className="tk-icono" onClick={() => setConArchivo(true)} title="Archivo" aria-label="Archivo">
          <Ico n="archivo" s={17} />
          {pilas.archivadas.length > 0 && <b>{pilas.archivadas.length}</b>}
        </button>
      </header>

      {error && <div className="tk-error">{error} <button type="button" className="tk-btn tk-btn-suave" onClick={() => cargar()}>Reintentar</button></div>}

      {!datos && !error && (
        <div className="tk-tablero" aria-busy="true">
          {COLUMNAS.map((c, i) => (
            <section key={c.id} className="tk-lista">
              <header className="tk-lista-cabeza"><h2>{c.nombre}</h2></header>
              <div className="tk-lista-cuerpo">{Array.from({ length: 3 - (i % 2) }, (_, k) => <div key={k} className="tk-fantasma" />)}</div>
            </section>
          ))}
        </div>
      )}

      {datos && (
        <>
          <main className="tk-tablero">
            {COLUMNAS.map((col) => {
              const todas = columnas[col.id].filter(seVe);
              const ocultas = col.id === HECHA && !todasHechas ? Math.max(0, todas.length - HECHAS_A_LA_VISTA) : 0;
              const visibles = ocultas ? todas.slice(0, HECHAS_A_LA_VISTA) : todas;
              const sinLaArrastrada = visibles.filter((t) => t.id !== arrastrada);
              const encima = destino?.columna === col.id;
              const hueco = (i) => encima && destino.indice === i && <div key={`hueco-${i}`} className="tk-hueco" style={{ height: alto.current }} />;
              let k = 0;
              return (
                <section
                  key={col.id} aria-label={col.nombre} className="tk-lista" data-encima={encima || undefined}
                  onDragOver={(e) => alPasar(e, col.id, sinLaArrastrada.length)}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino(null); }}
                  onDrop={(e) => soltar(e, col.id, visibles)}
                >
                  <header className="tk-lista-cabeza">
                    <h2>{col.nombre}</h2>
                    <span className="tk-cuenta">{todas.length}</span>
                    {col.id !== HECHA && (
                      <button type="button" className="tk-icono tk-icono-mini" aria-label={`Añadir a ${col.nombre}`} title="Añadir tarea" onClick={() => setAnadiendo(anadiendo === col.id ? null : col.id)}>
                        <Ico n="mas" s={16} />
                      </button>
                    )}
                  </header>

                  <div className="tk-lista-cuerpo">
                    {visibles.flatMap((t) => {
                      const antes = t.id === arrastrada ? null : hueco(k++);
                      return [
                        antes,
                        <Carta
                          key={t.id} tarea={t} etiqueta={etiquetaDe(t.etiqueta)} arrastrada={t.id === arrastrada}
                          onAbrir={() => setAbierta(t)} onEmpezar={(e) => alEmpezar(e, t)} onAcabar={alAcabar}
                          onTerminar={() => (t.columna === HECHA ? reabrir(t) : terminar(t))}
                          onArchivar={() => archivar(t)} onBorrar={() => borrar(t)}
                        />,
                      ];
                    })}
                    {hueco(k)}
                    {!visibles.length && !encima && anadiendo !== col.id && (
                      <p className="tk-vacia">{filtrando ? "Nada con ese filtro" : col.id === HECHA ? "Lo terminado cae aquí" : "Suelta aquí una tarea"}</p>
                    )}
                    {col.id === HECHA && todas.length > HECHAS_A_LA_VISTA && (
                      <button type="button" className="tk-anadir" style={{ justifyContent: "center" }} onClick={() => setTodasHechas(!todasHechas)}>
                        {todasHechas ? "Solo las últimas" : `Ver ${ocultas} más`}
                      </button>
                    )}
                  </div>

                  {col.id !== HECHA && (anadiendo === col.id
                    ? <Anadir onCrear={(titulo) => crear(col.id, titulo)} onCerrar={() => setAnadiendo(null)} />
                    : <button type="button" className="tk-anadir" onClick={() => setAnadiendo(col.id)}><Ico n="mas" s={15} /> Añadir tarea</button>)}
                </section>
              );
            })}
          </main>

          {/* Lo que apuntó Claude: montones por etiqueta, hasta que alguien lo sube. */}
          {pilas.deClaude.length > 0 && (
            <footer className="tk-muelle" aria-label="De Claude">
              <div className="tk-muelle-rotulo">
                <span className="tk-muelle-nombre"><Ico n="chispa" s={15} /> De Claude</span>
                <span className="tk-muelle-pista">{montones.reduce((n, m) => n + m.tareas.length, 0)} del vault, sin dueño todavía</span>
              </div>
              <div className="tk-montones">
                {montones.map((m) => <Monton key={m.id} monton={m} onAbrir={() => setPila(m.id)} />)}
                {!montones.length && <p className="tk-vacia" style={{ margin: 0 }}>Nada con ese filtro</p>}
              </div>
            </footer>
          )}
        </>
      )}

      {monton && (
        <Ventana
          ancho={860} onCerrar={() => setPila(null)}
          titulo={<><i className="tk-punto" style={{ background: monton.etiqueta?.color || "var(--tenue)" }} />{monton.etiqueta?.nombre || "Sin etiqueta"} <span className="tk-cuenta">{monton.tareas.length}</span></>}
          pista="Lo apuntó Claude desde el vault. Sube al tablero lo que vayáis a hacer; archiva o borra el resto."
        >
          <div className="tk-abanico">
            {monton.tareas.map((t) => (
              <Carta
                key={t.id} tarea={t} etiqueta={monton.etiqueta} suelta
                pie={t.columna !== COLUMNAS[0].id ? nombreDeColumna(t.columna) : null}
                onAbrir={() => setAbierta(t)} onSubir={() => subir(t)} onArchivar={() => archivar(t)} onBorrar={() => borrar(t)}
              />
            ))}
          </div>
        </Ventana>
      )}
      {abierta && (
        <EditorTarea
          key={abierta.id} tarea={abierta} etiquetas={etiquetas}
          onGuardar={guardar} onBorrar={borrar} onArchivar={archivar} onSubir={subir} onCerrar={() => setAbierta(null)}
        />
      )}
      {conEtiquetas && <EditorEtiquetas etiquetas={etiquetas} tareas={datos?.tareas || []} onGuardar={guardarEtiquetas} onCerrar={() => setConEtiquetas(false)} />}
      {conArchivo && <Archivo tareas={pilas.archivadas} etiquetaDe={etiquetaDe} onDevolver={(t) => archivar(t, false)} onBorrar={borrar} onCerrar={() => setConArchivo(false)} />}

      {dicho && <div key={dicho.n} className="tk-dicho" role="status">{dicho.texto}</div>}
    </div>
  );
}

// ------------------------------------------------------------- una tarjeta
// El color de la etiqueta la rellena entera; lo terminado se queda en blanco con su
// punto de color: «Hecho» no puede pesar más que lo que queda por hacer.
// `suelta`: dentro de un montón abierto; no se arrastra y sus botones van a la vista
// (ahí la tarjeta está para decidir qué se hace con ella).
function Carta({ tarea, etiqueta, pie, suelta, arrastrada, onAbrir, onEmpezar, onAcabar, onTerminar, onSubir, onArchivar, onBorrar }) {
  const hecha = tarea.columna === HECHA;
  const color = etiqueta?.color;
  const rellena = Boolean(color) && !hecha;
  const accion = (fn) => (e) => { e.stopPropagation(); fn(); };
  const personas = personasDe(tarea.quien);
  return (
    <article
      data-tarea={tarea.id}
      data-arrastrada={arrastrada || undefined}
      data-rellena={rellena || undefined}
      data-hecha={hecha || undefined}
      data-suelta={suelta || undefined}
      role="button" tabIndex={0}
      draggable={!suelta}
      onDragStart={suelta ? undefined : onEmpezar}
      onDragEnd={suelta ? undefined : onAcabar}
      onClick={onAbrir}
      // Solo la tarjeta: Enter sobre «Archivar» no abre además el editor.
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrir(); } }}
      className="tk-carta"
      style={rellena ? { "--c": color, "--t": tintaSobre(color) } : undefined}
    >
      <p className="tk-carta-titulo">{tarea.titulo}</p>
      {(etiqueta || hecha || pie || tarea.nota || personas.length > 0) && (
        <div className="tk-carta-pie">
          {etiqueta && <span className="tk-carta-etiqueta">{!rellena && <i className="tk-punto" style={{ background: color }} />}{etiqueta.nombre}</span>}
          {hecha && <span className="tk-carta-dato"><Ico n="check" s={12} />{fechaCorta(tarea.terminada)}</span>}
          {pie && <span className="tk-carta-dato">{pie}</span>}
          {tarea.nota && <span className="tk-carta-dato" title="Tiene nota"><Ico n="nota" s={13} /></span>}
          <span style={{ flex: 1 }} />
          {personas.length > 0 && (
            <span className="tk-avatares" aria-label={RESPONSABLES.find((r) => r.id === tarea.quien)?.nombre}>
              {personas.map((p) => <Avatar key={p.id} persona={p} claro={rellena} />)}
            </span>
          )}
        </div>
      )}

      {suelta ? (
        <div className="tk-carta-botones">
          <button type="button" className="tk-subir" onClick={accion(onSubir)}><Ico n="subir" s={14} /> Al tablero</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="tk-accion" aria-label="Archivar" title="Archivar" onClick={accion(onArchivar)}><Ico n="archivo" s={15} /></button>
          <button type="button" className="tk-accion" aria-label="Borrar" title="Borrar" onClick={accion(onBorrar)}><Ico n="papelera" s={15} /></button>
        </div>
      ) : (
        <div className="tk-acciones">
          <button type="button" className="tk-accion" aria-label={hecha ? "Reabrir" : "Terminar"} title={hecha ? "Reabrir" : "Terminar"} onClick={accion(onTerminar)}><Ico n={hecha ? "devolver" : "check"} s={15} /></button>
          <button type="button" className="tk-accion" aria-label="Archivar" title="Archivar" onClick={accion(onArchivar)}><Ico n="archivo" s={15} /></button>
          <button type="button" className="tk-accion" aria-label="Borrar" title="Borrar" onClick={accion(onBorrar)}><Ico n="papelera" s={15} /></button>
        </div>
      )}
    </article>
  );
}

// Un montón de las de Claude: la de arriba se lee y las de debajo asoman. Al pasar
// el ratón se abren en abanico; al tocarlo, se entra.
function Monton({ monton, onAbrir }) {
  const { etiqueta, tareas } = monton;
  const color = etiqueta?.color;
  return (
    <button
      type="button" className="tk-monton" onClick={onAbrir} data-rellena={color ? true : undefined}
      style={color ? { "--c": color, "--t": tintaSobre(color) } : undefined}
      aria-label={`${etiqueta?.nombre || "Sin etiqueta"}: ${tareas.length} tareas de Claude`}
    >
      {tareas.length > 2 && <span className="tk-monton-capa" data-n="3" />}
      {tareas.length > 1 && <span className="tk-monton-capa" data-n="2" />}
      <span className="tk-monton-cara">
        <span className="tk-monton-cabeza">
          <span className="tk-monton-nombre">{etiqueta?.nombre || "Sin etiqueta"}</span>
          <span className="tk-monton-cuenta">{tareas.length}</span>
        </span>
        <span className="tk-monton-titulo">{tareas[0].titulo}</span>
      </span>
    </button>
  );
}

/** Escribir una tarea nueva en su lista: Enter la crea y deja escribir la siguiente. */
function Anadir({ onCrear, onCerrar }) {
  const [titulo, setTitulo] = useState("");
  // Un ref y no un estado: dos Enter seguidos llegan antes de que se vuelva a pintar,
  // y con el estado se creaba la tarea dos veces.
  const ocupado = useRef(false);
  const caja = useRef(null);
  async function enviar(e) {
    e?.preventDefault();
    if (!titulo.trim() || ocupado.current) return;
    ocupado.current = true;
    if (await onCrear(titulo)) setTitulo("");
    ocupado.current = false;
    caja.current?.focus();
  }
  return (
    <form className="tk-nueva" onSubmit={enviar}>
      <textarea
        ref={caja} autoFocus rows={2} value={titulo} maxLength={MAX_TITULO} aria-label="Tarea nueva" placeholder="Qué hay que hacer"
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCerrar();
          if (e.key === "Enter" && !e.shiftKey) enviar(e);
        }}
      />
      <div className="tk-nueva-pie">
        <button type="submit" className="tk-btn">Añadir</button>
        <button type="button" className="tk-icono" onClick={onCerrar} aria-label="Cerrar"><Ico n="cerrar" s={16} /></button>
      </div>
    </form>
  );
}

// Sobre una tarjeta rellena el avatar va en claro con la letra del color de cada uno
// (el azul de Víctor encima del azul de «Producto» no se vería).
function Avatar({ persona, tam = 22, claro = false }) {
  return (
    <span
      className="tk-avatar" title={persona.nombre}
      style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.48), background: claro ? "rgb(255 255 255 / 0.94)" : persona.color, color: claro ? persona.color : "#fff" }}
    >
      {persona.inicial}
    </span>
  );
}

// ------------------------------------------------------------- ventanas
// En un <dialog>: Escape cierra y el foco queda dentro. Tocar fuera solo cierra si no
// se ha cambiado nada: perder una nota escrita por rozar el fondo no compensa.
function Ventana({ titulo, pista, cambiado = false, onCerrar, children, ancho = 540 }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    d?.querySelector("[data-foco]")?.focus();
  }, []);
  return (
    <dialog
      ref={ref} className="tk-ventana" style={{ width: `min(${ancho}px, calc(100% - 28px))` }}
      onCancel={(e) => { e.preventDefault(); onCerrar(); }}
      onClick={(e) => { if (e.target === ref.current && !cambiado) onCerrar(); }}
    >
      <div className="tk-ventana-caja">
        <header className="tk-ventana-cabeza">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{titulo}</h2>
            {pista && <p>{pista}</p>}
          </div>
          <button type="button" className="tk-icono" onClick={onCerrar} aria-label="Cerrar"><Ico n="cerrar" s={18} /></button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

function Opciones({ opciones, valor, onCambio }) {
  return (
    <div className="tk-opciones">
      {opciones.map((o) => {
        const activa = valor === o.id;
        return (
          <button
            key={String(o.id)} type="button" className="tk-opcion" aria-pressed={activa} onClick={() => onCambio(o.id)}
            style={activa && o.color ? { background: o.color, color: tintaSobre(o.color), borderColor: "transparent" } : undefined}
          >
            {o.contenido || o.nombre}
          </button>
        );
      })}
    </div>
  );
}

function EditorTarea({ tarea, etiquetas, onGuardar, onBorrar, onArchivar, onSubir, onCerrar }) {
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
  const deClaude = esDeClaude(tarea) && !tarea.archivada;
  const autor = PERSONAS.find((p) => p.id === tarea.autor)?.nombre || (tarea.autor ? tarea.autor : "Claude");

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
    <Ventana titulo="Tarea" pista={`Creada el ${fechaCorta(tarea.creado)} por ${autor}${tarea.terminada ? ` · terminada el ${fechaCorta(tarea.terminada)}` : ""}`} cambiado={cambiado} onCerrar={onCerrar}>
      <form onSubmit={enviar} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(e); }}>
        <textarea
          className="tk-campo tk-campo-titulo" rows={2} value={f.titulo} maxLength={MAX_TITULO} aria-label="Qué hay que hacer"
          onChange={(e) => set("titulo", e.target.value.replace(/\n/g, " "))}
        />

        <span className="tk-rotulo">Etiqueta</span>
        <Opciones
          valor={f.etiqueta} onCambio={(v) => set("etiqueta", v)}
          opciones={[
            ...etiquetas.map((e) => ({ id: e.id, color: e.color, contenido: <><i className="tk-punto" style={{ background: f.etiqueta === e.id ? "currentColor" : e.color }} />{e.nombre}</> })),
            { id: null, nombre: "Ninguna" },
          ]}
        />

        <span className="tk-rotulo">Quién</span>
        <Opciones
          valor={f.quien} onCambio={(v) => set("quien", v)}
          opciones={[
            ...RESPONSABLES.map((r) => ({ id: r.id, contenido: <><span className="tk-avatares">{personasDe(r.id).map((p) => <Avatar key={p.id} persona={p} tam={18} />)}</span>{r.nombre}</> })),
            { id: null, nombre: "Sin decidir" },
          ]}
        />

        <span className="tk-rotulo">Lista</span>
        <Opciones valor={f.columna} onCambio={(v) => set("columna", v)} opciones={COLUMNAS} />

        <span className="tk-rotulo">Nota</span>
        <textarea
          className="tk-campo" rows={4} value={f.nota} maxLength={MAX_NOTA} aria-label="Nota"
          onChange={(e) => set("nota", e.target.value)} placeholder="Lo que haga falta saber"
        />

        {error && <div className="tk-error" style={{ margin: "12px 0 0" }}>{error}</div>}

        <div className="tk-ventana-pie">
          <button type="button" className="tk-btn tk-btn-suave tk-peligro" onClick={() => onBorrar(tarea)}><Ico n="papelera" s={15} /> Borrar</button>
          {!tarea.archivada && <button type="button" className="tk-btn tk-btn-suave" onClick={() => onArchivar(tarea)}><Ico n="archivo" s={15} /> Archivar</button>}
          <span style={{ flex: 1 }} />
          {/* Con el dedo no se arrastra: una de las de Claude se sube al tablero desde aquí. */}
          {deClaude && !cambiado
            ? <button type="button" className="tk-btn" onClick={() => onSubir(tarea)}><Ico n="subir" s={15} /> Al tablero</button>
            : <button type="submit" className="tk-btn" disabled={ocupado || !cambiado} aria-busy={ocupado || undefined}>Guardar</button>}
        </div>
      </form>
    </Ventana>
  );
}

// Lo archivado: fuera de la vista, sin borrar. Desde aquí vuelve a donde estaba o se borra del todo.
function Archivo({ tareas, etiquetaDe, onDevolver, onBorrar, onCerrar }) {
  return (
    <Ventana titulo="Archivo" pista="Lo archivado sale del tablero sin borrarse." onCerrar={onCerrar} ancho={520}>
      {!tareas.length && <p className="tk-vacia" style={{ padding: "26px 0" }}>Nada archivado todavía</p>}
      <div className="tk-filas">
        {tareas.map((t) => {
          const e = etiquetaDe(t.etiqueta);
          return (
            <div key={t.id} className="tk-fila">
              <i className="tk-punto" title={e?.nombre} style={{ background: e?.color || "var(--tenue)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tk-fila-titulo">{t.titulo}</div>
                <div className="tk-fila-dato">{nombreDeColumna(t.columna)} · archivada el {fechaCorta(t.archivada)}</div>
              </div>
              <button type="button" className="tk-btn tk-btn-suave" onClick={() => onDevolver(t)}><Ico n="devolver" s={15} /> Devolver</button>
              <button type="button" className="tk-icono tk-peligro" onClick={() => onBorrar(t)} aria-label={`Borrar «${t.titulo}»`} title="Borrar"><Ico n="papelera" s={16} /></button>
            </div>
          );
        })}
      </div>
    </Ventana>
  );
}

function EditorEtiquetas({ etiquetas, tareas, onGuardar, onCerrar }) {
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
        si: "Quitar", peligro: true, accent: TINTA,
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
    <Ventana titulo="Etiquetas" pista="El color dice de qué va cada tarea. Quitar una no borra ninguna tarea." cambiado={cambiado} onCerrar={onCerrar} ancho={460}>
      <form onSubmit={enviar}>
        <div className="tk-filas">
          {lista.map((e) => (
            <div key={e.id}>
              <div className="tk-fila">
                <button
                  type="button" className="tk-muestra" aria-label={`Color de ${e.nombre || "la etiqueta"}`} aria-expanded={paleta === e.id}
                  onClick={() => setPaleta(paleta === e.id ? null : e.id)} style={{ background: e.color }}
                />
                <input
                  className="tk-campo" value={e.nombre} maxLength={MAX_NOMBRE_ETIQUETA} placeholder="Nombre" aria-label="Nombre de la etiqueta"
                  autoFocus={!e.nombre} onChange={(ev) => cambiar(e.id, "nombre", ev.target.value)} style={{ margin: 0 }}
                />
                <span className="tk-cuenta" title="Tareas con esta etiqueta">{usos(e.id) || ""}</span>
                <button type="button" className="tk-icono tk-peligro" onClick={() => quitar(e)} aria-label={`Quitar ${e.nombre}`}><Ico n="papelera" s={16} /></button>
              </div>
              {paleta === e.id && (
                <div className="tk-paleta">
                  {COLORES_ETIQUETA.map((c) => (
                    <button key={c} type="button" aria-label={c} aria-pressed={e.color === c} onClick={() => { cambiar(e.id, "color", c); setPaleta(null); }} style={{ background: c, color: c }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {lista.length < MAX_ETIQUETAS && (
          <button type="button" className="tk-btn tk-btn-suave" style={{ marginTop: 10 }} onClick={nueva}><Ico n="mas" s={15} /> Nueva etiqueta</button>
        )}
        {error && <div className="tk-error" style={{ margin: "12px 0 0" }}>{error}</div>}
        <div className="tk-ventana-pie">
          <span style={{ flex: 1 }} />
          <button type="button" className="tk-btn tk-btn-suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="tk-btn" disabled={ocupado || !cambiado} aria-busy={ocupado || undefined}>Guardar</button>
        </div>
      </form>
    </Ventana>
  );
}

// ------------------------------------------------------------- estilos
// Todo cuelga de `.tk` y de sus propias variables: papel cálido de día, carbón de
// noche. La pantalla tapa la página entera (`position: fixed`): el tablero no enseña
// nada de la app. Archivar y borrar al pasar el ratón; con el dedo (`hover: none`) no
// salen, que se tocarían al ir a abrir la tarea, y están dentro de ella.
const CSS = `
  .tk {
    --fondo: #f1efe9; --lista: #e7e4dc; --panel: #ffffff; --tinta: #1c1b19; --suave: #615d55; --tenue: #9a958b;
    --raya: rgb(28 27 25 / 0.1); --velo: rgb(28 27 25 / 0.06); --sombra: 0 1px 2px rgb(28 27 25 / 0.08), 0 4px 12px -6px rgb(28 27 25 / 0.18);
    --mal: #c2410c; --foco: #2563eb;
    position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column;
    background: var(--fondo); color: var(--tinta);
    font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Roboto, sans-serif;
    -webkit-font-smoothing: antialiased; color-scheme: light;
  }
  :root[data-tema="oscuro"] .tk {
    --fondo: #111113; --lista: #1a1a1d; --panel: #26262b; --tinta: #f3f1ec; --suave: #aaa69d; --tenue: #74716a;
    --raya: rgb(255 255 255 / 0.1); --velo: rgb(255 255 255 / 0.07); --sombra: 0 1px 2px rgb(0 0 0 / 0.4), 0 6px 14px -6px rgb(0 0 0 / 0.6);
    --mal: #fb923c; --foco: #7aa7ff; color-scheme: dark;
  }
  .tk *, .tk *::before, .tk *::after { box-sizing: border-box; }
  .tk button { font: inherit; color: inherit; cursor: pointer; }
  .tk :focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }
  .tk i { font-style: normal; }
  .tk-punto { display: inline-block; width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }

  /* ---------- la barra ---------- */
  .tk-barra { display: flex; align-items: center; gap: 10px; padding: 14px 22px 12px; flex-shrink: 0; }
  .tk-volver { display: inline-flex; align-items: center; gap: 2px; height: 34px; padding: 0 10px 0 6px; margin-left: -6px; border-radius: 10px; color: var(--suave); text-decoration: none; font-weight: 600; font-size: 13px; }
  .tk-volver:hover { background: var(--velo); color: var(--tinta); }
  .tk-titulo { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0 8px 0 2px; }
  .tk-filtros { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; padding: 3px; }
  .tk-filtros::-webkit-scrollbar { display: none; }
  .tk-gente { display: flex; gap: 4px; }
  .tk-persona { border: 0; background: none; padding: 0; border-radius: 50%; display: grid; opacity: 0.55; transition: opacity 0.15s, box-shadow 0.15s; }
  .tk-persona:hover { opacity: 0.85; }
  .tk-persona[aria-pressed="true"] { opacity: 1; box-shadow: 0 0 0 2px var(--fondo), 0 0 0 4px var(--tinta); }
  .tk-gente:not(:has([aria-pressed="true"])) .tk-persona { opacity: 1; }
  .tk-raya { width: 1px; height: 20px; background: var(--raya); margin: 0 6px; flex-shrink: 0; }
  .tk-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--raya); background: transparent; color: var(--suave); font-size: 12.5px; font-weight: 600; white-space: nowrap; flex-shrink: 0; transition: background 0.15s, color 0.15s; }
  .tk-chip i { width: 8px; height: 8px; border-radius: 50%; }
  .tk-chip:hover { background: var(--velo); color: var(--tinta); }
  .tk-chip-quitar { border-style: dashed; }
  .tk-busca { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 10px; background: var(--velo); color: var(--suave); width: 170px; flex-shrink: 0; transition: width 0.2s, box-shadow 0.15s; }
  .tk-busca:focus-within { width: 220px; box-shadow: 0 0 0 2px var(--foco); color: var(--tinta); }
  .tk-busca input { border: 0; background: none; outline: none; font: inherit; color: var(--tinta); width: 100%; min-width: 0; }
  .tk-busca input::placeholder { color: var(--tenue); }
  .tk-icono { position: relative; display: inline-grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: var(--suave); flex-shrink: 0; }
  .tk-icono:hover { background: var(--velo); color: var(--tinta); }
  .tk-icono b { position: absolute; top: 2px; right: 1px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 99px; background: var(--tinta); color: var(--fondo); font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; }
  .tk-icono-mini { width: 28px; height: 28px; border-radius: 8px; }
  .tk-peligro, .tk-peligro:hover { color: var(--mal); }

  /* ---------- las listas ---------- */
  .tk-tablero { flex: 1; min-height: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(272px, 1fr); grid-template-rows: minmax(0, 1fr); gap: 14px; padding: 6px 22px 18px; overflow-x: auto; align-items: start; }
  .tk-lista { display: flex; flex-direction: column; max-height: 100%; min-width: 0; background: var(--lista); border-radius: 18px; padding: 6px; transition: box-shadow 0.15s; }
  .tk-lista[data-encima] { box-shadow: 0 0 0 2px var(--tinta); }
  .tk-lista-cabeza { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 2px 4px 2px 10px; flex-shrink: 0; }
  .tk-lista-cabeza h2 { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
  .tk-cuenta { font-size: 12px; font-weight: 600; color: var(--tenue); font-variant-numeric: tabular-nums; flex: 1; }
  .tk-lista-cuerpo { display: flex; flex-direction: column; gap: 8px; padding: 2px 4px 6px; min-height: 44px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--raya) transparent; }
  .tk-vacia { margin: 8px 6px; font-size: 13px; color: var(--tenue); text-align: center; }
  .tk-hueco { border-radius: 12px; background: var(--velo); border: 1.5px dashed var(--tenue); flex-shrink: 0; }
  .tk-fantasma { height: 62px; border-radius: 12px; background: var(--velo); animation: tk-late 1.2s ease-in-out infinite alternate; }
  @keyframes tk-late { to { opacity: 0.45; } }
  .tk-anadir { display: flex; align-items: center; gap: 6px; width: 100%; height: 36px; padding: 0 10px; border: 0; border-radius: 12px; background: transparent; color: var(--suave); font-weight: 600; font-size: 13px; flex-shrink: 0; }
  .tk-anadir:hover { background: var(--velo); color: var(--tinta); }
  .tk-nueva { padding: 2px 4px 4px; flex-shrink: 0; }
  .tk-nueva textarea { display: block; width: 100%; resize: none; border: 0; outline: none; border-radius: 12px; padding: 10px 12px; background: var(--panel); color: var(--tinta); font: inherit; font-weight: 550; box-shadow: var(--sombra), 0 0 0 2px var(--foco); }
  .tk-nueva-pie { display: flex; align-items: center; gap: 4px; margin-top: 8px; }

  /* ---------- la tarjeta ---------- */
  .tk-carta { position: relative; flex-shrink: 0; border-radius: 12px; padding: 10px 12px 9px; background: var(--panel); color: var(--tinta); box-shadow: var(--sombra); cursor: grab; transition: transform 0.12s ease, box-shadow 0.12s ease; user-select: none; }
  .tk-carta:hover { transform: translateY(-1px); }
  .tk-carta:active { cursor: grabbing; }
  .tk-carta[data-rellena] {
    color: var(--t);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.13), rgb(255 255 255 / 0) 55%), var(--c);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14), 0 8px 16px -10px var(--c);
  }
  .tk-carta[data-hecha] { color: var(--suave); box-shadow: none; background: color-mix(in srgb, var(--panel) 62%, transparent); }
  .tk-carta[data-arrastrada] { display: none; }
  .tk-carta[data-suelta] { cursor: pointer; }
  .tk-carta-titulo { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.35; letter-spacing: -0.005em; overflow-wrap: anywhere; }
  .tk-carta[data-hecha] .tk-carta-titulo { font-weight: 500; }
  .tk-carta-pie { display: flex; align-items: center; gap: 8px; margin-top: 8px; min-height: 22px; font-size: 11.5px; font-weight: 600; }
  .tk-carta-etiqueta { display: inline-flex; align-items: center; gap: 5px; opacity: 0.82; letter-spacing: 0.02em; }
  .tk-carta-dato { display: inline-flex; align-items: center; gap: 3px; opacity: 0.75; }
  .tk-avatares { display: inline-flex; flex-shrink: 0; }
  .tk-avatares > * + * { margin-left: -6px; }
  .tk-avatar { display: inline-grid; place-items: center; border-radius: 50%; font-weight: 800; flex-shrink: 0; letter-spacing: 0; }
  .tk-acciones { position: absolute; top: 6px; right: 6px; display: flex; gap: 1px; padding: 2px; border-radius: 10px; background: rgb(24 24 27 / 0.78); color: #fff; backdrop-filter: blur(6px); opacity: 0; transform: translateY(-2px); pointer-events: none; transition: opacity 0.12s, transform 0.12s; }
  .tk-carta:hover .tk-acciones, .tk-carta:focus-within .tk-acciones { opacity: 1; transform: none; pointer-events: auto; }
  .tk-accion { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; }
  .tk-accion:hover { background: rgb(255 255 255 / 0.2); }
  .tk-en-mano { position: fixed; top: -2000px; left: -2000px; transform: rotate(3deg); pointer-events: none; }
  .tk-en-mano .tk-acciones { display: none; }

  /* dentro de un montón abierto: los botones, a la vista */
  .tk-carta-botones { display: flex; align-items: center; gap: 2px; margin: 10px -4px -2px; padding-top: 8px; border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
  .tk-carta-botones .tk-accion:hover, .tk-subir:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
  .tk-subir { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px 0 7px; border: 0; border-radius: 8px; background: color-mix(in srgb, currentColor 10%, transparent); font-size: 12.5px; font-weight: 700; }
  .tk-abanico { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; align-items: start; max-height: min(64vh, 620px); overflow-y: auto; padding: 4px 2px 6px; margin: 0 -2px; }
  .tk-abanico .tk-carta { animation: tk-sale 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.15) backwards; }
  .tk-abanico .tk-carta:nth-child(2) { animation-delay: 0.03s; } .tk-abanico .tk-carta:nth-child(3) { animation-delay: 0.06s; }
  .tk-abanico .tk-carta:nth-child(4) { animation-delay: 0.09s; } .tk-abanico .tk-carta:nth-child(n+5) { animation-delay: 0.12s; }
  @keyframes tk-sale { from { opacity: 0; transform: translateY(14px) scale(0.94); } }

  /* ---------- el muelle: lo de Claude, en montones ---------- */
  .tk-muelle { flex-shrink: 0; display: flex; align-items: center; gap: 22px; padding: 12px 22px 20px; border-top: 1px solid var(--raya); }
  .tk-muelle-rotulo { display: grid; gap: 2px; flex-shrink: 0; max-width: 150px; }
  .tk-muelle-nombre { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; letter-spacing: -0.01em; }
  .tk-muelle-pista { font-size: 12px; color: var(--tenue); line-height: 1.3; }
  .tk-montones { display: flex; gap: 16px; overflow-x: auto; padding: 22px 8px 4px; margin: -14px 0 0; scrollbar-width: none; flex: 1; min-width: 0; }
  .tk-montones::-webkit-scrollbar { display: none; }
  .tk-monton { --c: var(--panel); --t: var(--tinta); position: relative; flex: 0 0 196px; height: 76px; padding: 0; border: 0; background: none; text-align: left; }
  .tk-monton-cara, .tk-monton-capa { position: absolute; inset: 0; border-radius: 12px; background: var(--c); transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
  .tk-monton-cara { display: flex; flex-direction: column; gap: 4px; padding: 9px 11px; color: var(--t); background: linear-gradient(180deg, rgb(255 255 255 / 0.13), rgb(255 255 255 / 0) 55%), var(--c); box-shadow: 0 1px 2px rgb(0 0 0 / 0.14), 0 8px 14px -10px rgb(0 0 0 / 0.5); }
  .tk-monton-capa[data-n="2"] { transform: translateY(-7px) scale(0.93); filter: brightness(0.84); }
  .tk-monton-capa[data-n="3"] { transform: translateY(-14px) scale(0.86); filter: brightness(0.68); }
  .tk-monton:hover .tk-monton-cara { transform: translateY(2px); }
  .tk-monton:hover .tk-monton-capa[data-n="2"] { transform: translateY(-10px) rotate(-3deg) scale(0.96); }
  .tk-monton:hover .tk-monton-capa[data-n="3"] { transform: translateY(-16px) rotate(4deg) scale(0.93); }
  .tk-monton-cabeza { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em; opacity: 0.85; }
  .tk-monton-nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tk-monton-cuenta { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: color-mix(in srgb, currentColor 18%, transparent); font-size: 11.5px; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums; }
  .tk-monton-titulo { font-size: 13px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* ---------- ventanas ---------- */
  .tk-ventana { margin: auto; border: 0; padding: 0; background: transparent; color: var(--tinta); max-width: none; max-height: calc(100% - 28px); overflow: visible; }
  .tk-ventana::backdrop { background: rgb(15 15 17 / 0.45); backdrop-filter: blur(3px); }
  .tk-ventana[open] .tk-ventana-caja { animation: tk-entra 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.1); }
  @keyframes tk-entra { from { opacity: 0; transform: translateY(10px) scale(0.98); } }
  .tk-ventana-caja { background: var(--fondo); border-radius: 20px; padding: 18px 20px 18px; box-shadow: 0 24px 70px rgb(0 0 0 / 0.35); max-height: calc(100vh - 28px); overflow-y: auto; }
  .tk-ventana-cabeza { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
  .tk-ventana-cabeza h2 { display: flex; align-items: center; gap: 8px; margin: 4px 0 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
  .tk-ventana-cabeza h2 .tk-cuenta { flex: none; font-size: 14px; }
  .tk-ventana-cabeza p { margin: 3px 0 0; font-size: 12.5px; color: var(--tenue); }
  .tk-ventana-pie { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 20px; }
  .tk-rotulo { display: block; margin: 16px 0 7px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tenue); }
  .tk-campo { display: block; width: 100%; border: 1px solid var(--raya); border-radius: 12px; padding: 10px 12px; background: var(--panel); color: var(--tinta); font: inherit; outline: none; resize: vertical; }
  .tk-campo:focus { border-color: transparent; box-shadow: 0 0 0 2px var(--foco); }
  .tk-campo::placeholder { color: var(--tenue); }
  .tk-campo-titulo { font-size: 18px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; resize: none; }
  .tk-opciones { display: flex; flex-wrap: wrap; gap: 6px; }
  .tk-opcion { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--raya); background: transparent; color: var(--suave); font-size: 13px; font-weight: 600; }
  .tk-opcion:hover { background: var(--velo); color: var(--tinta); }
  .tk-opcion[aria-pressed="true"] { background: var(--tinta); color: var(--fondo); border-color: transparent; }
  .tk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 16px; border: 0; border-radius: 11px; background: var(--tinta); color: var(--fondo) !important; font-weight: 700; font-size: 13.5px; white-space: nowrap; }
  .tk-btn:hover { filter: brightness(1.25); }
  .tk-btn:disabled { opacity: 0.35; cursor: default; filter: none; }
  .tk-btn-suave { background: transparent; color: var(--suave) !important; padding: 0 11px; font-weight: 600; }
  .tk-btn-suave:hover { background: var(--velo); color: var(--tinta) !important; filter: none; }
  .tk-btn-suave.tk-peligro, .tk-btn-suave.tk-peligro:hover { color: var(--mal) !important; }
  .tk-filas { display: grid; gap: 2px; }
  .tk-fila { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
  .tk-fila-titulo { font-weight: 600; overflow-wrap: anywhere; }
  .tk-fila-dato { font-size: 12px; color: var(--tenue); }
  .tk-fila .tk-cuenta { flex: none; min-width: 20px; text-align: right; }
  .tk-muestra { width: 36px; height: 36px; border: 0; border-radius: 11px; flex-shrink: 0; }
  .tk-paleta { display: flex; flex-wrap: wrap; gap: 7px; margin: 4px 0 8px 46px; }
  .tk-paleta button { width: 26px; height: 26px; border: 0; border-radius: 50%; padding: 0; }
  .tk-paleta button[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fondo), 0 0 0 4px currentColor; }
  .tk-error { margin: 0 22px 10px; padding: 10px 14px; border-radius: 12px; background: color-mix(in srgb, var(--mal) 12%, transparent); color: var(--mal); font-weight: 600; display: flex; align-items: center; gap: 10px; }
  .tk-dicho { position: fixed; left: 50%; bottom: 26px; z-index: 60; transform: translateX(-50%); padding: 9px 16px; border-radius: 99px; background: var(--tinta); color: var(--fondo); font-weight: 600; font-size: 13px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.3); animation: tk-sube 0.2s ease-out; pointer-events: none; white-space: nowrap; }
  @keyframes tk-sube { from { opacity: 0; transform: translate(-50%, 8px); } }

  @media (hover: none) { .tk-acciones { display: none; } .tk-carta:hover { transform: none; } }
  @media (prefers-reduced-motion: reduce) { .tk *, .tk *::before { animation: none !important; transition: none !important; } }
  @media (max-width: 899px) {
    .tk-barra { flex-wrap: wrap; padding: 12px 14px 8px; gap: 8px; }
    .tk-titulo { flex: 1; }
    .tk-filtros { order: 5; flex: 0 0 100%; }
    .tk-busca, .tk-busca:focus-within { order: 4; flex: 0 0 100%; width: auto; }
    .tk-tablero { grid-auto-columns: min(84vw, 320px); padding: 4px 14px 14px; gap: 10px; scroll-snap-type: x mandatory; scroll-padding: 0 14px; }
    .tk-lista { scroll-snap-align: start; }
    .tk-muelle { flex-direction: column; align-items: stretch; gap: 0; padding: 10px 14px 14px; }
    .tk-muelle-rotulo { display: flex; align-items: baseline; gap: 8px; max-width: none; }
    .tk-monton { flex-basis: 170px; }
  }
`;
