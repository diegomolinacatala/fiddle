import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";
import { COOKIE_QUIEN } from "@/lib/plantilla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/logout -> borra la cookie de sesión. Y la de quién atiende hoy
// (lib/plantilla.js): quien entre después en este móvil no hereda el nombre del
// anterior. La de «la última vez» se queda, para proponerlo con un toque.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(COOKIE_QUIEN, "", { path: "/", maxAge: 0 });
  return res;
}
