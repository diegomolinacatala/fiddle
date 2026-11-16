import { MAX_NOTA, MAX_TITULO, COLORES_ETIQUETA, idDeEtiqueta } from "./tareas.js";

// ============================================================================
// EL TABLERO Y EL VAULT, A LA PAR
// ----------------------------------------------------------------------------
// Las tareas viven en dos sitios: el tablero de /admin (tabla `tareas`) y las notas
// de `Tareas/` del vault. Víctor y Diego tocan las dos, y Claude las junta con
// `npm run tareas` (scripts/sincronizar-tareas.mjs). Aquí está la cuenta, pura: qué
// cambia en cada lado. Leer y escribir es cosa del script.
//
// - Cada pareja se reconoce por `tablero: <id>` en la nota (sobrevive a renombrarla)
//   y, en la fila, `vault = { archivo, base }`: `base` es cómo quedaron los campos en
//   la última vuelta. Con eso se sabe QUIÉN cambió cada campo: si solo uno, gana ese;
//   si los dos, el que se tocó más tarde (y se avisa).
// - Se comparten título, columna (`estado`), quién (`responsable`), etiqueta y nota
//   (`## Detalle`). Fecha límite, prioridad, tienda… son solo del vault.
// - Nada se pierde: borrar en el tablero deja la nota `descartada` (el vault no
//   borra notas); `descartada` en el vault la quita del tablero. Una nota abierta sin
//   pareja entra en el tablero; una tarea del tablero sin nota, crea su nota.
// ============================================================================

export const CAMPOS = ["titulo", "columna", "quien", "etiqueta", "nota"];

const ESTADO_DE_COLUMNA = { pendiente: "pendiente", en_curso: "en curso", esperando: "esperando", hecha: "hecha" };
const COLUMNA_DE_ESTADO = Object.fromEntries(Object.entries(ESTADO_DE_COLUMNA).map(([c, e]) => [e, c]));
const RESPONSABLE_DE_QUIEN = { victor: "Víctor", diego: "Diego", ambos: "Ambos" };
const ABIERTOS = ["pendiente", "en curso", "esperando"];

const plano = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const recorta = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() : s);

export function quienDeResponsable(r) {
  const p = plano(r);
  if (p === "victor") return "victor";
  if (p === "diego") return "diego";
  if (p === "ambos" || p === "los dos") return "ambos";
  return null;
}

// ------------------------------------------------------------ leer una nota
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

