import { NextResponse } from "next/server";
import { getCliente, getNegocio } from "@/lib/store";
import { datosDeCliente, ficheroDeDatos } from "@/lib/derechos";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/crm/cliente/<serial>/datos -> "Descargar sus datos" de la ficha: un
// JSON con todo lo que guardamos de ese cliente (arts. 15 y 20). Solo el
// manager, y queda apuntado: es sacar datos de una persona de la plataforma.
export async function GET(request, { params }) {
  try {
    const { serial } = await params;
    const cliente = await getCliente(serial);
    if (!cliente || cliente.borrado_en) return jsonError("Cliente no encontrado", 404);
    const { sesion, respuesta } = await exigirNegocio(request, cliente.negocio, "manager");
    if (respuesta) return respuesta;

    const datos = await datosDeCliente(cliente, await getNegocio(cliente.negocio));
    await auditar(sesion, cliente.negocio, "exportar_cliente", cliente.codigo);
    return new NextResponse(JSON.stringify(datos, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${ficheroDeDatos(cliente)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorInterno("crm cliente datos", e);
  }
}
