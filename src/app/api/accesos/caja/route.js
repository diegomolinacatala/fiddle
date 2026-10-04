import { NextResponse } from "next/server";
import { nuevaClave } from "@/lib/accesos";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/accesos/caja?b=<slug> -> contraseña nueva para la caja de esa tienda.
// La pide su manager (p. ej. cuando se va un empleado). Se devuelve una vez.
export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { sesion, respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;
  try {
    const clave = await nuevaClave(slug, "caja");
    await auditar(sesion, slug, "clave", "caja");
    return NextResponse.json(clave);
  } catch (e) {
    return errorInterno("accesos caja", e);
  }
}
