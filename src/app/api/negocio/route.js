import { NextResponse } from "next/server";
import { getNegocio, saveNegocio } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";
import { esNegocio } from "@/lib/negocios";
import { notificarNegocio } from "@/lib/wallet";
import { patchNegocio } from "@/lib/validacion";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/negocio?b=<slug>  -> config actual (con tema). Caja o manager.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esNegocio(slug)) return jsonError("negocio desconocido", 404);
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;
  try {
    return NextResponse.json(await getNegocio(slug));
  } catch (e) {
    return errorInterno("negocio GET", e);
  }
}

// PUT /api/negocio?b=<slug>  -> guarda la config editable y actualiza todos los pases.
export async function PUT(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esNegocio(slug)) return jsonError("negocio desconocido", 404);
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;

  try {
    const body = await request.json().catch(() => ({}));
    const r = patchNegocio(body, Object.keys(ACCIONES));
    if (r.error) return jsonError(r.error, 400);

    const nuevo = await saveNegocio(slug, r.patch);
    const aviso = await notificarNegocio(nuevo);
    return NextResponse.json({ ...nuevo, aviso });
  } catch (e) {
    return errorInterno("negocio PUT", e);
  }
}
