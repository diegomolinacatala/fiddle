import { NextResponse } from "next/server";
import { getCliente, getNegocio } from "@/lib/store";
import { rutaIcono } from "@/lib/rutasImagen";
import { jsonError, errorInterno } from "@/lib/http";
import { C } from "@/app/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manifest PWA. Dos apps instalables distintas:
//   ?b=<slug>     la CAJA de una tienda (el móvil del mostrador)
//   ?p=<serial>   la TARJETA de un cliente (su Android, abre directamente en ella)
// Los iconos salen de la marca de la tienda (/api/imagen/icono), así una tienda
// recién creada en /admin es instalable sin dibujar nada a mano.

const iconos = (negocio) => [
  { src: rutaIcono(negocio, 192), sizes: "192x192", type: "image/png", purpose: "any" },
  { src: rutaIcono(negocio, 512), sizes: "512x512", type: "image/png", purpose: "any" },
  { src: rutaIcono(negocio, 192, { maskable: true }), sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: rutaIcono(negocio, 512, { maskable: true }), sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const respuesta = (manifest) =>
  NextResponse.json(manifest, { headers: { "content-type": "application/manifest+json", "cache-control": "no-store" } });

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  try {
    const serial = q.get("p");
    if (serial) {
      const cliente = await getCliente(serial);
      const negocio = cliente ? await getNegocio(cliente.negocio) : null;
      if (!negocio) return jsonError("tarjeta desconocida", 404);
      return respuesta({
        id: `/p/${serial}`,
        name: negocio.nombre,
        short_name: negocio.nombre.slice(0, 12),
        description: `Tu tarjeta de ${negocio.nombre}`,
        start_url: `/p/${serial}`,
        scope: `/p/${serial}`,
        display: "standalone",
        orientation: "portrait",
        background_color: negocio.tema.cardBg || C.fondo,
        theme_color: negocio.tema.accent,
        icons: iconos(negocio),
      });
    }

    const slug = q.get("b");
    const n = await getNegocio(slug);
    if (!n) return jsonError("negocio desconocido", 404);
    return respuesta({
      id: `/${slug}/caja`,
      name: `${n.nombre} · Caja`,
      short_name: `${n.nombre.slice(0, 7)} caja`,
      description: `Caja de ${n.nombre}: escanea la tarjeta del cliente y suma sellos.`,
      start_url: `/${slug}/caja`,
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: C.fondo,
      theme_color: n.tema.accent,
      icons: iconos(n),
    });
  } catch (e) {
    return errorInterno("manifest", e);
  }
}
