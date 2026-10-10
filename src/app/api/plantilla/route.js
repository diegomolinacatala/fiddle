import { NextResponse } from "next/server";
import { saveNegocio } from "@/lib/store";
import { nuevoEmpleado, cambiarEmpleado } from "@/lib/plantilla";
import { jsonError, errorInterno, exigirTienda } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La plantilla de una tienda (lib/plantilla.js): quién puede atender la caja.
// Solo su manager. Los números de cada uno los calcula la página con los
// eventos (lib/plantillaDatos.js); aquí solo se toca la lista.
//   GET  ?b=<slug>                              -> { plantilla }
//   POST ?b=<slug>  { nombre }                  -> alta        -> { plantilla, empleado }
//   PUT  ?b=<slug>  { id, nombre?, activo? }    -> renombrar, baja o vuelta -> { plantilla, empleado }
// Queda apuntado en la auditoría con el id de la persona, nunca con su nombre.

export async function GET(request) {
  try {
    const { respuesta, negocio } = await exigirTienda(request, "manager");
    if (respuesta) return respuesta;
    return NextResponse.json({ plantilla: negocio.plantilla });
  } catch (e) {
    return errorInterno("plantilla GET", e);
  }
}

export async function POST(request) {
  try {
    const { respuesta, slug, sesion, negocio } = await exigirTienda(request, "manager");
    if (respuesta) return respuesta;
    const body = (await request.json().catch(() => null)) ?? {};
    const r = nuevoEmpleado(negocio.plantilla, body.nombre);
    if (r.error) return jsonError(r.error, 400);
    const nuevo = await saveNegocio(slug, { plantilla: r.plantilla });
    // Si al releer no está (la lista se recortó al normalizar), mejor un error que un alta fantasma.
    if (!nuevo.plantilla.some((e) => e.id === r.empleado.id)) return jsonError("No se pudo guardar el alta: la lista está llena", 409);
    await auditar(sesion, slug, "plantilla", `alta ${r.empleado.id}`);
    return NextResponse.json({ plantilla: nuevo.plantilla, empleado: r.empleado });
  } catch (e) {
    return errorInterno("plantilla POST", e);
  }
}

export async function PUT(request) {
  try {
    const { respuesta, slug, sesion, negocio } = await exigirTienda(request, "manager");
    if (respuesta) return respuesta;
    const body = (await request.json().catch(() => null)) ?? {};
    if (typeof body.id !== "string") return jsonError("Falta el id de la persona", 400);
    const cambios = {};
    if (body.nombre !== undefined) cambios.nombre = body.nombre;
    if (typeof body.activo === "boolean") cambios.activo = body.activo;
    const r = cambiarEmpleado(negocio.plantilla, body.id, cambios);
    if (r.error) return jsonError(r.error, 400);
    const nuevo = await saveNegocio(slug, { plantilla: r.plantilla });
    const que = [cambios.nombre !== undefined && "nombre", cambios.activo === false && "baja", cambios.activo === true && "vuelta"].filter(Boolean).join("+") || "nada";
    await auditar(sesion, slug, "plantilla", `${que} ${body.id}`);
    return NextResponse.json({ plantilla: nuevo.plantilla, empleado: r.empleado });
  } catch (e) {
    return errorInterno("plantilla PUT", e);
  }
}
