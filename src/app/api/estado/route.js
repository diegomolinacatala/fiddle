import { NextResponse } from "next/server";
import { proveedorWallet } from "@/lib/wallet";
import { configApple, tiendasConPassTypePropio } from "@/lib/apple/config";
import { diagnosticoApple, diagnosticoSupabase, diagnosticoPush, diagnosticoGoogle, diagnosticoCifrado } from "@/lib/diagnostico";
import { appUrl } from "@/lib/url";
import { sesionDeRequest } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/estado -> diagnóstico real de las integraciones (panel de /admin).
// Comprueba que funcionan, no solo que existen. Nunca devuelve secretos.
// `appleTiendas`: una entrada por tienda con Pass Type ID propio (solo admin).
export async function GET(request) {
  const sesion = await sesionDeRequest(request);
  if (sesion?.rol !== "manager" && sesion?.rol !== "admin") return jsonError("Solo el manager", 403);

  const url = appUrl();
  const apple = diagnosticar(() => diagnosticoApple(configApple()));
  // Qué tiendas existen y con qué ID firman es cosa de la plataforma: solo al admin.
  const appleTiendas = sesion.rol !== "admin" ? [] : tiendasConPassTypePropio().map((slug) => ({
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
    // Cifrar los datos de antes toca a toda la plataforma: el botón, solo al admin.
    esAdmin: sesion.rol === "admin",
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
