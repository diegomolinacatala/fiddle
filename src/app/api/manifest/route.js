import { NextResponse } from "next/server";
import { getCliente, getNegocio } from "@/lib/store";
import { ICONOS_APP, NOMBRE_APP } from "@/lib/marcaFiddle";
import { jsonError, errorInterno } from "@/lib/http";
import { PALETA } from "@/app/home/paleta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manifest PWA. Dos apps instalables distintas:
//   ?b=<slug>     la CAJA de una tienda (el móvil del mostrador)
//   ?p=<serial>   la TARJETA de un cliente (su Android, abre directamente en ella)
// En la pantalla de inicio las dos son fiddle: su lacre y su nombre
// (lib/marcaFiddle.js). El fondo es la avena del icono, para que al abrirse se
// vea el lacre y no un cuadrado.

const app = { name: NOMBRE_APP, short_name: NOMBRE_APP, display: "standalone", orientation: "portrait", background_color: PALETA.avena, icons: ICONOS_APP };

// En la CDN una hora: cada página de la caja y de la tarjeta lo pide al cargar, y
// con `no-store` cada una era una función de Vercel. Solo lleva el nombre y el color
// de la tienda (nada del cliente: el serial ya va en la URL), y un color nuevo que
// tarde una hora en el icono instalado no se nota. El navegador, sin caché propia.
const respuesta = (manifest) =>
  NextResponse.json(manifest, {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  try {
    const serial = q.get("p");
    if (serial) {
      const cliente = await getCliente(serial);
      const negocio = cliente ? await getNegocio(cliente.negocio) : null;
      if (!negocio) return jsonError("tarjeta desconocida", 404);
      return respuesta({
        ...app,
        id: `/p/${serial}`,
        description: `Tu tarjeta de ${negocio.nombre}`,
        start_url: `/p/${serial}`,
        scope: `/p/${serial}`,
        theme_color: negocio.tema.accent,
      });
    }

    const slug = q.get("b");
    const n = await getNegocio(slug);
    if (!n) return jsonError("negocio desconocido", 404);
    return respuesta({
      ...app,
      id: `/${slug}/caja`,
      description: `Caja de ${n.nombre}: escanea la tarjeta del cliente y suma puntos.`,
      start_url: `/${slug}/caja`,
      scope: "/",
      theme_color: n.tema.accent,
    });
  } catch (e) {
    return errorInterno("manifest", e);
  }
}
