import { NextResponse } from "next/server";
import { esSlug } from "@/lib/negocios";
import { ponerPromo } from "@/lib/campanas";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lanza (o quita) una promo a TODOS los pases de un negocio. Solo su manager.
// POST /api/promo  body: { b: "<slug>", texto: "..." }   (texto vacío la quita)
export async function POST(request) {
  try {
    const { b, texto } = await request.json().catch(() => ({}));
    if (!esSlug(b)) return jsonError("Falta o no existe b (negocio)", 400);
    const { respuesta } = await exigirNegocio(request, b, "manager");
    if (respuesta) return respuesta;

    const r = await ponerPromo(b, texto);
    return r.error ? jsonError(r.error, r.status) : NextResponse.json(r);
  } catch (e) {
    return errorInterno("promo", e);
  }
}
