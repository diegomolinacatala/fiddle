import { NextResponse } from "next/server";
import { getCliente, getNegocio, listEventos, saveCliente } from "@/lib/store";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { updatePass, buildPassBody } from "@/lib/walletwallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cliente/<serial> -> perfil completo para la vista del trabajador.
export async function GET(_req, { params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const negocio = await getNegocio(cliente.negocio);
  const eventos = await listEventos(serial);
  const acciones = LISTA_ACCIONES.filter((a) => negocio.acciones.includes(a.key));

  return NextResponse.json({ cliente, negocio, eventos, acciones });
}

// PUT /api/cliente/<serial>  body: { nombre } -> personaliza el pase del cliente.
export async function PUT(request, { params }) {
  try {
    const { serial } = await params;
    const body = await request.json().catch(() => ({}));

    const cliente = await getCliente(serial);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const nombre =
      typeof body.nombre === "string" && body.nombre.trim()
        ? body.nombre.trim().slice(0, 48)
        : null;

    const actualizado = { ...cliente, nombre };
    await saveCliente(actualizado);

    const negocio = await getNegocio(cliente.negocio);
    await updatePass(cliente.ww_serial, buildPassBody(actualizado, negocio));

    return NextResponse.json({ ok: true, cliente: actualizado });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
