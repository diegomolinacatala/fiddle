import { NextResponse } from "next/server";
import { getNegocio } from "@/lib/store";
import { C } from "@/app/ui";

export const runtime = "nodejs";

// Manifest PWA por negocio (cada caja = su propia app instalable).
// GET /api/manifest?b=<slug>
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("b");
  const n = await getNegocio(slug);
  if (!n) return NextResponse.json({ error: "negocio desconocido" }, { status: 404 });

  const manifest = {
    name: `${n.nombre} · Caja`,
    short_name: n.nombre,
    description: `Caja de ${n.nombre}: escanea el pase del cliente y actúa.`,
    start_url: `/${slug}/caja`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: C.fondo, // mismo gris claro que la app
    theme_color: n.tema.accent,
    icons: [
      { src: `/icons/${slug}-192.png`, sizes: "192x192", type: "image/png" },
      { src: `/icons/${slug}-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  return NextResponse.json(manifest, { headers: { "content-type": "application/manifest+json" } });
}
