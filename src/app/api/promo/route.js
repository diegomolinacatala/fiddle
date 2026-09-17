import { NextResponse } from "next/server";
import { saveNegocio } from "@/lib/store";
import { esNegocio } from "@/lib/negocios";
import { notificarNegocio } from "@/lib/wallet";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lanza (o quita) una promo a TODOS los pases de un negocio. Solo su manager.
// POST /api/promo  body: { b: "<slug>", texto: "..." }   (texto vacío la quita)
export async function POST(request) {
  try {
    const { b, texto } = await request.json().catch(() => ({}));
    if (!esNegocio(b)) return jsonError("Falta o no existe b (negocio)", 400);
    const { respuesta } = await exigirNegocio(request, b, "manager");
    if (respuesta) return respuesta;

    const promo = typeof texto === "string" && texto.trim() ? texto.trim().slice(0, 200) : null;
    const negocio = await saveNegocio(b, { promo });
    const aviso = await notificarNegocio(negocio);
    return NextResponse.json({ promo: negocio.promo, ...aviso });
  } catch (e) {
    return errorInterno("promo", e);
  }
}
