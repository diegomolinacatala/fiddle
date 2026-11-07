import { NextResponse } from "next/server";
import { planesGlobales, guardarPlanes } from "@/lib/store";
import { validarPlanes } from "@/lib/planes";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo que lleva cada plan (lib/planes.js), para todas las tiendas a la vez.
//   GET  -> { esencial, plus, pro }   cada uno { nombre, maxTarjetas, margen, funciones }
//   PUT  { esencial, plus, pro }      los tres enteros, ya revisados en la pantalla
// Solo el admin. Lo que se cambia aquí llega a las demás funciones en un minuto como
// mucho (la memoria del store) y a los pases la próxima vez que se pongan al día:
// no se empujan los de todas las tiendas, que serían miles de firmas de golpe.

export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    return NextResponse.json(await planesGlobales());
  } catch (e) {
    return errorInterno("admin planes GET", e);
  }
}

export async function PUT(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const r = validarPlanes(await request.json().catch(() => null));
    if (r.error) return jsonError(r.error, 400);
    const planes = await guardarPlanes(r.planes);
    // De la plataforma, no de una tienda: va apuntado con negocio "plataforma".
    await auditar(sesion, "plataforma", "config", "planes");
    return NextResponse.json(planes);
  } catch (e) {
    return errorInterno("admin planes PUT", e);
  }
}
