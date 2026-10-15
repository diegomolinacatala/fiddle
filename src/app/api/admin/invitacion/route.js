import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { nuevaInvitacion, DIAS_VALIDA, ALCANCES } from "@/lib/invitaciones";
import { usuarioDe } from "@/lib/auth";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { slug, alcance? } -> enlace de invitación nuevo para el dueño de la tienda
// (el middleware ya exige admin). `alcance` "alta" (las dos contraseñas; lo de
// siempre) o "manager" (solo la suya: para recuperarla sin tocar la caja). Los
// anteriores sin usar dejan de valer. Queda en `auditoria` quién lo creó.
export async function POST(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { slug, alcance = "alta" } = await request.json().catch(() => ({}));
    if (!esSlug(slug)) return jsonError("Falta slug", 400);
    if (!ALCANCES.includes(alcance)) return jsonError("Alcance no válido (alta | manager)", 400);
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("Esa tienda no existe (o está archivada)", 404);
    const { url, caduca } = await nuevaInvitacion(slug, { alcance });
    await auditar(sesion, slug, "invitacion", `creada ${alcance}`);
    return NextResponse.json({
      url,
      caduca,
      alcance,
      dias: DIAS_VALIDA,
      nombre: negocio.nombre,
      usuarios: { manager: usuarioDe(slug, "manager"), caja: usuarioDe(slug, "caja") },
    });
  } catch (e) {
    return errorInterno("admin invitación", e);
  }
}
