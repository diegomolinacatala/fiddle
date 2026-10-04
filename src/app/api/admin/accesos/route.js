import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { nuevaClave, estadoAccesos, ROLES_TIENDA } from "@/lib/accesos";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Contraseñas de una tienda, desde el admin (el middleware ya exige admin).
//   GET  ?slug=               cómo entra cada usuario (sin contraseñas)
//   POST { slug, rol }        genera una nueva y la devuelve UNA vez
export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  const slug = new URL(request.url).searchParams.get("slug");
  if (!esSlug(slug)) return jsonError("Falta ?slug=", 400);
  try {
    return NextResponse.json(await estadoAccesos(slug));
  } catch (e) {
    return errorInterno("admin accesos GET", e);
  }
}

export async function POST(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { slug, rol } = await request.json().catch(() => ({}));
    if (!esSlug(slug) || !ROLES_TIENDA.includes(rol)) return jsonError("Falta slug o rol (manager | caja)", 400);
    if (!(await getNegocio(slug, { incluirArchivados: true }))) return jsonError("Esa tienda no existe", 404);
    const clave = await nuevaClave(slug, rol);
    await auditar(sesion, slug, "clave", rol);
    return NextResponse.json(clave);
  } catch (e) {
    return errorInterno("admin accesos POST", e);
  }
}
