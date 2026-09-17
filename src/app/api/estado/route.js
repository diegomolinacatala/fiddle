import { NextResponse } from "next/server";
import { proveedorWallet } from "@/lib/wallet";
import { configApple } from "@/lib/apple/config";
import { hayGoogle } from "@/lib/googlewallet";
import { diagnosticoApple, diagnosticoSupabase } from "@/lib/diagnostico";
import { appUrl } from "@/lib/url";
import { sesionDeRequest } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/estado -> diagnóstico real de las integraciones (panel del manager).
// Comprueba que funcionan, no solo que existen. Nunca devuelve secretos.
export async function GET(request) {
  const sesion = await sesionDeRequest(request);
  if (sesion?.rol !== "manager") return jsonError("Solo el manager", 403);

  const url = appUrl();
  let apple;
  try {
    apple = diagnosticoApple(configApple());
  } catch (e) {
    apple = { ok: false, problemas: [`Variables de Apple ilegibles: ${e.message}`], avisos: [] };
  }

  return NextResponse.json({
    proveedor: proveedorWallet(),
    apple: { ...apple, webServiceURL: `${url}/api/wallet` },
    supabase: await diagnosticoSupabase(),
    google: hayGoogle(),
    authSecret: Boolean(process.env.AUTH_SECRET),
    appUrl: url,
    // Apple solo acepta webServiceURL con HTTPS: en local no habrá actualizaciones.
    httpsPublico: url.startsWith("https://"),
  });
}
