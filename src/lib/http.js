import { NextResponse } from "next/server";
import { sesionDeRequest, puedeAcceder } from "./auth";
import { sesionVigente } from "./sesionVigente";
import { getNegocio } from "./store";
import { esSlug } from "./negocios";

// Utilidades comunes de los route handlers.

export const jsonError = (mensaje, status) => NextResponse.json({ error: mensaje }, { status });

/** Error inesperado: detalle al log del servidor, mensaje genérico al cliente. */
export function errorInterno(contexto, e) {
  console.error(`[${contexto}]`, e);
  return jsonError("Error interno. Revisa los logs del servidor.", 500);
}

/** La sesión de una Request si la firma vale Y sigue vigente (lib/sesionVigente.js). */
export const sesionVigenteDe = async (request) => sesionVigente(await sesionDeRequest(request));

/**
 * Exige una sesión con permiso `rol` sobre el negocio `slug`.
 * Devuelve { sesion } o { respuesta } (401/403) para devolver tal cual.
 */
export async function exigirNegocio(request, slug, rol) {
  const sesion = await sesionVigenteDe(request);
  if (!sesion) return { respuesta: jsonError("No autorizado", 401) };
  if (!puedeAcceder(sesion, slug, rol)) return { respuesta: jsonError("Sin permiso para este negocio", 403) };
  return { sesion };
}

/**
 * Lo de siempre en una ruta con `?b=<slug>`: el slug válido, la sesión con permiso
 * `rol` sobre esa tienda y la tienda leída. Devuelve { slug, sesion, negocio } o
 * { respuesta } (400/401/403/404) para devolver tal cual.
 */
export async function exigirTienda(request, rol) {
  const slug = new URL(request.url).searchParams.get("b");
  if (!esSlug(slug)) return { respuesta: jsonError("Falta o no existe ?b=<negocio>", 400) };
  const { sesion, respuesta } = await exigirNegocio(request, slug, rol);
  if (respuesta) return { respuesta };
  const negocio = await getNegocio(slug);
  if (!negocio) return { respuesta: jsonError("Ese negocio no existe", 404) };
  return { slug, sesion, negocio };
}

/**
 * Exige el admin de la plataforma. El middleware ya lo mira por la ruta
 * (/api/admin/...); esto es la segunda puerta, por si una ruta se le escapa.
 */
export async function exigirAdmin(request) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return { respuesta: jsonError("No autorizado", 401) };
  if (sesion.rol !== "admin") return { respuesta: jsonError("Solo el admin", 403) };
  return { sesion };
}

/** Convierte una Respuesta de lib/apple/servicio en un Response HTTP. */
export function aResponse({ status, json, body, headers }) {
  if (body) return new Response(body, { status, headers });
  if (status === 204) return new Response(null, { status });
  return NextResponse.json(json ?? {}, { status, headers });
}
