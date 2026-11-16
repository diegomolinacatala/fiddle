// ============================================================================
// EL TABLERO DE TAREAS DE VÍCTOR Y DIEGO (/admin → Tareas)
// ----------------------------------------------------------------------------
// Un Trello pequeño: columnas, quién la lleva y una etiqueta de color que dice de
// qué va (marketing, ventas…). Es de la plataforma, no de una tienda: no llega a
// ningún manager ni a ninguna caja.
//
// Las columnas y «Los dos» son los mismos `estado` y `responsable` de las tareas
// del vault, para que pasar una de un sitio a otro no sea traducir.
//
// Puro y sin nada del servidor: lo usan la pantalla (para pintar y para mover al
// momento) y la ruta (para no guardar nada que no encaje).
// ============================================================================

export const PERSONAS = [
  { id: "victor", nombre: "Víctor", inicial: "V", color: "#2563eb" },
  { id: "diego", nombre: "Diego", inicial: "D", color: "#0f766e" },
];

/** Quién la lleva. `null` = sin decidir todavía. */
export const RESPONSABLES = [...PERSONAS.map(({ id, nombre }) => ({ id, nombre })), { id: "ambos", nombre: "Los dos" }];

export const COLUMNAS = [
  { id: "pendiente", nombre: "Por hacer" },
  { id: "en_curso", nombre: "En curso" },
  { id: "esperando", nombre: "Esperando" },
  { id: "hecha", nombre: "Hecho" },
];
export const HECHA = "hecha";

/** Con lo que arranca el tablero; las demás las crean ellos (`config` en `plataforma`). */
export const ETIQUETAS_DE_PARTIDA = [
  { id: "marketing", nombre: "Marketing", color: "#d6336c" },
  { id: "ventas", nombre: "Ventas", color: "#2f9e44" },
  { id: "clientes", nombre: "Clientes", color: "#e8590c" },
  { id: "producto", nombre: "Producto", color: "#1c7ed6" },
  { id: "gestion", nombre: "Gestión", color: "#7048e8" },
];

/** Los colores que se ofrecen al crear una etiqueta: oscuros para ir de fondo con texto blanco. */
export const COLORES_ETIQUETA = [
  "#e03131", "#d6336c", "#ae3ec9", "#7048e8", "#1c7ed6", "#1098ad",
  "#2f9e44", "#66a80f", "#f08c00", "#e8590c", "#8d6e63", "#495057",
];

export const MAX_TITULO = 140;
export const MAX_NOTA = 2000;
export const MAX_ETIQUETAS = 20;
export const MAX_NOMBRE_ETIQUETA = 24;

const HEX = /^#[0-9a-f]{6}$/i;
const ID_ETIQUETA = /^[a-z0-9-]{1,30}$/;
const texto = (v) => (typeof v === "string" ? v.trim() : "");

const esColumna = (id) => COLUMNAS.some((c) => c.id === id);
const esResponsable = (id) => RESPONSABLES.some((r) => r.id === id);

/**
 * Lo que llega del navegador para crear (`parcial` false) o cambiar una tarea.
 * Al cambiar, solo lo que venga; al crear, lo que falte va de partida.
 * @param {object} cuerpo
 * @param {{ etiquetas: {id:string}[], parcial?: boolean }} opciones
 * @returns {{ tarea: object } | { error: string }}
 */
export function leerTarea(cuerpo, { etiquetas, parcial = false }) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return { error: "Faltan los datos de la tarea" };
  const tarea = {};
  const hay = (k) => !parcial || k in cuerpo;

  if (hay("titulo")) {
    const t = texto(cuerpo.titulo).replace(/\s+/g, " ");
    if (!t) return { error: "Escribe qué hay que hacer" };
    if (t.length > MAX_TITULO) return { error: `El título, como mucho ${MAX_TITULO} letras` };
    tarea.titulo = t;
  }
  if (hay("nota")) {
    const n = texto(cuerpo.nota);
    if (n.length > MAX_NOTA) return { error: `La nota, como mucho ${MAX_NOTA} letras` };
    tarea.nota = n || null;
  }
  if (hay("etiqueta")) {
    const e = cuerpo.etiqueta ?? null;
    if (e !== null && !etiquetas.some((x) => x.id === e)) return { error: "Esa etiqueta ya no existe" };
    tarea.etiqueta = e;
  }
  if (hay("quien")) {
    const q = cuerpo.quien ?? null;
    if (q !== null && !esResponsable(q)) return { error: "Quién la lleva: Víctor, Diego o los dos" };
    tarea.quien = q;
  }
  if (hay("columna")) {
    const c = cuerpo.columna ?? (parcial ? undefined : COLUMNAS[0].id);
    if (!esColumna(c)) return { error: "Esa columna no existe" };
    tarea.columna = c;
  }
  if ("orden" in cuerpo) {
    if (!Number.isFinite(cuerpo.orden)) return { error: "Orden no válido" };
    tarea.orden = cuerpo.orden;
  }
  if (parcial && !Object.keys(tarea).length) return { error: "No hay nada que cambiar" };
  return { tarea };
}

