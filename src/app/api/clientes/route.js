import { NextResponse } from "next/server";
import { listClientes, getClientePorCodigo, clientePublico } from "@/lib/store";
import { esNegocio } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLIENTES = 200; // las pantallas muestran los más recientes

// GET /api/clientes?b=<slug>            -> últimos clientes de ese negocio.
// GET /api/clientes?b=<slug>&codigo=K7M  -> UN cliente por su código corto.
//
// El código se busca solo dentro de `b`, y la sesión ya tiene que ser de ese
// negocio: el "K7M" de otra tienda no se puede resolver desde aquí.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("b");
  const codigo = searchParams.get("codigo");
  if (!esNegocio(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;
  try {
    if (codigo) {
      const cliente = await getClientePorCodigo(slug, codigo);
      if (!cliente) return jsonError("Ningún pase de esta tienda con ese código", 404);
      return NextResponse.json(clientePublico(cliente));
    }
    return NextResponse.json((await listClientes(slug, { limite: MAX_CLIENTES })).map(clientePublico));
  } catch (e) {
    return errorInterno("clientes", e);
  }
}
