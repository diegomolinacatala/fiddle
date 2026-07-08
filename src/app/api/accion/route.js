import { NextResponse } from "next/server";
import { getCliente, saveCliente, getPrograma, addEvento } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";
import { updatePass, buildPassBody } from "@/lib/walletwallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El trabajador ejecuta una acción sobre un cliente.
// POST /api/accion  body: { serial, accion }
export async function POST(request) {
  try {
    const { serial, accion } = await request.json().catch(() => ({}));
    if (!serial || !accion) {
      return NextResponse.json({ error: "Falta serial o accion" }, { status: 400 });
    }

    const def = ACCIONES[accion];
    if (!def) return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });

    const prog = await getPrograma();
    if (!prog.acciones.includes(accion)) {
      return NextResponse.json({ error: "Esa acción no está activada por el manager" }, { status: 403 });
    }

    const cliente = await getCliente(serial);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // La lógica modular vive en el registro de acciones.
    const r = def.aplicar(cliente, prog);
    if (r.ok === false) return NextResponse.json({ ok: false, mensaje: r.mensaje, cliente });

    await saveCliente(r.cliente);
    if (r.evento) await addEvento(serial, accion, r.evento);
    await updatePass(serial, buildPassBody(r.cliente, prog)); // push al Wallet

    return NextResponse.json({ ok: true, mensaje: r.mensaje, cliente: r.cliente });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
