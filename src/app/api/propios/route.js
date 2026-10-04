import { NextResponse } from "next/server";
import { getNegocio, saveNegocio, guardarImagen, leerImagen } from "@/lib/store";
import { procesarIcono, procesarFoto } from "@/lib/propiosImagen";
import { conPropio, normalizarPropios, MAX_PROPIOS } from "@/lib/propios";
import { propioEnUso } from "@/lib/propiosServidor";
import { logoImagenDe } from "@/lib/logo";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";
import { limiteEnMemoria } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// /api/propios — lo que la tienda ha subido para su tarjeta (lib/propios.js)
//   GET    ?b=<slug>                                  su lista, con los iconos dentro
//   POST   ?b=<slug>&tipo=iconos|fondos[&nombre=]     sube uno (el cuerpo, tal cual)
//   DELETE ?b=<slug>&tipo=logos|iconos|fondos&id=     lo quita de la lista
// Solo su manager. Subir NO cambia la tarjeta: lo añade a «Tuyos» y es el
// editor quien lo pone y lo guarda con "Guardar". Los logos se suben por
// /api/logo, que también los apunta aquí.
// ============================================================================

const MAX_BYTES = 4 * 1024 * 1024; // el navegador ya la reduce; Vercel corta en 4,5 MB

async function tienda(request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get("b");
  if (!esSlug(slug)) return { respuesta: jsonError("negocio desconocido", 404) };
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return { respuesta };
  const negocio = await getNegocio(slug);
  return negocio ? { slug, q, negocio } : { respuesta: jsonError("negocio desconocido", 404) };
}

/** La lista para el editor: los iconos con su imagen (pesan poco) y el logo puesto aunque sea de antes. */
async function lista(negocio) {
  const p = normalizarPropios(negocio.propios);
  const puesto = logoImagenDe(negocio.tema);
  const logos = puesto && !p.logos.some((x) => x.id === puesto.id) ? [{ id: puesto.id, opaco: puesto.opaco }, ...p.logos] : p.logos;
  const iconos = await Promise.all(p.iconos.map(async (x) => {
    const png = await leerImagen(negocio.slug, x.id, "png").catch(() => null);
    return png ? { ...x, uri: `data:image/png;base64,${png.toString("base64")}` } : null;
  }));
  return { logos, iconos: iconos.filter(Boolean), fondos: p.fondos };
}

export async function GET(request) {
  const { negocio, respuesta } = await tienda(request);
  if (respuesta) return respuesta;
  try {
    return NextResponse.json(await lista(negocio));
  } catch (e) {
    return errorInterno("propios GET", e);
  }
}

export async function POST(request) {
  const { slug, q, negocio, respuesta } = await tienda(request);
  if (respuesta) return respuesta;
  const tipo = q.get("tipo");
  if (tipo !== "iconos" && tipo !== "fondos") return jsonError("Tipo desconocido", 400);
  // Procesar imágenes cuesta CPU: unas pocas por minuto sobran para elegir.
  if (limiteEnMemoria(`propios:${slug}`, { max: 20, ventanaMs: 10 * 60 * 1000 })) return jsonError("Demasiadas imágenes seguidas. Espera un poco.", 429);
  try {
    if (!/^image\//i.test(request.headers.get("content-type") || "")) return jsonError("Sube una imagen (PNG, JPG o WebP)", 415);
    const datos = Buffer.from(await request.arrayBuffer());
    if (!datos.length) return jsonError("La imagen ha llegado vacía", 400);
    if (datos.length > MAX_BYTES) return jsonError("La imagen pesa demasiado (máximo 4 MB)", 413);
    if (negocio.propios[tipo].length >= MAX_PROPIOS[tipo]) return jsonError(`Como mucho ${MAX_PROPIOS[tipo]}: quita alguno antes`, 409);

    const r = tipo === "iconos" ? await procesarIcono(datos) : await procesarFoto(datos);
    if (r.error) return jsonError(r.error, 400);
    if (tipo === "iconos") await guardarImagen(slug, r.id, r.png, "png");
    else await guardarImagen(slug, r.id, r.jpg, "jpg");
    const nombre = q.get("nombre")?.replace(/\.[a-z0-9]+$/i, "").slice(0, 30) || undefined;
    const nuevo = await saveNegocio(slug, { propios: conPropio(negocio.propios, tipo, { id: r.id, nombre }) });
    return NextResponse.json({ id: r.id, ...(await lista(nuevo)) }, { status: 201 });
  } catch (e) {
    return errorInterno("propios POST", e);
  }
}

export async function DELETE(request) {
  const { slug, q, negocio, respuesta } = await tienda(request);
  if (respuesta) return respuesta;
  const tipo = q.get("tipo");
  const id = q.get("id") || "";
  if (!["logos", "iconos", "fondos"].includes(tipo)) return jsonError("Tipo desconocido", 400);
  try {
    // Lo que lleva la tarjeta guardada no se quita: primero se cambia y se guarda.
    if (propioEnUso(negocio, tipo, id)) return jsonError("Lo lleva tu tarjeta ahora: cámbialo y guarda antes de quitarlo", 409);
    const p = normalizarPropios(negocio.propios);
    const nuevo = await saveNegocio(slug, { propios: { ...p, [tipo]: p[tipo].filter((x) => x.id !== id) } });
    return NextResponse.json(await lista(nuevo));
  } catch (e) {
    return errorInterno("propios DELETE", e);
  }
}
