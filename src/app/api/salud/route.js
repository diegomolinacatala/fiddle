import { NextResponse } from "next/server";
import { proveedorWallet } from "@/lib/wallet";
import { diagnosticoSupabase } from "@/lib/diagnostico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/salud -> ¿está la app bien conectada? Público a propósito: si la base
// de datos falla tampoco se puede entrar al manager, y hace falta poder mirarlo.
// No devuelve secretos: solo si cada pieza responde y qué revisar si no.
export async function GET() {
  const baseDatos = await diagnosticoSupabase();
  return NextResponse.json(
    { ok: baseDatos.ok, wallet: proveedorWallet(), baseDatos },
    { status: baseDatos.ok ? 200 : 503 },
  );
}
