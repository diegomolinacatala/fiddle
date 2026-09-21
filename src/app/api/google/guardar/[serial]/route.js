import { NextResponse } from "next/server";
import { getCliente, getNegocio } from "@/lib/store";
import { hayGoogle, prepararGuardado } from "@/lib/googlewallet";
import { jsonError, errorInterno } from "@/lib/http";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/google/guardar/<serial> -> botón "Añadir a Google Wallet".
// Pasa por aquí en vez de llevar el enlace de Google ya hecho en la página: así
// el objeto se crea con el estado de ESTE momento (si la página llevaba un rato
// abierta, con los sellos de ahora) y el enlace es corto. Pública como la página
// del pase: quien tiene el serial es el dueño de la tarjeta.
export async function GET(request, { params }) {
  if (!hayGoogle()) return jsonError("Google Wallet no está configurado", 404);
  try {
    if (await usoExcedido("google", ipDe(request))) return jsonError("Demasiados intentos. Prueba en unos minutos.", 429);
    const { serial } = await params;
    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Tarjeta no encontrada", 404);
    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return jsonError("Tienda no encontrada", 404);
    return NextResponse.redirect(await prepararGuardado(cliente, negocio), 302);
  } catch (e) {
    return errorInterno("google guardar", e);
  }
}
