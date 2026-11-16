import { describe, it, expect } from "vitest";
import { leerNota, escribirNota, notaNueva, archivoPara, planDeSincronia, resumenDelPlan, quienDeResponsable } from "@/lib/sincronia";
import { ETIQUETAS_DE_PARTIDA } from "@/lib/tareas";

// Notas inventadas con la forma de las del vault (Plantillas/Tarea.md).
const nota = ({ titulo = "Llamar al obrador", estado = "pendiente", responsable = "Víctor", etiqueta, tablero, detalle = "Preguntar por el horario." } = {}) => [
  "---",
  "tipo: tarea",
  `estado: ${estado}`,
  'tienda: ["[[Panadería Inventada]]"]',
  `responsable: ${responsable}`,
  "fecha_limite: 2026-12-01",
  "prioridad: alta",
  "creada: 2026-11-02",
  ...(etiqueta !== undefined ? [`etiqueta: ${etiqueta}`] : []),
  ...(tablero ? [`tablero: ${tablero}`] : []),
  "---",
  `# ${titulo}`,
  "",
  "## Detalle",
  detalle,
  "",
  "## Por decidir",
  "- ¿Mañana o tarde?",
  "",
].join("\n");

const fila = (o = {}) => ({
  id: "t1", titulo: "Llamar al obrador", columna: "pendiente", quien: "victor", etiqueta: null,
  nota: "Preguntar por el horario.", orden: 1, actualizado: "2026-11-10T10:00:00.000+00:00", ...o,
});
const base = (o = {}) => ({ titulo: "Llamar al obrador", columna: "pendiente", quien: "victor", etiqueta: null, nota: "Preguntar por el horario.", ...o });
const plan = (notas, tareas, etiquetas = ETIQUETAS_DE_PARTIDA) =>
  planDeSincronia({ notas, tareas, etiquetas, hoy: "2026-11-16", ahora: 0 });

describe("leer y escribir una nota del vault", () => {
  it("saca título, estado, quién, etiqueta, enlace y Detalle (sin las otras secciones)", () => {
    expect(leerNota(nota({ etiqueta: "Ventas", tablero: "abc" }), "Tareas/Llamar al obrador.md")).toMatchObject({
      tipo: "tarea", estado: "pendiente", responsable: "Víctor", etiqueta: "Ventas", tablero: "abc",
      titulo: "Llamar al obrador", detalle: "Preguntar por el horario.", creada: "2026-11-02",
    });
    expect(leerNota("sin cabecera", "Tareas/Algo.md")).toMatchObject({ titulo: "Algo", tipo: "", detalle: "" });
  });

  it("cambia solo lo pedido y deja lo demás (tienda, prioridad, Por decidir) tal cual", () => {
    const antes = nota();
    const despues = escribirNota(antes, { estado: "en curso", responsable: "Ambos", etiqueta: "Ventas", tablero: "abc", titulo: "Llamar al obrador hoy", detalle: "Otra cosa.\nEn dos líneas." });
    const leida = leerNota(despues, "x.md");
    expect(leida).toMatchObject({ estado: "en curso", responsable: "Ambos", etiqueta: "Ventas", tablero: "abc", titulo: "Llamar al obrador hoy", detalle: "Otra cosa.\nEn dos líneas." });
    expect(despues).toContain('tienda: ["[[Panadería Inventada]]"]');
    expect(despues).toContain("prioridad: alta");
    expect(despues).toContain("## Por decidir\n- ¿Mañana o tarde?");
    // Lo que no se pide no se toca.
    expect(escribirNota(antes, {})).toBe(antes);
  });

  it("respeta los saltos de línea de Windows", () => {
    const crlf = nota().replace(/\n/g, "\r\n");
    expect(escribirNota(crlf, { estado: "hecha" })).toBe(crlf.replace("estado: pendiente", "estado: hecha"));
  });

  it("una nota nueva sigue la plantilla y se lee igual que se escribió", () => {
    const texto = notaNueva({ titulo: "Subir el logo", columna: "en_curso", quien: "diego", etiqueta: "Marketing", nota: "En PNG.", tablero: "t9", creada: "2026-11-16", de: "victor" });
    expect(texto).toMatch(/^---\ntipo: tarea\nestado: en curso\ntienda: \[\]\nresponsable: Diego\n/);
    expect(texto).toContain("de: Víctor");
    expect(leerNota(texto, "Tareas/Subir el logo.md")).toMatchObject({ estado: "en curso", etiqueta: "Marketing", tablero: "t9", detalle: "En PNG.", titulo: "Subir el logo" });
  });

  it("el archivo sale del título, sin caracteres raros ni choques", () => {
    expect(archivoPara("¿Precio: 19 €/mes?", [])).toBe("Tareas/¿Precio 19 €mes.md");
    expect(archivoPara("Llamar", ["Tareas/llamar.md"])).toBe("Tareas/Llamar (2).md");
  });

  it("responsable del vault ↔ quién del tablero", () => {
    expect(["Víctor", "victor", "Diego", "Ambos", "Los dos", "", "Pepe"].map(quienDeResponsable))
      .toEqual(["victor", "victor", "diego", "ambos", "ambos", null, null]);
  });
});

