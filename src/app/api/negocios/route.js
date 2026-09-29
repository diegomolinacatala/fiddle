import { NextResponse } from "next/server";
import { listNegocios } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/negocios -> qué tiendas hay: identificador y nombre, nada más.
// Es público y ninguna pantalla lo pinta: la ficha entera llevaba el brief y las
// notas del admin, el horario y los textos de los avisos, que no son de nadie de fuera.
export async function GET() {
  return NextResponse.json((await listNegocios()).map(({ slug, nombre }) => ({ slug, nombre })));
}
