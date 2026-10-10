import { NextResponse } from "next/server";
import { listEventosDeNegocio } from "@/lib/store";
import { zonaDe } from "@/lib/actividad";
import {
  empleadosActivos, empleadoDe, quienDeCookie, hayQueElegir, valorQuien, caducidadDelDia, resumenDeHoy,
  COOKIE_QUIEN, COOKIE_ULTIMO, DIAS_ULTIMO,
} from "@/lib/plantilla";
import { jsonError, errorInterno, exigirTienda } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quién atiende desde ESTE móvil (lib/plantilla.js). La cuenta de la caja la
// comparten; cada empleado se elige en su móvil la primera vez cada día.
//   GET  ?b=<slug>  -> { elegir, empleado, ultimo, plantilla: [{id, nombre}], hoy }
//        elegir:    hay que elegir antes de sellar (cuenta de caja, gente dada de alta, nadie elegido hoy)
//        ultimo:    quién fue la última vez en este móvil, para proponerlo con un toque
//        hoy:       lo de hoy de quien atiende (sellos, clientes, premios), para su pantalla
//   POST ?b=<slug>  { id } -> deja las cookies: `quien` (hasta la medianoche de la
//        tienda) y `quien_ultimo` (90 días). El dueño no elige: su cuenta ya dice quién es.

const solo = (e) => (e ? { id: e.id, nombre: e.nombre } : null);

export async function GET(request) {
  try {
    const { respuesta, slug, sesion, negocio } = await exigirTienda(request, "caja");
    if (respuesta) return respuesta;
    const { plantilla } = negocio;
    const esCaja = sesion.rol === "caja";
    const empleado = esCaja ? quienDeCookie(request.cookies.get(COOKIE_QUIEN)?.value, slug, plantilla) : null;
    const ultimo = esCaja ? quienDeCookie(request.cookies.get(COOKIE_ULTIMO)?.value, slug, plantilla) : null;
    let hoy = null;
    if (empleado) {
      // Dos días por si la medianoche de la tienda no es la del servidor; lo de hoy lo filtra resumenDeHoy.
      const eventos = await listEventosDeNegocio(slug, { dias: 2, limite: 2000 });
      hoy = resumenDeHoy(eventos, { id: empleado.id, zona: zonaDe(negocio) });
    }
    return NextResponse.json({
      elegir: hayQueElegir(sesion, plantilla) && !empleado,
      empleado: solo(empleado),
      ultimo: solo(ultimo),
      plantilla: empleadosActivos(plantilla).map(solo),
      hoy,
    });
  } catch (e) {
    return errorInterno("quien GET", e);
  }
}

export async function POST(request) {
  try {
    const { respuesta, slug, negocio } = await exigirTienda(request, "caja");
    if (respuesta) return respuesta;
    const { id } = (await request.json().catch(() => null)) ?? {};
    const e = typeof id === "string" ? empleadoDe(negocio.plantilla, id) : null;
    if (!e || e.baja) return jsonError("Esa persona no está en la plantilla", 400);

    const res = NextResponse.json({ ok: true, empleado: solo(e) });
    const comun = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
    res.cookies.set(COOKIE_QUIEN, valorQuien(slug, e.id), { ...comun, maxAge: caducidadDelDia(Date.now(), zonaDe(negocio)) });
    res.cookies.set(COOKIE_ULTIMO, valorQuien(slug, e.id), { ...comun, maxAge: DIAS_ULTIMO * 24 * 60 * 60 });
    return res;
  } catch (e) {
    return errorInterno("quien POST", e);
  }
}