describe("qué cambia en cada lado", () => {
  it("una nota abierta sin pareja entra en el tablero; las cerradas, no", () => {
    const p = plan([
      { archivo: "Tareas/A.md", texto: nota({ titulo: "A", estado: "esperando", responsable: "Ambos", etiqueta: "ventas" }) },
      { archivo: "Tareas/B.md", texto: nota({ titulo: "B", estado: "hecha" }) },
      { archivo: "Tareas/C.md", texto: nota({ titulo: "C", estado: "descartada" }) },
      { archivo: "Citas/X.md", texto: nota().replace("tipo: tarea", "tipo: cita") },
    ], []);
    expect(p.importar).toEqual([{ archivo: "Tareas/A.md", tarea: expect.objectContaining({ titulo: "A", columna: "esperando", quien: "ambos", etiqueta: "ventas", nota: "Preguntar por el horario." }) }]);
    expect(p.crearNota).toEqual([]);
  });

  it("una etiqueta del vault que el tablero no tiene se crea, con un color libre", () => {
    const p = plan([{ archivo: "Tareas/A.md", texto: nota({ etiqueta: "Diseño" }) }], []);
    expect(p.etiquetasNuevas).toEqual([{ id: "diseno", nombre: "Diseño", color: expect.stringMatching(/^#[0-9a-f]{6}$/) }]);
    expect(ETIQUETAS_DE_PARTIDA.map((e) => e.color)).not.toContain(p.etiquetasNuevas[0].color);
    expect(p.importar[0].tarea.etiqueta).toBe("diseno");
  });

  it("una tarea del tablero sin nota escribe la suya", () => {
    const p = plan([], [fila({ id: "t7", titulo: "Grabar vídeo", columna: "en_curso", quien: "diego", etiqueta: "marketing", nota: null, creado: "2026-11-15T09:00:00Z", autor: "victor" })]);
    expect(p.crearNota).toHaveLength(1);
    expect(p.crearNota[0].archivo).toBe("Tareas/Grabar vídeo.md");
    expect(leerNota(p.crearNota[0].texto, "x")).toMatchObject({ estado: "en curso", responsable: "Diego", etiqueta: "Marketing", tablero: "t7", creada: "2026-11-15" });
  });

  it("lo que cambió un solo lado gana, campo a campo", () => {
    // En el tablero la movieron a «Hecho»; en el vault le cambiaron el responsable.
    const p = plan(
      [{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "t1", responsable: "Diego" }), editado: "2026-11-12T10:00:00+01:00" }],
      [fila({ columna: "hecha", vault: { archivo: "Tareas/Llamar al obrador.md", base: base() } })],
    );
    expect(p.cambiarFila).toEqual([{ id: "t1", cambios: { quien: "diego", vault: { archivo: "Tareas/Llamar al obrador.md", base: base({ columna: "hecha", quien: "diego" }) } } }]);
    expect(p.cambiarNota).toEqual([{ archivo: "Tareas/Llamar al obrador.md", cambios: { estado: "hecha" } }]);
    expect(p.conflictos).toEqual([]);
  });

  it("si los dos cambiaron lo mismo, gana el último y se avisa", () => {
    const enlazada = (editado) => plan(
      [{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "t1", estado: "esperando" }), editado }],
      [fila({ columna: "en_curso", actualizado: "2026-11-10T10:00:00.000+00:00", vault: { archivo: "Tareas/Llamar al obrador.md", base: base() } })],
    );
    // 11:30 en Madrid es 10:30 UTC: el vault es más nuevo aunque «11» > «10» no lo diga todo.
    expect(enlazada("2026-11-10T11:30:00+01:00").conflictos).toEqual([expect.objectContaining({ campo: "columna", gana: "vault" })]);
    expect(enlazada("2026-11-10T10:30:00+01:00").conflictos).toEqual([expect.objectContaining({ campo: "columna", gana: "tablero" })]);
  });

  it("todo igual: nada que hacer", () => {
    const p = plan(
      [{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "t1" }) }],
      [fila({ vault: { archivo: "Tareas/Llamar al obrador.md", base: base() } })],
    );
    expect([p.importar, p.cambiarFila, p.cambiarNota, p.crearNota, p.borrarFila].every((l) => !l.length)).toBe(true);
    expect(resumenDelPlan(p)).toMatch(/a la par/);
  });

  it("nada se pierde: borrada en el tablero = descartada en el vault; descartada en el vault = fuera del tablero", () => {
    const borrada = plan([{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "ya-no-esta" }) }], []);
    expect(borrada.cambiarNota).toEqual([{ archivo: "Tareas/Llamar al obrador.md", cambios: { estado: "descartada" } }]);
    expect(borrada.crearNota).toEqual([]);

    const descartada = plan(
      [{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "t1", estado: "descartada" }) }],
      [fila({ vault: { archivo: "Tareas/Llamar al obrador.md", base: base() } })],
    );
    expect(descartada.borrarFila).toEqual([{ id: "t1", titulo: "Llamar al obrador" }]);
  });

  it("un título nuevo en el tablero renombra el archivo", () => {
    const p = plan(
      [{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "t1" }) }],
      [fila({ titulo: "Llamar al obrador el lunes", vault: { archivo: "Tareas/Llamar al obrador.md", base: base() } })],
    );
    expect(p.renombrar).toEqual([{ de: "Tareas/Llamar al obrador.md", a: "Tareas/Llamar al obrador el lunes.md" }]);
    expect(p.cambiarNota[0].cambios).toEqual({ titulo: "Llamar al obrador el lunes" });
    expect(p.cambiarFila[0].cambios.vault.archivo).toBe("Tareas/Llamar al obrador el lunes.md");
  });

  it("la misma tarea creada en los dos sitios antes de enlazarlas se junta por el título", () => {
    const p = plan([{ archivo: "Tareas/Llamar al obrador.md", texto: nota() }], [fila()]);
    expect(p.importar).toEqual([]);
    expect(p.crearNota).toEqual([]);
    expect(p.cambiarNota).toEqual([{ archivo: "Tareas/Llamar al obrador.md", cambios: { tablero: "t1" } }]);
  });

  it("un Detalle más largo de lo que cabe en el tablero nunca se pisa desde el tablero", () => {
    const largo = "x".repeat(2500);
    const p = plan(
      [{ archivo: "Tareas/Llamar al obrador.md", texto: nota({ tablero: "t1", detalle: largo }) }],
      [fila({ nota: "corta", vault: { archivo: "Tareas/Llamar al obrador.md", base: base({ nota: "x".repeat(2000) }) } })],
    );
    expect(p.cambiarNota).toEqual([]);
    expect(p.cambiarFila[0].cambios.nota).toHaveLength(2000);
    expect(p.conflictos).toEqual([expect.objectContaining({ campo: "nota", gana: "vault" })]);
  });
});
