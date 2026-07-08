import { NextResponse } from "next/server";
import { listClientes } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/clientes -> lista de clientes (para el manager y el trabajador)
export async function GET() {
  return NextResponse.json(await listClientes());
}
