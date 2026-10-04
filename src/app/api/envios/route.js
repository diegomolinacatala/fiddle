import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { apuntarPendiente, quitarPendiente } from "@/lib/campanas";
import { esDestino, horaValida, textoDeEnvio, enviosVisibles, MAX_PENDIENTES } from "@/lib/envios";
import { relojVivo } from "@/lib/relojAvisos";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// ENVIAR A UNA HORA (Avisos → Enviar → «Enviar a las…»). Solo el manager.
//   POST   { b, destino, texto, cuando }  lo deja esperando; lo manda el reloj
//   DELETE { b, id }                      lo cancela
// Las dos devuelven la lista que queda. A quién se calcula AL MANDARLO
// (lib/campanas.js), no ahora: aquí solo se guarda la clave del destino.
// ============================================================================

async function tienda(request, b) {
  if (!esSlug(b)) return { respuesta: jsonError("Falta o no existe b (negocio)", 400) };
  const { sesion, respuesta } = await exigirNegocio(request, b, "manager");
  if (respuesta) return { respuesta };
  const negocio = await getNegocio(b);
  return negocio ? { sesion, negocio } : { respuesta: jsonError("Ese negocio no existe", 404) };
}

export async function POST(request) {
  try {
    const { b, destino, texto, cuando } = await request.json().catch(() => ({}));
    const { sesion, negocio, respuesta } = await tienda(request, b);
    if (respuesta) return respuesta;

    if (!esDestino(destino)) return jsonError(`No existe el grupo "${destino}"`, 400);
    const limpio = textoDeEnvio(destino, texto);
    if (!limpio) return jsonError("Escribe el mensaje antes de programarlo", 400);
    if (!negocio.horario) return jsonError("Para enviar a una hora hace falta el horario de la tienda", 409);
    const ms = horaValida(negocio.horario, cuando);
    if (!ms) return jsonError("Esa hora ya no vale: elige otra de hoy (hasta el cierre) o de mañana por la mañana", 400);
    // Sin reloj nadie lo mandaría: mejor decirlo ahora que callarse a las 17:00.
    if (!(await relojVivo())) return jsonError("El reloj de los avisos no está en marcha: lo programado no saldría. Envíalo ahora.", 409);
    if (enviosVisibles(negocio.enviosProgramados).length >= MAX_PENDIENTES) {
      return jsonError(`Como mucho ${MAX_PENDIENTES} envíos esperando. Cancela alguno antes.`, 409);
    }

    await apuntarPendiente(b, { cuando: new Date(ms).toISOString(), destino, texto: limpio });
    await auditar(sesion, b, "programar", destino);
    return NextResponse.json({ pendientes: enviosVisibles((await getNegocio(b)).enviosProgramados) }, { status: 201 });
  } catch (e) {
    return errorInterno("envios POST", e);
  }
}

export async function DELETE(request) {
  try {
    const { b, id } = await request.json().catch(() => ({}));
    const { respuesta } = await tienda(request, b);
    if (respuesta) return respuesta;
    if (typeof id !== "string" || !(await quitarPendiente(b, id))) return jsonError("Ese envío ya no está: puede que ya haya salido", 404);
    return NextResponse.json({ pendientes: enviosVisibles((await getNegocio(b)).enviosProgramados) });
  } catch (e) {
    return errorInterno("envios DELETE", e);
  }
}
