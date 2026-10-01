import sharp from "sharp";
import { NextResponse } from "next/server";
import { esSlug } from "@/lib/negocios";
import { guardarLogo, leerLogo } from "@/lib/store";
import { procesarLogo } from "@/lib/logoImagen";
import { TAMS_LOGO, tamLogo } from "@/lib/logo";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { limiteEnMemoria } from "@/lib/limitador";

export const runtime = "nodejs";

// ============================================================================
// /api/logo — el logo propio de una tienda (ver lib/logo.js)
//   POST ?b=<slug>                 el manager sube una imagen (el cuerpo, tal cual)
//   GET  ?b=<slug>&v=<id>&t=<lado> la imagen, cuadrada, a uno de TAMS_LOGO
//
// Subir NO cambia la tarjeta: devuelve el logo preparado y es el editor quien lo
// guarda en el tema con "Guardar" (así "Cancelar" de verdad no cambia nada).
// Servir es público (la tarjeta web y el icono de la app lo piden sin sesión) y
// la URL lleva la huella del contenido: no cambia nunca, se cachea un año.
// ============================================================================

const MAX_BYTES = 4 * 1024 * 1024; // el navegador ya la reduce; Vercel corta en 4,5 MB

export async function POST(request) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return jsonError("negocio desconocido", 404);
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;
  // Procesar imágenes cuesta CPU: unas pocas por minuto sobran para elegir un logo.
  if (limiteEnMemoria(`logo:${slug}`, { max: 20, ventanaMs: 10 * 60 * 1000 })) return jsonError("Demasiadas imágenes seguidas. Espera un poco.", 429);

  try {
    const tipo = request.headers.get("content-type") || "";
    if (!/^image\//i.test(tipo)) return jsonError("Sube una imagen (PNG, JPG o WebP)", 415);
    const datos = Buffer.from(await request.arrayBuffer());
    if (!datos.length) return jsonError("La imagen ha llegado vacía", 400);
    if (datos.length > MAX_BYTES) return jsonError("La imagen pesa demasiado (máximo 4 MB)", 413);

    const r = await procesarLogo(datos);
    if (r.error) return jsonError(r.error, 400);
    await guardarLogo(slug, r.id, r.png);
    return NextResponse.json({ logoImagen: { id: r.id, b: slug, opaco: r.opaco } }, { status: 201 });
  } catch (e) {
    return errorInterno("logo POST", e);
  }
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get("b");
  const id = q.get("v") || "";
  if (!esSlug(slug) || !/^[0-9a-f]{16,64}$/.test(id)) return jsonError("Logo desconocido", 404);
  const t = Number(q.get("t")) || 256;
  if (!TAMS_LOGO.includes(t)) {
    const canonica = new URL(request.url);
    canonica.searchParams.set("t", String(tamLogo(t)));
    return Response.redirect(canonica.toString(), 308);
  }
  try {
    const original = await leerLogo(slug, id);
    if (!original) return jsonError("Logo desconocido", 404);
    const png = t >= 1024 ? original : await sharp(original).resize(t, t).png().toBuffer();
    return new Response(png, {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" },
    });
  } catch (e) {
    return errorInterno("logo GET", e);
  }
}
