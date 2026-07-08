import { NextResponse } from "next/server";
import { getCliente, getPrograma, listEventos } from "@/lib/store";
import { LISTA_ACCIONES } from "@/lib/acciones";

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
