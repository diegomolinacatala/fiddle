import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { nuevaInvitacion, estadoInvitacion, enlacesFiables, DIAS_VALIDA, ALCANCES } from "@/lib/invitaciones";
import { usuarioDe } from "@/lib/auth";
import { esSlug } from "@/lib/negocios";
import { appUrl } from "@/lib/url";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?slug= -> cómo está el enlace de esa tienda: pendiente (y hasta cuándo),
// caducado sin usar, cuándo se usó el último. Es lo que pinta la ficha antes de
// ofrecer «crear otro»: así dos admins (o dos botones) no se anulan el enlace sin
// saberlo. `fiable` dice si este servidor guarda los enlaces de verdad
// (lib/invitaciones.js: en la web de dev no), y `base` dónde apuntarán.
export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!esSlug(slug)) return jsonError("Falta slug", 400);
    if (!(await getNegocio(slug))) return jsonError("Esa tienda no existe (o está archivada)", 404);
    return NextResponse.json({ ...(await estadoInvitacion(slug)), fiable: enlacesFiables(), base: appUrl() });
  } catch (e) {
    return errorInterno("admin invitación", e);
  }
}

// POST { slug, alcance? } -> enlace de invitación nuevo para el dueño de la tienda
// (el middleware ya exige admin). `alcance` "alta" (las dos contraseñas; lo de
// siempre) o "manager" (solo la suya: para recuperarla sin tocar la caja). Los
// anteriores sin usar dejan de valer, del alcance que sean. Queda en `auditoria`
// quién lo creó y con qué alcance (sin el token).
export async function POST(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { slug, alcance = "alta" } = await request.json().catch(() => ({}));
    if (!esSlug(slug)) return jsonError("Falta slug", 400);
    if (!ALCANCES.includes(alcance)) return jsonError("Alcance no válido (alta | manager)", 400);
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("Esa tienda no existe (o está archivada)", 404);
    const { url, token, caduca } = await nuevaInvitacion(slug, { alcance });
    await auditar(sesion, slug, "invitacion", `creada ${alcance}`);
    return NextResponse.json({
      url,
      token,
      caduca,
      alcance,
      dias: DIAS_VALIDA,
      fiable: enlacesFiables(),
      nombre: negocio.nombre,
      usuarios: { manager: usuarioDe(slug, "manager"), caja: usuarioDe(slug, "caja") },
    });
  } catch (e) {
    return errorInterno("admin invitación", e);
  }
}