/**
 * La lista entera de etiquetas, como la deja la pantalla. Nombres sin repetir y
 * colores `#rrggbb` (el color va a un `style`: nada sin validar).
 * @returns {{ etiquetas: {id:string, nombre:string, color:string}[] } | { error: string }}
 */
export function leerEtiquetas(lista) {
  if (!Array.isArray(lista)) return { error: "Faltan las etiquetas" };
  if (lista.length > MAX_ETIQUETAS) return { error: `Como mucho ${MAX_ETIQUETAS} etiquetas` };
  const etiquetas = [];
  for (const e of lista) {
    const id = texto(e?.id);
    const nombre = texto(e?.nombre).replace(/\s+/g, " ");
    const color = texto(e?.color).toLowerCase();
    if (!ID_ETIQUETA.test(id)) return { error: "Etiqueta sin identificador" };
    if (!nombre) return { error: "Cada etiqueta necesita un nombre" };
    if (nombre.length > MAX_NOMBRE_ETIQUETA) return { error: `«${nombre}»: como mucho ${MAX_NOMBRE_ETIQUETA} letras` };
    if (!HEX.test(color)) return { error: `«${nombre}»: color no válido` };
    if (etiquetas.some((x) => x.id === id)) return { error: "Hay dos etiquetas con el mismo identificador" };
    if (etiquetas.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) return { error: `Ya hay una etiqueta «${nombre}»` };
    etiquetas.push({ id, nombre, color });
  }
  return { etiquetas };
}

/** Un identificador para una etiqueta nueva, sacado del nombre y que no choque con ninguna. */
export function idDeEtiqueta(nombre, etiquetas) {
  const base = String(nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "etiqueta";
  let id = base;
  for (let i = 2; etiquetas.some((e) => e.id === id); i++) id = `${base}-${i}`;
  return id;
}

// Separación entre una tarea y la siguiente al ponerla en un extremo. Las nuevas
// van con la hora (Date.now()): siempre al final y sin preguntar a la base cuál
// era la última. Entre dos, la mitad: miles de milisegundos dan para muchas mitades.
const PASO = 1000;

/** Dónde va una tarea que se suelta entre `antes` y `despues` (sus `orden`, o null en un extremo). */
export function ordenEntre(antes, despues, ahora = Date.now()) {
  if (antes == null && despues == null) return ahora;
  if (antes == null) return despues - PASO;
  if (despues == null) return Math.max(antes + PASO, ahora);
  return (antes + despues) / 2;
}

/**
 * Las tareas de cada columna, en su orden. «Hecho» va de la última terminada a la
 * primera: ahí el orden a mano no dice nada y lo reciente es lo que se busca.
 * @returns {Record<string, object[]>}
 */
export function porColumna(tareas) {
  const columnas = Object.fromEntries(COLUMNAS.map((c) => [c.id, []]));
  for (const t of tareas) (columnas[t.columna] || columnas[COLUMNAS[0].id]).push(t);
  for (const [id, lista] of Object.entries(columnas)) {
    lista.sort(id === HECHA
      ? (a, b) => String(b.terminada || b.actualizado || "").localeCompare(String(a.terminada || a.actualizado || "")) || a.orden - b.orden
      : (a, b) => a.orden - b.orden || String(a.id).localeCompare(String(b.id)));
  }
  return columnas;
}

/** ¿La lleva esta persona? «Los dos» cuenta para los dos; sin nadie, para ninguno. */
export const esDe = (tarea, persona) => tarea.quien === persona || tarea.quien === "ambos";

/** Las personas que salen en la tarjeta de una tarea. */
export const personasDe = (quien) => (quien === "ambos" ? PERSONAS : PERSONAS.filter((p) => p.id === quien));
