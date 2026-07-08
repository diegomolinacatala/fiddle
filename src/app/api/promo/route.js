import { NextResponse } from "next/server";
import { saveNegocio, listClientes } from "@/lib/store";
import { updatePass, buildPassBody } from "@/lib/walletwallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lanza (o quita) una promo a TODOS los pases de un negocio.
// POST /api/promo  body: { b: "<slug>", texto: "..." }   (texto vacío la quita)
export async function POST(request) {
  try {
    const { b, texto } = await request.json().catch(() => ({}));
    if (!b) return NextResponse.json({ error: "Falta b (negocio)" }, { status: 400 });

    const negocio = await saveNegocio(b, { promo: texto || null });
    if (!negocio) return NextResponse.json({ error: "negocio desconocido" }, { status: 404 });

    const clientes = await listClientes(b);
    let enviadas = 0;
    const fallidas = [];
    for (const c of clientes) {
      try {
        await updatePass(c.ww_serial, buildPassBody({ serial: c.serial, sellos: c.sellos, premios: c.premios }, negocio));
        enviadas++;
      } catch (e) {
        fallidas.push({ serial: c.serial, error: String(e?.message || e) });
      }
    }
    return NextResponse.json({ promo: negocio.promo, total: clientes.length, enviadas, fallidas });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
