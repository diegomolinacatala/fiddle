import { NextResponse } from "next/server";
import { sesionDeRequest, puedeAcceder } from "./auth";

// Utilidades comunes de los route handlers.

export const jsonError = (mensaje, status) => NextResponse.json({ error: mensaje }, { status });

/** Error inesperado: detalle al log del servidor, mensaje genérico al cliente. */
export function errorInterno(contexto, e) {
  console.error(`[${contexto}]`, e);
  return jsonError("Error interno. Revisa los logs del servidor.", 500);
}

/**
 * Exige una sesión con permiso `rol` sobre el negocio `slug`.
 * Devuelve { sesion } o { respuesta } (401/403) para devolver tal cual.
 */
export async function exigirNegocio(request, slug, rol) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return { respuesta: jsonError("No autorizado", 401) };
  if (!puedeAcceder(sesion, slug, rol)) return { respuesta: jsonError("Sin permiso para este negocio", 403) };
  return { sesion };
}

/** Convierte una Respuesta de lib/apple/servicio en un Response HTTP. */
export function aResponse({ status, json, body, headers }) {
  if (body) return new Response(body, { status, headers });
  if (status === 204) return new Response(null, { status });
  return NextResponse.json(json ?? {}, { status, headers });
}
