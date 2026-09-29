import { NextResponse } from "next/server";
import { getCliente, getNegocio, listEventos, guardarNombre, clientePublico } from "@/lib/store";
import { accionesDe } from "@/lib/acciones";
import { notificarCliente } from "@/lib/wallet";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { nombreDeCliente } from "@/lib/validacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cliente/<serial> -> perfil completo para la caja.
export async function GET(request, { params }) {
  try {
    const { serial } = await params;
    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Cliente no encontrado", 404);
    const { respuesta } = await exigirNegocio(request, cliente.negocio, "caja");
    if (respuesta) return respuesta;

    const negocio = await getNegocio(cliente.negocio);
    const eventos = await listEventos(serial);
    const acciones = accionesDe(negocio);
    return NextResponse.json({ cliente: clientePublico(cliente), negocio, eventos, acciones });
  } catch (e) {
    return errorInterno("cliente GET", e);
  }
}

// PUT /api/cliente/<serial>  body: { nombre } -> personaliza el pase (aparece en él).
export async function PUT(request, { params }) {
  try {
    const { serial } = await params;
    const body = await request.json().catch(() => ({}));

    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Cliente no encontrado", 404);
    const { respuesta } = await exigirNegocio(request, cliente.negocio, "caja");
    if (respuesta) return respuesta;

    // "" o null lo borra; un texto lo fija (limpio y recortado).
    const nombre = nombreDeCliente(body.nombre);
    const actualizado = { ...cliente, nombre };
    await guardarNombre(serial, nombre); // solo el nombre: no pisa sellos de otra caja

    const negocio = await getNegocio(cliente.negocio);
    const aviso = await notificarCliente(actualizado, negocio);
    return NextResponse.json({ ok: true, cliente: clientePublico(actualizado), aviso });
  } catch (e) {
    return errorInterno("cliente PUT", e);
  }
}
