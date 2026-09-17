import { NextResponse } from "next/server";
import { getCliente, saveCliente, getNegocio, addEvento } from "@/lib/store";
import { ACCIONES } from "@/lib/acciones";
import { updatePass, buildPassBody } from "@/lib/walletwallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El trabajador ejecuta una acción sobre un cliente. El negocio se deduce del cliente.
// POST /api/accion  body: { serial, accion }
export async function POST(request) {
  try {
    const { serial, accion } = await request.json().catch(() => ({}));
    if (!serial || !accion) return NextResponse.json({ error: "Falta serial o accion" }, { status: 400 });

    const def = ACCIONES[accion];
    if (!def) return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });

    const cliente = await getCliente(serial);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    if (!negocio.acciones.includes(accion)) {
      return NextResponse.json({ error: "Esa acción no está activada por el manager" }, { status: 403 });
    }

    const r = def.aplicar(cliente, negocio);
    if (r.ok === false) return NextResponse.json({ ok: false, mensaje: r.mensaje, cliente });

    await saveCliente(r.cliente);
    if (r.evento) await addEvento(serial, accion, r.evento);
    // Push al Wallet usando el serial de WalletWallet.
    await updatePass(cliente.ww_serial, buildPassBody(r.cliente, negocio));

    return NextResponse.json({ ok: true, mensaje: r.mensaje, cliente: r.cliente });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
