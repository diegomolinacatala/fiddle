import { NextResponse } from "next/server";
import { listNegocios } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/negocios -> todos los negocios (para el directorio de la home)
export async function GET() {
  return NextResponse.json(await listNegocios());
}
