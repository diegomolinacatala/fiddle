import { NextResponse } from "next/server";
import { guardarEtiquetasDeTareas } from "@/lib/store";
import { leerEtiquetas } from "@/lib/tareas";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Las etiquetas de color del tablero de tareas (/admin → Tareas).
//   PUT [{id, nombre, color}, …]   la lista entera, como queda -> la lista guardada
// Quitar una no toca las tareas: las que la llevaban se pintan sin etiqueta y la
// recuperan si vuelve una con el mismo identificador.

export async function PUT(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const r = leerEtiquetas(await request.json().catch(() => null));
    if (r.error) return jsonError(r.error, 400);
    return NextResponse.json(await guardarEtiquetasDeTareas(r.etiquetas));
  } catch (e) {
    return errorInterno("admin tareas/etiquetas PUT", e);
  }
}
