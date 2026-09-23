import { NextResponse } from "next/server";
import { datosCrm } from "@/lib/crmDatos";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Todo lo que pinta el panel del CRM, en UNA petición (ver lib/crmDatos.js).
// La página lo carga en el servidor; esto es para recargar desde el navegador.
// GET /api/crm?b=<slug>
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;

  try {
    const datos = await datosCrm(slug);
    if (!datos) return jsonError("Ese negocio no existe", 404);
    return NextResponse.json(datos);
  } catch (e) {
    return errorInterno("crm", e);
  }
}
