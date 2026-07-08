import { NextResponse } from "next/server";
import { savePrograma, listClientes } from "@/lib/store";
import { updatePass, buildPassBody } from "@/lib/walletwallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lanza (o quita) una promo a TODAS las tarjetas a la vez.
// POST /api/promo  body: { "texto": "Hoy 2x1 en lattes" }   (texto vacío/null la quita)
export async function POST(request) {
  try {
    const { texto } = await request.json().catch(() => ({}));

    // La promo es a nivel de programa: se guarda y se propaga a todos los pases.
    const prog = await savePrograma({ promo: texto || null });
    const clientes = await listClientes();

    let enviadas = 0;
    const fallidas = [];
    for (const c of clientes) {
      try {
        await updatePass(c.serial, buildPassBody(c, prog));
        enviadas++;
      } catch (e) {
        fallidas.push({ serial: c.serial, error: String(e?.message || e) });
      }
    }

    return NextResponse.json({ promo: prog.promo, total: clientes.length, enviadas, fallidas });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
