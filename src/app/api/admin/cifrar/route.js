import { NextResponse } from "next/server";
import { cifrarPendientes } from "@/lib/store";
import { estadoClaveCifrado } from "@/lib/cifrado";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/cifrar -> cifra los nombres y notas que se guardaron antes de
// tener CIFRADO_CLAVE. Una vez basta; repetirlo no hace nada. Solo el admin: el
// middleware ya lo ha comprobado (acceso.js -> tipo "admin").
export async function POST() {
  if (!estadoClaveCifrado().ok) return jsonError("Falta una CIFRADO_CLAVE válida en Vercel", 409);
  try {
    return NextResponse.json({ cifrados: await cifrarPendientes() });
  } catch (e) {
    return errorInterno("cifrar datos", e);
  }
}
