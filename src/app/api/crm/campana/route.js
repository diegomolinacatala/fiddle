import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { mandarMensaje } from "@/lib/campanas";
import { esDestino, esPromo } from "@/lib/envios";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manda un mensaje a un GRUPO de clientes (o a todos, "solo ese día").
 * POST /api/crm/campana  body: { b, grupo, texto }   (texto vacío = quitarlo)
 *
 * El grupo se vuelve a calcular en el servidor (lib/campanas.js). Lo que enseña
 * la pantalla es una foto de hace unos segundos y, sobre todo, no se manda a una
 * lista que venga de fuera: el navegador dice "los que se están enfriando", no a quién.
 */
export async function POST(request) {
  try {
    const { b, grupo, texto } = await request.json().catch(() => ({}));
    if (!esSlug(b)) return jsonError("Falta o no existe b (negocio)", 400);
    const { respuesta } = await exigirNegocio(request, b, "manager");
    if (respuesta) return respuesta;
    if (!esDestino(grupo) || esPromo(grupo)) return jsonError(`No existe el grupo "${grupo}"`, 400);

    const negocio = await getNegocio(b);
    if (!negocio) return jsonError("Ese negocio no existe", 404);
    const r = await mandarMensaje(negocio, grupo, texto, { actor: "manager" });
    return r.error ? jsonError(r.error, r.status) : NextResponse.json(r);
  } catch (e) {
    return errorInterno("crm campaña", e);
  }
}
