import { NextResponse } from "next/server";
import { listClientes, clientePublico } from "@/lib/store";
import { esNegocio } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLIENTES = 200; // las pantallas muestran los más recientes

// GET /api/clientes?b=<slug> -> últimos clientes de ese negocio (su caja o su manager).
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esNegocio(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;
  try {
    return NextResponse.json((await listClientes(slug, { limite: MAX_CLIENTES })).map(clientePublico));
  } catch (e) {
    return errorInterno("clientes", e);
  }
}
