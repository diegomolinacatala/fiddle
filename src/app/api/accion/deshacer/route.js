import { NextResponse } from "next/server";
import { getCliente, getNegocio, clientePublico } from "@/lib/store";
import { deshacerCambios, leerInstantanea, MINUTOS_DESHACER_CAMBIOS } from "@/lib/deshacer";
import { notificarCliente } from "@/lib/wallet";
import { plantillaDeCaja } from "@/lib/plantilla";
import { quienDeRequest } from "@/lib/quien";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// «Deshacer cambios» de la ficha de la caja (lib/deshacer.js): la tarjeta vuelve
// a como estaba al escanearla y lo hecho desde entonces sale del historial.
// POST /api/accion/deshacer  body: { serial, instantanea }
export async function POST(request) {
  try {
    const { serial, instantanea } = await request.json().catch(() => ({}));
    if (typeof serial !== "string" || typeof instantanea !== "string") return jsonError("Falta serial o instantanea", 400);

    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Cliente no encontrado", 404);
    if (cliente.fusionado_en) return jsonError("Esta tarjeta se pasó a una nueva. Vuelve a escanear al cliente.", 409);
    if (cliente.borrado_en) return jsonError("Esta tarjeta se borró a petición del cliente.", 410);

    const { sesion, respuesta } = await exigirNegocio(request, cliente.negocio, "caja");
    if (respuesta) return respuesta;
    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return jsonError("Negocio no encontrado", 404);

    const antes = await leerInstantanea(instantanea, serial);
    if (!antes) {
      return NextResponse.json(
        { ok: false, caducada: true, mensaje: `Ya no se puede deshacer: la ficha lleva abierta más de ${MINUTOS_DESHACER_CAMBIOS} minutos. Corrígelo con «−».`, cliente: clientePublico(cliente) },
        { status: 410 },
      );
    }

    // Quién lo deshizo, si se sabe; no se pide el PIN para dejar algo como estaba.
    const quien = sesion.rol === "caja" ? await quienDeRequest(request, negocio.slug, plantillaDeCaja(negocio)) : null;
    const r = await deshacerCambios(cliente, antes, { actor: sesion.rol, empleado: quien?.id ?? null });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, mensaje: "Otra caja acaba de tocar a este cliente. Míralo y vuelve a intentarlo.", cliente: clientePublico(await getCliente(serial)) },
        { status: 409 },
      );
    }
    // La tarjeta de su teléfono vuelve con ella, sin `antes`: deshacer un canje parecería una
    // cartilla recién llena, y Android sonaría con «tu premio te espera».
    const aviso = r.cambiado ? await notificarCliente(r.cliente, negocio) : null;
    return NextResponse.json({ ok: true, cliente: clientePublico(r.cliente), quitados: r.quitados, aviso });
  } catch (e) {
    return errorInterno("deshacer", e);
  }
}
