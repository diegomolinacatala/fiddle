import { NextResponse } from "next/server";
import { repasarTodas } from "@/lib/motorAvisos";
import { limpiezaDiaria } from "@/lib/limpieza";
import { vigilar } from "@/lib/alertas";
import { igualSeguro } from "@/lib/auth";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El RELOJ de los avisos automáticos: una pasada por todas las tiendas.
 * GET|POST /api/cron/avisos   Authorization: Bearer <CRON_SECRET>
 *
 * Lo llama algo de fuera cada 15 minutos (ver docs/AVISOS.md): Supabase
 * (pg_cron) en el plan gratuito de Vercel, o el cron de Vercel en el Pro, que
 * manda esa misma cabecera solo. Es idempotente: llamarlo de más no repite nada.
 *
 * Sin CRON_SECRET no hace nada (falla cerrado): cualquiera podría forzar envíos.
 *
 * De paso, en el mismo reloj: la pasada diaria de lo que se borra solo (plazos
 * del RGPD, lib/limpieza.js; corre una vez al día) y las alertas de seguridad
 * (lib/alertas.js). Ninguna de las dos para a la otra ni a los avisos.
 */
async function pasada(request) {
  const secreto = process.env.CRON_SECRET?.trim();
  if (!secreto) return jsonError("El reloj de avisos está apagado: falta CRON_SECRET", 503);
  if (!igualSeguro(request.headers.get("authorization") || "", `Bearer ${secreto}`)) {
    return jsonError("No autorizado", 401);
  }
  try {
    const resultados = await repasarTodas();
    const limpieza = await limpiezaDiaria().catch((e) => ({ error: String(e?.message || e) }));
    const alertas = await vigilar().catch((e) => ({ error: String(e?.message || e) }));
    return NextResponse.json({ ok: true, resultados, limpieza, alertas });
  } catch (e) {
    return errorInterno("cron avisos", e);
  }
}

export const GET = pasada;
export const POST = pasada;