/** Lo que importa de una nota de `Tareas/`. */
export function leerNota(texto, archivo) {
  const fm = FRONTMATTER.exec(texto);
  const props = {};
  for (const linea of (fm?.[1] || "").split(/\r?\n/)) {
    const m = /^([A-Za-z_]+):[ \t]*(.*)$/.exec(linea);
    if (m) props[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
  const cuerpo = fm ? texto.slice(fm[0].length) : texto;
  const h1 = /^# (.+)$/m.exec(cuerpo);
  const nombre = archivo.split("/").pop().replace(/\.md$/i, "");
  return {
    archivo,
    tipo: props.tipo || "",
    estado: plano(props.estado),
    responsable: props.responsable || "",
    etiqueta: props.etiqueta || "",
    tablero: props.tablero || null,
    creada: props.creada || "",
    titulo: (h1?.[1] || nombre).trim(),
    detalle: seccion(cuerpo, "Detalle") ?? "",
  };
}

function seccion(cuerpo, nombre) {
  const lineas = cuerpo.split(/\r?\n/);
  const i = lineas.findIndex((l) => l.trim() === `## ${nombre}`);
  if (i < 0) return null;
  let j = i + 1;
  while (j < lineas.length && !/^##? /.test(lineas[j])) j++;
  return lineas.slice(i + 1, j).join("\n").trim();
}

// ------------------------------------------------------------ escribir una nota
/**
 * La nota con estos cambios y lo demás tal cual. `cambios`: `estado`, `responsable`,
 * `etiqueta`, `tablero` (propiedades), `titulo` (el `# …`) y `detalle` (`## Detalle`).
 */
export function escribirNota(texto, cambios) {
  const nl = texto.includes("\r\n") ? "\r\n" : "\n";
  let fm = FRONTMATTER.exec(texto);
  let cabecera = fm ? fm[1].split(/\r?\n/) : ["tipo: tarea"];
  let cuerpo = fm ? texto.slice(fm[0].length) : texto;

  for (const clave of ["estado", "responsable", "etiqueta", "tablero"]) {
    if (!(clave in cambios)) continue;
    const linea = cambios[clave] ? `${clave}: ${cambios[clave]}` : `${clave}:`;
    const i = cabecera.findIndex((l) => l.startsWith(`${clave}:`));
    if (i >= 0) cabecera[i] = linea;
    else cabecera.push(linea);
  }

  let lineas = cuerpo.split(/\r?\n/);
  if ("titulo" in cambios) {
    const i = lineas.findIndex((l) => /^# /.test(l));
    if (i >= 0) lineas[i] = `# ${cambios.titulo}`;
    else lineas.unshift(`# ${cambios.titulo}`, "");
  }
  if ("detalle" in cambios) {
    const i = lineas.findIndex((l) => l.trim() === "## Detalle");
    const nuevo = cambios.detalle ? cambios.detalle.split(/\r?\n/) : [];
    if (i < 0) {
      while (lineas.length && lineas.at(-1) === "") lineas.pop();
      lineas.push("", "## Detalle", ...nuevo, "");
    } else {
      let j = i + 1;
      while (j < lineas.length && !/^##? /.test(lineas[j])) j++;
      lineas.splice(i + 1, j - i - 1, ...nuevo, "");
    }
  }
  cuerpo = lineas.join(nl);
  return `---${nl}${cabecera.join(nl)}${nl}---${nl}${cuerpo}`;
}

/** Una nota nueva para una tarea que solo estaba en el tablero, con la plantilla del vault. */
export function notaNueva({ titulo, columna, quien, etiqueta, nota, tablero, creada, de }) {
  return [
    "---",
    "tipo: tarea",
    `estado: ${ESTADO_DE_COLUMNA[columna] || "pendiente"}`,
    "tienda: []",
    quien ? `responsable: ${RESPONSABLE_DE_QUIEN[quien]}` : "responsable:",
    "fecha_limite:",
    "prioridad: media",
    `creada: ${creada}`,
    ...(de ? [`de: ${RESPONSABLE_DE_QUIEN[de] || de}`] : []),
    etiqueta ? `etiqueta: ${etiqueta}` : "etiqueta:",
    `tablero: ${tablero}`,
    "---",
    `# ${titulo}`,
    "",
    "## Detalle",
    ...(nota ? [nota] : []),
    "",
  ].join("\n");
}

/** `Tareas/<título>.md`, sin lo que no cabe en un nombre de fichero y sin chocar con otro. */
export function archivoPara(titulo, ocupados) {
  const base = recorta(String(titulo).replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim(), 120) || "Tarea";
  const libres = new Set([...ocupados].map((a) => a.toLowerCase()));
  let archivo = `Tareas/${base}.md`;
  for (let i = 2; libres.has(archivo.toLowerCase()); i++) archivo = `Tareas/${base} (${i}).md`;
  return archivo;
}

// ------------------------------------------------------------ la cuenta
/**
 * Qué hay que tocar en cada lado.
 * @param {object} p
 * @param {{archivo:string, texto:string, editado?:string|null}[]} p.notas  las de `Tareas/` (editado: último commit, ISO)
 * @param {object[]} p.tareas    las filas del tablero
 * @param {{id:string,nombre:string,color:string}[]} p.etiquetas
 * @param {string} p.hoy  AAAA-MM-DD, para `creada` de las notas nuevas
 * @param {number} [p.ahora]
 */
export function planDeSincronia({ notas, tareas, etiquetas, hoy, ahora = Date.now() }) {
  const plan = {
    etiquetas: [...etiquetas], etiquetasNuevas: [],
    importar: [], cambiarFila: [], borrarFila: [],
    cambiarNota: [], crearNota: [], renombrar: [],
    conflictos: [], avisos: [],
  };
  const etiquetaPorNombre = (nombre) => {
    if (!nombre) return null;
    const hay = plan.etiquetas.find((e) => plano(e.nombre) === plano(nombre));
    if (hay) return hay.id;
    const nueva = {
      id: idDeEtiqueta(nombre, plan.etiquetas),
      nombre: recorta(nombre, 24),
      color: COLORES_ETIQUETA.find((c) => !plan.etiquetas.some((e) => e.color === c)) || COLORES_ETIQUETA[plan.etiquetas.length % COLORES_ETIQUETA.length],
    };
    plan.etiquetas.push(nueva);
    plan.etiquetasNuevas.push(nueva);
    return nueva.id;
  };
  const nombreDeEtiqueta = (id) => plan.etiquetas.find((e) => e.id === id)?.nombre || "";

  const leidas = notas.map((n) => ({ ...leerNota(n.texto, n.archivo), texto: n.texto, editado: n.editado || null }))
    .filter((n) => n.tipo === "tarea");
  const filaPorId = new Map(tareas.map((t) => [t.id, t]));
  const usadas = new Set();
  const ladoVault = (n) => ({
    titulo: recorta(n.titulo, MAX_TITULO),
    columna: COLUMNA_DE_ESTADO[n.estado] || null,
    quien: quienDeResponsable(n.responsable),
    etiqueta: etiquetaPorNombre(n.etiqueta),
    nota: recorta(n.detalle, MAX_NOTA) || null,
  });
  const ladoTablero = (t) => ({
    titulo: t.titulo,
    columna: t.columna,
    quien: t.quien ?? null,
    etiqueta: plan.etiquetas.some((e) => e.id === t.etiqueta) ? t.etiqueta : null,
    nota: t.nota ?? null,
  });

  // Una nota que perdió su `tablero:` se reconoce por el archivo; una sin pareja y con
  // el mismo título que una tarea suelta del tablero, por el título (se crearon las dos).
  const sueltas = () => tareas.filter((t) => !usadas.has(t.id) && !leidas.some((n) => n.tablero === t.id));
  for (const n of leidas) {
    if (n.tablero && filaPorId.has(n.tablero)) continue;
    const porArchivo = sueltas().find((t) => t.vault?.archivo === n.archivo);
    const porTitulo = !n.tablero && ABIERTOS.concat("hecha").includes(n.estado)
      ? sueltas().find((t) => !t.vault && plano(t.titulo) === plano(n.titulo))
      : null;
    const pareja = porArchivo || porTitulo;
    if (pareja) { n.tablero = pareja.id; n.reenlazada = true; }
  }

  const ocupados = new Set(leidas.map((n) => n.archivo));
  let orden = 0;
  for (const n of leidas) {
    const fila = n.tablero ? filaPorId.get(n.tablero) : null;

    if (n.tablero && !fila) {
      // Tenía pareja y ya no está: la borraron en el tablero.
      if (ABIERTOS.includes(n.estado)) {
        plan.cambiarNota.push({ archivo: n.archivo, cambios: { estado: "descartada" } });
        plan.avisos.push(`«${n.titulo}»: se borró del tablero; en el vault queda descartada.`);
      }
      continue;
    }

    if (!fila) {
      if (!ABIERTOS.includes(n.estado)) continue; // lo cerrado antes del tablero se queda en el vault
      const v = ladoVault(n);
      const marca = Date.parse(`${n.creada}T12:00:00Z`);
      plan.importar.push({ archivo: n.archivo, tarea: { ...v, orden: (Number.isFinite(marca) ? marca : ahora) + orden++ } });
      continue;
    }

    usadas.add(fila.id);
    if (n.estado === "descartada") {
      plan.borrarFila.push({ id: fila.id, titulo: fila.titulo });
      plan.avisos.push(`«${n.titulo}»: descartada en el vault; sale del tablero.`);
      continue;
    }

    const v = ladoVault(n);
    const t = ladoTablero(fila);
    const base = fila.vault?.base || null;
    // Supabase y git escriben la hora con zonas distintas: se comparan como fechas.
    const masNuevoElTablero = Boolean(fila.actualizado && (!n.editado || Date.parse(fila.actualizado) > Date.parse(n.editado)));
    const final = {};
    for (const c of CAMPOS) {
      if (v[c] === t[c]) { final[c] = v[c]; continue; }
      const cambioVault = !base || v[c] !== base[c];
      const cambioTablero = !base || t[c] !== base[c];
      // Un Detalle más largo de lo que cabe en el tablero no se pisa desde allí.
      const detalleLargo = c === "nota" && n.detalle.length > MAX_NOTA;
      let gana;
      if (detalleLargo) gana = "vault";
      else if (cambioVault && !cambioTablero) gana = "vault";
      else if (cambioTablero && !cambioVault) gana = "tablero";
      else gana = masNuevoElTablero ? "tablero" : "vault";
      if ((cambioVault && cambioTablero) || (detalleLargo && cambioTablero)) {
        plan.conflictos.push({ archivo: n.archivo, campo: c, vault: v[c], tablero: t[c], gana });
      }
      final[c] = gana === "vault" ? v[c] : t[c];
    }
    // `columna` null = el vault tiene un estado que el tablero no conoce: se queda la del tablero.
    if (final.columna === null) final.columna = t.columna;

    // Un título nuevo desde el tablero renombra el archivo (el nombre de la nota es el de la cosa).
    let archivo = n.archivo;
    if (final.titulo !== v.titulo) {
      ocupados.delete(n.archivo);
      archivo = archivoPara(final.titulo, ocupados);
      ocupados.add(archivo);
      if (archivo !== n.archivo) plan.renombrar.push({ de: n.archivo, a: archivo });
    }

    const aFila = {};
    for (const c of CAMPOS) if (final[c] !== t[c]) aFila[c] = final[c];
    const nuevaBase = Object.fromEntries(CAMPOS.map((c) => [c, final[c]]));
    const baseCambia = JSON.stringify(nuevaBase) !== JSON.stringify(base) || fila.vault?.archivo !== archivo;
    if (Object.keys(aFila).length || baseCambia) {
      plan.cambiarFila.push({ id: fila.id, cambios: { ...aFila, vault: { archivo, base: nuevaBase } } });
    }

    const aNota = {};
    if (final.titulo !== v.titulo) aNota.titulo = final.titulo;
    if (final.columna !== v.columna) aNota.estado = ESTADO_DE_COLUMNA[final.columna];
    if (final.quien !== v.quien) aNota.responsable = RESPONSABLE_DE_QUIEN[final.quien] || "";
    if (final.etiqueta !== v.etiqueta) aNota.etiqueta = nombreDeEtiqueta(final.etiqueta);
    if (final.nota !== v.nota) aNota.detalle = final.nota || "";
    if (n.reenlazada) aNota.tablero = fila.id;
    if (Object.keys(aNota).length) plan.cambiarNota.push({ archivo: n.archivo, cambios: aNota });
  }

  // Tareas del tablero sin nota: se escribe la suya.
  for (const t of tareas) {
    if (usadas.has(t.id)) continue;
    const archivo = archivoPara(t.titulo, ocupados);
    ocupados.add(archivo);
    const lado = ladoTablero(t);
    plan.crearNota.push({
      id: t.id,
      archivo,
      texto: notaNueva({ ...lado, etiqueta: nombreDeEtiqueta(lado.etiqueta), tablero: t.id, creada: (t.creado || "").slice(0, 10) || hoy, de: t.autor }),
      base: Object.fromEntries(CAMPOS.map((c) => [c, lado[c]])),
    });
  }
  return plan;
}

/** El resumen que lee una persona: qué se hizo o se haría. */
export function resumenDelPlan(plan) {
  const lineas = [];
  const n = (lista, texto) => lista.length && lineas.push(`${texto}: ${lista.length}`);
  n(plan.importar, "Notas del vault que entran en el tablero");
  n(plan.crearNota, "Tareas del tablero que pasan al vault");
  n(plan.cambiarNota, "Notas del vault que cambian");
  n(plan.cambiarFila.filter((c) => Object.keys(c.cambios).some((k) => k !== "vault")), "Tareas del tablero que cambian");
  n(plan.borrarFila, "Tareas que salen del tablero");
  n(plan.etiquetasNuevas, "Etiquetas nuevas en el tablero");
  for (const c of plan.conflictos) lineas.push(`Cambiado en los dos sitios: ${c.archivo} (${c.campo}); se queda lo del ${c.gana}.`);
  for (const a of plan.avisos) lineas.push(a);
  return lineas.length ? lineas.join("\n") : "Todo a la par: nada que cambiar.";
}
