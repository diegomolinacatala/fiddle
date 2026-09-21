import { NextResponse } from "next/server";
import { getCliente, getNegocio, listEventos, guardarNota, clientePublico } from "@/lib/store";
import { perfilDe } from "@/lib/crm";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORIAL = 100; // la ficha enseña la vida entera del cliente, no las últimas ocho

// GET /api/crm/cliente/<serial> -> ficha completa: perfil calculado + historial.
export async function GET(request, { params }) {
  try {
    const { serial } = await params;
    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Cliente no encontrado", 404);
    const { respuesta } = await exigirNegocio(request, cliente.negocio, "manager");
    if (respuesta) return respuesta;

    const negocio = await getNegocio(cliente.negocio);
    const eventos = await listEventos(serial, HISTORIAL);
    return NextResponse.json({
      cliente: clientePublico(cliente),
      perfil: perfilDe(cliente, negocio),
      eventos,
    });
  } catch (e) {
    return errorInterno("crm cliente", e);
  }
}

// PUT /api/crm/cliente/<serial>  body: { nota } -> lo que la tienda apunta a mano.
// No sale en el pase: es para quien atiende ("sin lactosa", "el del perro").
export async function PUT(request, { params }) {
  try {
    const { serial } = await params;
    const { nota } = await request.json().catch(() => ({}));
    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Cliente no encontrado", 404);
    const { respuesta } = await exigirNegocio(request, cliente.negocio, "manager");
    if (respuesta) return respuesta;

    const limpia = typeof nota === "string" && nota.trim() ? nota.trim().slice(0, 300) : null;
    await guardarNota(serial, limpia);
    return NextResponse.json({ ok: true, nota: limpia });
  } catch (e) {
    return errorInterno("crm nota", e);
  }
}
