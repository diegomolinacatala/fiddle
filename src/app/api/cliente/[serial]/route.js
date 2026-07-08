import { NextResponse } from "next/server";
import { getCliente, getPrograma, listEventos, saveCliente } from "@/lib/store";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { updatePass, buildPassBody } from "@/lib/walletwallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cliente/<serial> -> perfil completo para la vista del trabajador.
export async function GET(_req, { params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const programa = await getPrograma();
  const eventos = await listEventos(serial);
  const acciones = LISTA_ACCIONES.filter((a) => programa.acciones.includes(a.key));

  return NextResponse.json({ cliente, programa, eventos, acciones });
}

// PUT /api/cliente/<serial>  body: { nombre } -> personaliza el pase del cliente.
// Guarda el nombre y empuja el pase reconstruido (aparece en la cara del pase).
export async function PUT(request, { params }) {
  try {
    const { serial } = await params;
    const body = await request.json().catch(() => ({}));

    const cliente = await getCliente(serial);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // nombre "" o null lo borra; string lo fija (recortado).
    const nombre =
      typeof body.nombre === "string" && body.nombre.trim()
        ? body.nombre.trim().slice(0, 48)
        : null;

    const actualizado = { ...cliente, nombre };
    await saveCliente(actualizado);

    const prog = await getPrograma();
    await updatePass(serial, buildPassBody(actualizado, prog)); // push al Wallet

    return NextResponse.json({ ok: true, cliente: actualizado });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
