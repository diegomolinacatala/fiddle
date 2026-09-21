import { NextResponse } from "next/server";
import { getCliente, getNegocio } from "@/lib/store";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { jsonError, errorInterno } from "@/lib/http";
import { limiteEnMemoria, ipDe } from "@/lib/limitador";

// La tarjeta abierta pregunta cada 3 s: 20 por minuto. 60 deja sitio a tres
// tarjetas abiertas en el mismo wifi de la tienda; más ya es un script.
const LIMITE = { max: 60, ventanaMs: 60 * 1000 };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tarjeta/<serial> -> el estado de la tarjeta, para que la página del
// pase se ponga al día sola mientras el cliente la tiene abierta en caja (en
// Android no hay Wallet que la refresque). Pública como /p/<serial> y con los
// mismos campos: nada interno de la tienda.
export async function GET(request, { params }) {
  try {
    if (limiteEnMemoria(`tarjeta:${ipDe(request) || "?"}`, LIMITE)) return jsonError("Demasiadas consultas", 429);
    const { serial } = await params;
    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Tarjeta no encontrada", 404);
    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return jsonError("Tienda no encontrada", 404);
    return NextResponse.json(
      { cliente: clienteDeTarjeta(cliente), negocio: negocioDeTarjeta(negocio) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorInterno("tarjeta", e);
  }
}
