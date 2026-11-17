import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";
import { nuevaTarjeta, guardarTarjeta, resumenTarjeta, conLlaveNueva } from "@/lib/dueno/tarjeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// LA TARJETA DEL DUEÑO, DESDE EL ADMIN (app/admin/TarjetaDuenoAdmin.js)
// ----------------------------------------------------------------------------
//   GET  ?slug=                   { activa, iphones }
//   PUT  { slug, activa }         encender (crea la tarjeta si no la tenía; si la
//                                 tenía, la MISMA: serial y token) o apagar (no borra)
//   POST { slug, accion:"llave" } token nuevo y sin iPhone: el pase viejo deja de valer
//
// Nunca devuelve serial, token ni la lista de dispositivos: la llave del pase no
// sale del servidor, tampoco hacia el admin.
// ============================================================================

/** La tienda de ese slug, o la respuesta de error que toque. */
async function tiendaDe(slug) {
  if (!esSlug(slug)) return { error: jsonError("Falta el negocio", 400) };
  const negocio = await getNegocio(slug);
  if (!negocio) return { error: jsonError("Esa tienda no existe (o está archivada)", 404) };
  return { negocio };
}

export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { negocio, error } = await tiendaDe(new URL(request.url).searchParams.get("slug"));
    return error || NextResponse.json(resumenTarjeta(negocio));
  } catch (e) {
    return errorInterno("admin dueño GET", e);
  }
}

export async function PUT(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { slug, activa } = await request.json().catch(() => ({}));
    if (typeof activa !== "boolean") return jsonError("Falta activa (true o false)", 400);
    const { negocio, error } = await tiendaDe(slug);
    if (error) return error;
    const t = negocio.tarjetaDueno;
    // Con serial y token ya guardados solo se vuelca el interruptor: así la que
    // está en el iPhone vuelve a funcionar al reencender.
    const parche = activa && !(t?.serial && t?.token) ? nuevaTarjeta(slug) : { activa };
    const guardada = await guardarTarjeta(slug, parche);
    await auditar(sesion, slug, "config", `tarjeta del dueño: ${activa ? "encendida" : "apagada"}`);
    return NextResponse.json(resumenTarjeta(guardada));
  } catch (e) {
    return errorInterno("admin dueño PUT", e);
  }
}

export async function POST(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { slug, accion } = await request.json().catch(() => ({}));
    if (accion !== "llave") return jsonError("Acción desconocida (llave)", 400);
    const { negocio, error } = await tiendaDe(slug);
    if (error) return error;
    const t = negocio.tarjetaDueno;
    if (!t?.serial || !t?.token) return jsonError("Esa tienda no tiene tarjeta del dueño", 404);
    const guardada = await guardarTarjeta(slug, conLlaveNueva());
    await auditar(sesion, slug, "config", "tarjeta del dueño: llave nueva");
    return NextResponse.json(resumenTarjeta(guardada));
  } catch (e) {
    return errorInterno("admin dueño POST", e);
  }
}
