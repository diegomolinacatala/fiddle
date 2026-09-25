import { NextResponse } from "next/server";
import { getNegocio, saveNegocio } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";
import { esSlug } from "@/lib/negocios";
import { notificarNegocio } from "@/lib/wallet";
import { patchNegocio } from "@/lib/validacion";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo de la config que sale en el pase (y por eso obliga a ponerlo al día).
const PASE = ["meta", "premio", "cartillas", "ubicaciones"];

// GET /api/negocio?b=<slug>  -> config actual (con tema). Caja o manager.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("negocio desconocido", 404);
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;
  try {
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("negocio desconocido", 404);
    return NextResponse.json(negocio);
  } catch (e) {
    return errorInterno("negocio GET", e);
  }
}

// PUT /api/negocio?b=<slug>  -> guarda la config editable (y pone al día los pases si hace falta).
export async function PUT(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("negocio desconocido", 404);
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;

  try {
    const body = await request.json().catch(() => ({}));
    const actual = await getNegocio(slug);
    if (!actual) return jsonError("negocio desconocido", 404);
    const r = patchNegocio(body, Object.keys(ACCIONES), { cartillasActuales: actual.cartillas });
    if (r.error) return jsonError(r.error, 400);

    const nuevo = await saveNegocio(slug, r.patch);
    if (!nuevo) return jsonError("negocio desconocido", 404);
    // Solo lo que se ve en el pase merece mover los teléfonos: el horario o los
    // botones de la caja no salen en él, y guardarlos no debe tocar cientos de tarjetas.
    const tocaPase = PASE.some((k) => k in r.patch);
    const aviso = tocaPase ? await notificarNegocio(nuevo, { cartilla: true }) : null;
    return NextResponse.json({ ...nuevo, aviso });
  } catch (e) {
    return errorInterno("negocio PUT", e);
  }
}
