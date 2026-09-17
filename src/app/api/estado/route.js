import { NextResponse } from "next/server";
import { proveedorWallet } from "@/lib/wallet";
import { faltanVariablesApple } from "@/lib/apple/config";
import { hasSupabase } from "@/lib/store";
import { hayGoogle } from "@/lib/googlewallet";
import { appUrl } from "@/lib/url";
import { sesionDeRequest } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/estado -> qué integraciones están activas (panel del manager).
// Nunca devuelve secretos: solo si existen.
export async function GET(request) {
  const sesion = await sesionDeRequest(request);
  if (sesion?.rol !== "manager") return jsonError("Solo el manager", 403);

  const url = appUrl();
  return NextResponse.json({
    proveedor: proveedorWallet(),
    apple: {
      configurado: faltanVariablesApple().length === 0,
      faltan: faltanVariablesApple(),
      passTypeId: process.env.APPLE_PASS_TYPE_ID || null,
      webServiceURL: `${url}/api/wallet`,
    },
    google: hayGoogle(),
    supabase: hasSupabase(),
    authSecret: Boolean(process.env.AUTH_SECRET),
    appUrl: url,
    // Apple solo acepta webServiceURL con HTTPS: en local no habrá actualizaciones.
    httpsPublico: url.startsWith("https://"),
  });
}
