import { NextResponse } from "next/server";
import { listTareas, crearTarea, cambiarTarea, borrarTarea, etiquetasDeTareas, huellaDeTareas } from "@/lib/store";
import { leerTarea, PERSONAS } from "@/lib/tareas";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El tablero de Víctor y Diego (/admin → Tareas, lib/tareas.js). Solo el admin.
//   GET               -> { tareas, etiquetas, yo, huella }   yo: "victor" | "diego" | null (sesión sin nombre)
//   GET ?huella=1     -> { huella }   lo que pregunta la pantalla abierta cada pocos segundos
//   POST  {titulo, nota?, etiqueta?, quien?, columna?, orden?}  -> la tarea creada
//   PATCH ?id=<id>  {lo que cambie, archivada?: bool, adoptar?: true} -> la tarea como queda
//                   (`adoptar`: una de las de Claude pasa a ser de quien la sube al tablero)
//   DELETE ?id=<id>
// No va a `auditoria`: es la lista de cosas por hacer de los dos, no un dato de nadie.

const yoDe = (sesion) => (PERSONAS.some((p) => p.id === sesion.usuario) ? sesion.usuario : null);

export async function GET(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    if (new URL(request.url).searchParams.has("huella")) return NextResponse.json({ huella: await huellaDeTareas() });
    // La huella se lee ANTES que el tablero: si algo cambia entre las dos, la siguiente
    // pregunta lo ve distinto y vuelve a pedirlo. Al revés, se perdería ese cambio.
    const huella = await huellaDeTareas();
    const [tareas, etiquetas] = await Promise.all([listTareas(), etiquetasDeTareas()]);
    return NextResponse.json({ tareas, etiquetas, yo: yoDe(sesion), huella });
  } catch (e) {
    return errorInterno("admin tareas GET", e);
  }
}

export async function POST(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const r = leerTarea(await request.json().catch(() => null), { etiquetas: await etiquetasDeTareas() });
    if (r.error) return jsonError(r.error, 400);
    // Sin autor sería «de Claude» (así llegan las del vault): lo creado aquí siempre lo lleva.
    return NextResponse.json(await crearTarea(r.tarea, { autor: yoDe(sesion) || "admin" }));
  } catch (e) {
    return errorInterno("admin tareas POST", e);
  }
}

export async function PATCH(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("Falta el id", 400);
    const r = leerTarea(await request.json().catch(() => null), { etiquetas: await etiquetasDeTareas(), parcial: true });
    if (r.error) return jsonError(r.error, 400);
    // Quedarse una de las de Claude es ponerle autor: quién, lo dice la sesión.
    const { adoptar, ...cambios } = r.tarea;
    if (adoptar) cambios.autor = yoDe(sesion) || "admin";
    const tarea = await cambiarTarea(id, cambios);
    if (!tarea) return jsonError("Esa tarea ya no existe", 404);
    return NextResponse.json(tarea);
  } catch (e) {
    return errorInterno("admin tareas PATCH", e);
  }
}

export async function DELETE(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("Falta el id", 400);
    await borrarTarea(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("admin tareas DELETE", e);
  }
}
