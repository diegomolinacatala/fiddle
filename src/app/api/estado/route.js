import { NextResponse } from "next/server";
import { proveedorWallet } from "@/lib/wallet";
import { configApple, tiendasConPassTypePropio } from "@/lib/apple/config";
import { diagnosticoApple, diagnosticoSupabase, diagnosticoPush, diagnosticoGoogle, diagnosticoCifrado } from "@/lib/diagnostico";
import { appUrl } from "@/lib/url";
import { exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/estado -> diagnóstico real de las integraciones (panel de /admin).
// Comprueba que funcionan, no solo que existen. Nunca devuelve secretos.
// Solo el admin: es de toda la plataforma (Team de Apple, cuenta de Google,
// cuántos datos quedan sin cifrar), no de una tienda.
// `appleTiendas`: una entrada por tienda con Pass Type ID propio.
export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;

  const url = appUrl();
  const apple = diagnosticar(() => diagnosticoApple(configApple()));
  const appleTiendas = tiendasConPassTypePropio().map((slug) => ({
    slug,
    ...diagnosticar(() => diagnosticoApple(configApple(slug), Date.now(), slug)),
  }));

  const [supabase, google, cifrado] = await Promise.all([diagnosticoSupabase(), diagnosticoGoogle(), diagnosticoCifrado()]);

  return NextResponse.json({
    proveedor: proveedorWallet(),
    apple: { ...apple, webServiceURL: `${url}/api/wallet` },
    appleTiendas,
    supabase,
    push: diagnosticoPush(),
    google,
    cifrado,
    authSecret: Boolean(process.env.AUTH_SECRET),
    appUrl: url,
    // Apple solo acepta webServiceURL con HTTPS: en local no habrá actualizaciones.
    httpsPublico: url.startsWith("https://"),
  });
}

// Un certificado ilegible (valor cortado al pegarlo) no tumba el panel entero.
function diagnosticar(fn) {
  try {
    return fn();
  } catch (e) {
    return { ok: false, problemas: [`Variables de Apple ilegibles: ${e.message}`], avisos: [] };
  }
}
