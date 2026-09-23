import { NextResponse } from "next/server";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import { reglaDeRuta, negocioDeRuta } from "@/lib/acceso";

// ============================================================================
// GATE DE AUTENTICACIÓN
// ----------------------------------------------------------------------------
// Verifica la sesión (firma HMAC real, no solo "existe la cookie") antes de
// dejar pasar. Las reglas viven en lib/acceso.js (testeadas).
// Página sin permiso -> /login?b=<negocio>&next=<ruta>.  API sin permiso -> 401.
// ============================================================================

export async function middleware(req) {
  const { pathname, searchParams } = req.nextUrl;
  const regla = reglaDeRuta(pathname, searchParams, req.method);
  if (regla.tipo === "publica") return NextResponse.next();

  const sesion = await verificarSesion(req.cookies.get(COOKIE)?.value);
  const permitido =
    regla.tipo === "admin" ? sesion?.rol === "admin"
    : regla.tipo === "sesion" ? Boolean(sesion)
    : puedeAcceder(sesion, regla.slug, regla.rol);
  if (permitido) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const negocio = negocioDeRuta(pathname) || sesion?.negocio;
  if (negocio) url.searchParams.set("b", negocio);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Todo salvo estáticos: assets de Next, iconos, botones oficiales de Wallet,
// service worker y favicon.
export const config = {
  matcher: ["/((?!_next/|icons/|marcas/|sw\\.js|favicon\\.ico).*)"],
};
