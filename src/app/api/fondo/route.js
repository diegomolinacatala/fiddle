import { leerImagen } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";

// ============================================================================
// GET /api/fondo?b=<slug>&v=<id>[&i=1] — una imagen subida por la tienda
// (lib/propios.js): la foto de la banda (JPG) o, con i=1, un icono (PNG).
// Pública como /api/logo: la tarjeta web la pide sin sesión para pintar la
// banda. La URL lleva la huella del contenido: no cambia nunca, un año en caché.
// ============================================================================

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get("b");
  const id = q.get("v") || "";
  if (!esSlug(slug) || !/^[0-9a-f]{16,64}$/.test(id)) return jsonError("Imagen desconocida", 404);
  const icono = q.get("i") === "1";
  try {
    const datos = await leerImagen(slug, id, icono ? "png" : "jpg");
    if (!datos) return jsonError("Imagen desconocida", 404);
    return new Response(datos, {
      headers: {
        "content-type": icono ? "image/png" : "image/jpeg",
        "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (e) {
    return errorInterno("fondo GET", e);
  }
}
