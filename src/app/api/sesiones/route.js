import { NextResponse } from "next/server";
import { cerrarSesionesDe } from "@/lib/sesionVigente";
import { firmarSesion, cookieSesion, COOKIE } from "@/lib/auth";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/sesiones?b=<slug> -> cierra todas las sesiones de la tienda (manager y
// caja, en todos los dispositivos) sin cambiar contraseñas: un ordenador ajeno donde
// se quedó abierta, un móvil perdido. La pide el manager desde Ajustes (o el admin);
// si es el manager, su sesión se vuelve a firmar aquí y no tiene que volver a entrar.
export async function DELETE(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { sesion, respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;
  try {
    const desde = await cerrarSesionesDe(slug);
    await auditar(sesion, slug, "sesiones", "cerradas");
    const res = NextResponse.json({ ok: true, desde });
    if (sesion.rol === "manager") {
      res.cookies.set(COOKIE, await firmarSesion(slug, "manager", Date.now(), { usuario: sesion.usuario }), cookieSesion("manager"));
    }
    return res;
  } catch (e) {
    return errorInterno("sesiones", e);
  }
}
