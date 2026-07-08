import { NextResponse } from "next/server";
import { verifySession, canAccess, COOKIE } from "@/lib/auth";

// ============================================================================
// GATE DE AUTENTICACIÓN
// ----------------------------------------------------------------------------
// Verifica la sesión (firma HMAC real, no solo "existe la cookie") antes de
// dejar pasar a las rutas sensibles. Página sin sesión -> redirige a /login.
// API sin sesión -> 401 JSON.
//
// PÚBLICO a propósito:
//   /                 hub
//   /login /api/login /api/logout
//   /api/tap          EMISIÓN del pase: el cliente NO tiene login (crea su pase)
//   /p/<serial>       vista del pase del cliente (solo lectura, su identidad)
// ============================================================================

const PUBLIC = [
  /^\/$/,
  /^\/login$/,
  /^\/api\/login$/,
  /^\/api\/logout$/,
  /^\/api\/tap$/,
  /^\/p\//,
];

// Rutas que exigen rol manager. El resto de protegidas se conforman con worker.
const MANAGER_ONLY = [
  /^\/manager$/,
  /^\/api\/programa$/,
  /^\/api\/promo$/,
  /^\/api\/crear$/,
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const needed = MANAGER_ONLY.some((re) => re.test(pathname)) ? "manager" : "worker";
  const sesion = await verifySession(req.cookies.get(COOKIE)?.value);

  if (!sesion || !canAccess(sesion.role, needed)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Solo corre en estas rutas: assets, manifiestos y _next quedan fuera.
export const config = {
  matcher: ["/manager", "/worker", "/w/:path*", "/api/:path*"],
};
