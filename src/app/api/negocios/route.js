import { NextResponse } from "next/server";
import { listNegocios } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/negocios -> todos los negocios. Público: ninguna pantalla lo pinta
// (la raíz lleva al login), pero es la forma de listar tiendas desde fuera.
export async function GET() {
  return NextResponse.json(await listNegocios());
}
