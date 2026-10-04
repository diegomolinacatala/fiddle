import { NextResponse } from "next/server";
import { esSlug } from "@/lib/negocios";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/crm/exportar  body: { b, cuantos, que } -> apunta que se bajó la lista
// de clientes (docs/RGPD.md, 6.8). El CSV se arma en el navegador con lo que ya
// tiene la pantalla; esto solo deja constancia de quién, cuándo y cuántos.
export async function POST(request) {
  try {
    const { b, cuantos, que } = await request.json().catch(() => ({}));
    if (!esSlug(b)) return jsonError("Falta o no existe b (negocio)", 400);
    const { sesion, respuesta } = await exigirNegocio(request, b, "manager");
    if (respuesta) return respuesta;
    const n = Number.isInteger(cuantos) && cuantos >= 0 ? cuantos : null;
    // `que` es la clave del grupo, nunca la búsqueda: lo que se busca puede ser un nombre.
    const grupo = typeof que === "string" && /^[a-z0-9_-]{1,40}$/i.test(que) ? que : "todos";
    await auditar(sesion, b, "exportar", `${n ?? "?"} clientes · ${grupo}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("crm exportar", e);
  }
}
