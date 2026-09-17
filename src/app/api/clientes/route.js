import { NextResponse } from "next/server";
import { listClientes } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/clientes?b=<slug> -> clientes de ese negocio (o todos si no se pasa b)
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  return NextResponse.json(await listClientes(slug || undefined));
}
