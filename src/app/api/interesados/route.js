import { NextResponse } from "next/server";
import { addInteresado } from "@/lib/store";
import { leerContacto } from "@/lib/interesados";
import { limpiar } from "@/app/home/tarjeta/opciones";
import { usoExcedido, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El último paso de «Diseña tu tarjeta» (público: quien llega aún no es cliente).
//   POST { contacto, eleccion }   email o teléfono, sin verificar, y la tarjeta que diseñó
// De lo elegido solo se guarda lo que está en las listas (`limpiar`).

export async function POST(request) {
  try {
    if (await usoExcedido("interesado", ipDe(request))) return jsonError("Demasiados intentos. Espera unos minutos.", 429);
    const cuerpo = await request.json().catch(() => null);
    const contacto = leerContacto(cuerpo?.contacto);
    if (!contacto) return jsonError("Escribe un email o un teléfono", 400);
    await addInteresado({ contacto: contacto.valor, tipo: contacto.tipo, eleccion: limpiar(cuerpo?.eleccion) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("interesados POST", e);
  }
}
