import { NextResponse } from "next/server";
import { saveNegocio } from "@/lib/store";
import { leerCambio, marcarHecho, conOculto, avanceDe } from "@/lib/primerosPasos";
import { jsonError, errorInterno, exigirTienda } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Los primeros pasos del dueño (lib/primerosPasos.js). Solo el manager.
//   POST ?b=<slug> { hecho: "qr" }    ese paso, hecho
//   POST ?b=<slug> { oculto: true }   el aviso de Tienda, fuera (false lo vuelve a poner)
// Devuelve { primerosPasos, avance }. Lo que cada paso cambia de la tienda (el tema,
// el horario, la promo) va por /api/negocio, como desde Tienda: aquí solo se apunta.
// Una tienda sin primeros pasos (las que ya trabajaban) no los gana por llamar aquí.

export async function POST(request) {
  const { slug, negocio, respuesta } = await exigirTienda(request, "manager");
  if (respuesta) return respuesta;
  try {
    const cambio = leerCambio(await request.json().catch(() => ({})));
    if (cambio.error) return jsonError(cambio.error, 400);
    if (!negocio.primerosPasos) return jsonError("Esta tienda no tiene primeros pasos", 409);
    const primerosPasos = "hecho" in cambio ? marcarHecho(negocio.primerosPasos, cambio.hecho) : conOculto(negocio.primerosPasos, cambio.oculto);
    const nuevo = await saveNegocio(slug, { primerosPasos });
    if (!nuevo) return jsonError("negocio desconocido", 404);
    return NextResponse.json({ primerosPasos: nuevo.primerosPasos, avance: avanceDe(nuevo) });
  } catch (e) {
    return errorInterno("primeros pasos", e);
  }
}
