import { NextResponse } from "next/server";
import { getNegocio, saveNegocio } from "@/lib/store";
import { datosAvisos, repasarNegocio } from "@/lib/motorAvisos";
import { validarReglas, normalizarPausa } from "@/lib/automatizaciones";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Los avisos automáticos de una tienda. Solo su manager (lo exige también el middleware).
//   GET  ?b=<slug>                                  -> lo que pinta la pestaña Avisos
//   PUT  ?b=<slug>  { automatizaciones, pausaAvisos } -> guarda las reglas (no toca los pases)
//   POST ?b=<slug>  { regla }                        -> "Enviar ahora": esa regla, ya

async function tienda(request, slug) {
  if (!esSlug(slug)) return { respuesta: jsonError("Falta o no existe ?b=<negocio>", 400) };
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  return { respuesta };
}

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  const { respuesta } = await tienda(request, slug);
  if (respuesta) return respuesta;
  try {
    const datos = await datosAvisos(slug);
    return datos ? NextResponse.json(datos) : jsonError("Ese negocio no existe", 404);
  } catch (e) {
    return errorInterno("automatizaciones GET", e);
  }
}

export async function PUT(request) {
  const slug = new URL(request.url).searchParams.get("b");
  const { respuesta } = await tienda(request, slug);
  if (respuesta) return respuesta;
  try {
    const body = await request.json().catch(() => ({}));
    const r = validarReglas(body.automatizaciones);
    if (r.error) return jsonError(r.error, 400);
    const patch = { automatizaciones: r.reglas };
    if (body.pausaAvisos !== undefined) patch.pausaAvisos = normalizarPausa(body.pausaAvisos);
    // Cambiar una regla no cambia ningún pase: nada de avisar a los teléfonos aquí.
    if (!(await saveNegocio(slug, patch))) return jsonError("Ese negocio no existe", 404);
    return NextResponse.json(await datosAvisos(slug));
  } catch (e) {
    return errorInterno("automatizaciones PUT", e);
  }
}

export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  const { respuesta } = await tienda(request, slug);
  if (respuesta) return respuesta;
  try {
    const { regla } = await request.json().catch(() => ({}));
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("Ese negocio no existe", 404);
    if (!negocio.automatizaciones.some((r) => r.id === regla)) return jsonError("Ese aviso no existe. Guárdalo antes de enviarlo.", 404);
    const resultado = await repasarNegocio(negocio, { soloRegla: regla });
    return NextResponse.json({ envio: resultado.envios[0] ?? null, datos: await datosAvisos(slug) });
  } catch (e) {
    return errorInterno("automatizaciones POST", e);
  }
}
