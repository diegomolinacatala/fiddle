import { NextResponse } from "next/server";
import { getNegocio, saveNegocio } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { notificarNegocio } from "@/lib/wallet";
import { patchNegocio } from "@/lib/validacion";
import { prepararPropios } from "@/lib/propiosServidor";
import { negocioDelPersonal } from "@/lib/tarjeta";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo de la config que sale en el pase (y por eso obliga a ponerlo al día).
const PASE = ["nombre", "tema", "meta", "premio", "cartillas", "ubicaciones", "contacto"];

// GET /api/negocio?b=<slug>  -> config actual (con tema). Caja o manager.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("negocio desconocido", 404);
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;
  try {
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("negocio desconocido", 404);
    return NextResponse.json(negocioDelPersonal(negocio));
  } catch (e) {
    return errorInterno("negocio GET", e);
  }
}

// PUT /api/negocio?b=<slug>  -> guarda la config editable (y pone al día los pases si hace falta).
export async function PUT(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("negocio desconocido", 404);
  const { sesion, respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;

  try {
    const body = await request.json().catch(() => ({}));
    const actual = await getNegocio(slug);
    if (!actual) return jsonError("negocio desconocido", 404);
    const r = patchNegocio(body, Object.keys(ACCIONES), { cartillasActuales: actual.cartillas, cartillasAparcadas: actual.cartillasAparcadas, ESTILOS, temaPorDefecto });
    if (r.error) return jsonError(r.error, 400);
    // Lo de su kit y lo que ha subido ella, sí; lo de otra tienda, no (lib/propiosServidor.js).
    const p = await prepararPropios(slug, r.patch, actual);
    if (p.error) return jsonError(p.error, 400);
    r.patch = p.patch;

    const nuevo = await saveNegocio(slug, r.patch);
    if (!nuevo) return jsonError("negocio desconocido", 404);
    await auditar(sesion, slug, "config", Object.keys(r.patch).join(", "));
    // Solo lo que se ve en el pase merece mover los teléfonos: el horario o los
    // botones de la caja no salen en él, y guardarlos no debe tocar cientos de tarjetas.
    // (El "Abierto hasta…" de la tarjeta web lo recoge ella sola al preguntar.)
    const tocaPase = PASE.some((k) => k in r.patch);
    const aviso = tocaPase ? await notificarNegocio(nuevo, { cartilla: true }) : null;
    return NextResponse.json({ ...negocioDelPersonal(nuevo), aviso });
  } catch (e) {
    return errorInterno("negocio PUT", e);
  }
}
