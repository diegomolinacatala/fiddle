import { NextResponse } from "next/server";
import { listInteresados, borrarInteresado } from "@/lib/store";
import { auditar } from "@/lib/auditoria";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quien dejó su contacto en «Diseña tu tarjeta» (/admin → Interesados).
//   GET                -> [{ id, email, telefono, eleccion, creado }]  el último primero; uno de los dos puede ser null
//   DELETE ?id=<id>    lo borra (quien lo pide, o quien ya no hace falta)

export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    return NextResponse.json(await listInteresados());
  } catch (e) {
    return errorInterno("admin interesados GET", e);
  }
}

export async function DELETE(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("Falta el id", 400);
    await borrarInteresado(id);
    await auditar(sesion, "plataforma", "borrar_interesado");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("admin interesados DELETE", e);
  }
}
