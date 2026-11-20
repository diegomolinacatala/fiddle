import { NextResponse } from "next/server";
import { esSlug } from "@/lib/negocios";
import { contarEspera } from "@/lib/store";
import { hayCorreo } from "@/lib/correo";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?slug=  ->  { esperan, hayCorreo }: cuántos hay en la lista de espera de esa
// tienda (lib/listaDeEspera.js) y si hay proveedor de correo para escribirles. Es
// lo que enseña su ficha en /admin; solo un número, nunca los correos.
export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!esSlug(slug)) return jsonError("Falta la tienda", 400);
    return NextResponse.json({ esperan: await contarEspera(slug), hayCorreo: hayCorreo() });
  } catch (e) {
    return errorInterno("admin espera GET", e);
  }
}
