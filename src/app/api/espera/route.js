import { NextResponse } from "next/server";
import { apuntarEnEspera } from "@/lib/listaDeEspera";
import { esSlug } from "@/lib/negocios";
import { usoExcedido, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/espera?b=<slug>  { email }
// Quien escanea el QR de una tienda llena deja su correo (lib/listaDeEspera.js).
// Público, con límite por conexión. Solo si la tienda está llena de verdad: si
// hay sitio responde 409 con `hayCupo`, y la página le ofrece sacarla ya.
export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  // Solo desde nuestra propia página: otra web no puede apuntar a nadie.
  if (request.headers.get("sec-fetch-site") === "cross-site") return jsonError("No permitido", 403);
  try {
    if (await usoExcedido("espera", ipDe(request))) return jsonError("Demasiados intentos. Prueba en unos minutos.", 429);
    const cuerpo = await request.json().catch(() => null);
    const r = await apuntarEnEspera(slug, cuerpo?.email);
    if (r.error) return NextResponse.json({ error: r.error, ...(r.hayCupo ? { hayCupo: true } : {}) }, { status: r.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("espera POST", e);
  }
}
