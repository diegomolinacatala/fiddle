import { NextResponse } from "next/server";
import { roleForPin, signSession, COOKIE, TTL } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/login  body: { pin } -> valida el PIN, firma la sesión y la deja
// en una cookie httpOnly. Devuelve el rol para que el cliente sepa a dónde ir.
export async function POST(request) {
  try {
    const { pin } = await request.json().catch(() => ({}));
    const role = roleForPin(String(pin ?? ""));
    if (!role) return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });

    const token = await signSession(role);
    const res = NextResponse.json({ ok: true, role });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
