import { NextResponse } from "next/server";
import { getCliente, getNegocio, listEventos, guardarNota, clientePublico } from "@/lib/store";
import { perfilDe } from "@/lib/crm";
import { saldoCorto } from "@/lib/cartillas";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { cambiarPromos, borrarCliente } from "@/lib/derechos";
import { normalizarCodigo } from "@/lib/codigo";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORIAL = 100; // la ficha enseña la vida entera del cliente, no las últimas ocho

// GET /api/crm/cliente/<serial> -> ficha completa: perfil calculado + historial.
export async function GET(request, { params }) {
  try {
    const { serial } = await params;
    const cliente = await getCliente(serial);
    if (!cliente || cliente.borrado_en) return jsonError("Cliente no encontrado", 404);
    const { respuesta } = await exigirNegocio(request, cliente.negocio, "manager");
    if (respuesta) return respuesta;

    const negocio = await getNegocio(cliente.negocio);
    const eventos = await listEventos(serial, HISTORIAL);
    return NextResponse.json({
      cliente: clientePublico(cliente),
      perfil: perfilDe(cliente, negocio),
      saldo: negocio ? saldoCorto(cliente, negocio) : String(cliente.sellos),
      eventos,
    });
  } catch (e) {
    return errorInterno("crm cliente", e);
  }
}

// PUT /api/crm/cliente/<serial>  body: { nota } y/o { promos: true|false }
//   nota: lo que la tienda apunta a mano. No sale en el pase: es para quien
//   atiende ("el del perro"). Nada de salud ni alergias: el cliente puede leerla.
//   promos: el cliente le dijo en el mostrador que no quiere promos (o que sí).
export async function PUT(request, { params }) {
  try {
    const { serial } = await params;
    const cuerpo = await request.json().catch(() => ({}));
    const cliente = await getCliente(serial);
    if (!cliente || cliente.borrado_en) return jsonError("Cliente no encontrado", 404);
    const { sesion, respuesta } = await exigirNegocio(request, cliente.negocio, "manager");
    if (respuesta) return respuesta;

    const salida = { ok: true };
    if ("nota" in cuerpo) {
      const { nota } = cuerpo;
      const limpia = typeof nota === "string" && nota.trim() ? nota.trim().slice(0, 300) : null;
      await guardarNota(serial, limpia);
      salida.nota = limpia;
    }
    if (typeof cuerpo.promos === "boolean") {
      const negocio = await getNegocio(cliente.negocio);
      const nuevo = await cambiarPromos(cliente, negocio, cuerpo.promos, sesion.rol);
      if (!nuevo) return jsonError("Cliente no encontrado", 404);
      salida.promos = !nuevo.promos_no;
    }
    return NextResponse.json(salida);
  } catch (e) {
    return errorInterno("crm cliente PUT", e);
  }
}

// DELETE /api/crm/cliente/<serial>  body: { codigo } -> borrar a un cliente que lo
// pide (art. 17). Se confirma con su código de 3 caracteres: es lo que lleva el
// cliente en la tarjeta y lo que dice en voz alta. Al momento queda vacía y
// anulada; la fila cae en la pasada diaria (lib/derechos.js).
export async function DELETE(request, { params }) {
  try {
    const { serial } = await params;
    const { codigo } = await request.json().catch(() => ({}));
    const cliente = await getCliente(serial);
    if (!cliente || cliente.borrado_en) return jsonError("Cliente no encontrado", 404);
    const { sesion, respuesta } = await exigirNegocio(request, cliente.negocio, "manager");
    if (respuesta) return respuesta;
    if (normalizarCodigo(codigo) !== cliente.codigo) return jsonError("El código no coincide: no se ha borrado nada", 400);

    const negocio = await getNegocio(cliente.negocio);
    await borrarCliente(cliente, negocio, { motivo: sesion.rol, rol: sesion.rol });
    await auditar(sesion, cliente.negocio, "borrar_cliente", cliente.codigo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("crm cliente DELETE", e);
  }
}
