import { NextResponse } from "next/server";
import { huellaDeTienda } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ¿Ha cambiado algo en la tienda? Lo pregunta cada medio minuto la pantalla del
// dueño que está abierta (app/useEnVivo.js) y solo si la respuesta es otra pide el
// CRM entero a /api/crm. Solo una firma: ni un dato de ningún cliente.
// GET /api/crm/huella?b=<slug>
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  // La caja también: «Hoy en la caja» se pone al día igual. Una firma no dice nada de nadie.
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;

  try {
    return NextResponse.json({ huella: await huellaDeTienda(slug) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorInterno("crm huella", e);
  }
}
