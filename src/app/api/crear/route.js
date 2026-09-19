import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/wallet";
import { esNegocio } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Emite un pase para un negocio y devuelve JSON (botón "Emitir uno" del manager).
// POST /api/crear?b=<slug>
export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esNegocio(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;

  try {
    const r = await emitirPase(slug);
    return NextResponse.json({
      serial: r.cliente.serial,
      codigo: r.cliente.codigo,
      negocio: slug,
      proveedor: r.proveedor,
      urlPase: r.urlPase,
      googleSaveUrl: r.googleSaveUrl,
    });
  } catch (e) {
    return errorInterno("crear", e);
  }
}
