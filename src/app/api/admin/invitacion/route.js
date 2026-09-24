import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { nuevaInvitacion, DIAS_VALIDA } from "@/lib/invitaciones";
import { usuarioDe } from "@/lib/auth";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { slug } -> enlace de invitación nuevo para el dueño de la tienda (el
// middleware ya exige admin). Los anteriores sin usar dejan de valer.
export async function POST(request) {
  try {
    const { slug } = await request.json().catch(() => ({}));
    if (!esSlug(slug)) return jsonError("Falta slug", 400);
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("Esa tienda no existe (o está archivada)", 404);
    const { url, caduca } = await nuevaInvitacion(slug);
    return NextResponse.json({
      url,
      caduca,
      dias: DIAS_VALIDA,
      nombre: negocio.nombre,
      usuarios: { manager: usuarioDe(slug, "manager"), caja: usuarioDe(slug, "caja") },
    });
  } catch (e) {
    return errorInterno("admin invitación", e);
  }
}
