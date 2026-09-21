import { NextResponse } from "next/server";
import {
  getNegocio, listClientes, serialesRegistrados,
  guardarMensajes, crearCampana, addEventos,
} from "@/lib/store";
import { perfilDe, GRUPOS, esGrupo } from "@/lib/crm";
import { avisarSeriales } from "@/lib/wallet";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXTO = 120;   // en el pase cabe una línea corta, no un folleto
const MAX_DESTINO = 400; // tope por envío: más no cabe en el tiempo de una función serverless

/**
 * Manda un mensaje a un GRUPO de clientes.
 * POST /api/crm/campana  body: { b, grupo, texto }   (texto vacío = quitarlo)
 *
 * El grupo se vuelve a calcular AQUÍ. Lo que enseña la pantalla es una foto de
 * hace unos segundos y, sobre todo, no se manda a una lista que venga de fuera:
 * el navegador dice "los que se están enfriando", no a quién.
 */
export async function POST(request) {
  try {
    const { b, grupo, texto } = await request.json().catch(() => ({}));
    if (!esSlug(b)) return jsonError("Falta o no existe b (negocio)", 400);
    const { respuesta } = await exigirNegocio(request, b, "manager");
    if (respuesta) return respuesta;
    if (!esGrupo(grupo)) return jsonError(`No existe el grupo "${grupo}"`, 400);

    const negocio = await getNegocio(b);
    if (!negocio) return jsonError("Ese negocio no existe", 404);

    const mensaje = typeof texto === "string" && texto.trim() ? texto.trim().slice(0, MAX_TEXTO) : null;

    const [clientes, registrados] = await Promise.all([listClientes(b), serialesRegistrados(b)]);
    const delGrupo = clientes.filter((c) =>
      GRUPOS[grupo].incluye(perfilDe({ ...c, instalado: c.instalado || (registrados.has(c.serial) ? c.creado : null) }, negocio)),
    );

    // Sin pase en un teléfono no hay a dónde mandar nada. No es un fallo: es el
    // límite de avisar por Wallet, y la pantalla ya lo cuenta antes de enviar.
    const destino = delGrupo.filter((c) => registrados.has(c.serial)).slice(0, MAX_DESTINO);
    if (!destino.length) {
      return jsonError(`Nadie de "${GRUPOS[grupo].label}" tiene el pase instalado: no hay a quién avisar.`, 409);
    }

    const seriales = destino.map((c) => c.serial);
    await guardarMensajes(seriales, mensaje);
    const aviso = await avisarSeriales(seriales);

    // Quitar el mensaje no es una campaña: es recoger la anterior.
    if (!mensaje) {
      return NextResponse.json({ ok: true, quitado: seriales.length, ...aviso });
    }

    const campana = await crearCampana({ negocio: b, grupo, texto: mensaje, seriales, avisados: aviso.avisados });
    await addEventos(seriales.map((serial) => ({
      serial, tipo: "campana", mensaje: `Campaña «${mensaje}»`, negocio: b, actor: "manager",
    })));

    return NextResponse.json({
      ok: true,
      campana: { id: campana.id, grupo, texto: mensaje, creado: campana.creado },
      enGrupo: delGrupo.length,
      destinatarios: seriales.length,
      recortado: delGrupo.filter((c) => registrados.has(c.serial)).length > MAX_DESTINO,
      ...aviso,
    });
  } catch (e) {
    return errorInterno("crm campaña", e);
  }
}
