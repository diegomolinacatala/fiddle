import { NextResponse } from "next/server";
import { getCliente, getNegocio } from "@/lib/store";
import { accesoATarjeta } from "@/lib/gestion";
import { cambiarPromos, borrarCliente, datosDeCliente, ficheroDeDatos } from "@/lib/derechos";
import { cookieDeTarjeta } from "@/lib/recordar";
import { jsonError, errorInterno } from "@/lib/http";
import { limiteEnMemoria, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Probar llaves a ciegas no lleva a ningún sitio (32 caracteres al azar), pero
// tampoco hace falta dejarlo: 30 por minuto sobran para quien la usa de verdad.
const LIMITE = { max: 30, ventanaMs: 60 * 1000 };

/**
 * "Tu tarjeta y tus datos" (/p/<serial>/datos): lo que el cliente hace solo.
 * POST /api/tarjeta/<serial>/datos  { llave?, accion, quiere? }
 *   accion "ver"        cómo está: código, si recibe promos
 *   accion "promos"     { quiere: true|false }
 *   accion "descargar"  todo lo que guardamos (arts. 15 y 20), en JSON
 *   accion "borrar"     la tarjeta y sus datos (art. 17)
 *
 * Entra quien trae la LLAVE (la del reverso del pase, tras el #) o la COOKIE del
 * teléfono que la sacó (lib/gestion.js). El serial solo no: va en el QR.
 */
export async function POST(request, { params }) {
  try {
    if (limiteEnMemoria(`datos:${ipDe(request) || "?"}`, LIMITE)) return jsonError("Demasiados intentos. Prueba en un minuto.", 429);
    // Solo desde nuestra propia página: otra web no puede borrar la tarjeta de quien la visita.
    if (request.headers.get("sec-fetch-site") === "cross-site") return jsonError("No permitido", 403);

    const { serial } = await params;
    const { llave, accion, quiere } = await request.json().catch(() => ({}));
    const cliente = await getCliente(serial);
    const via = accesoATarjeta(cliente, { cookies: request.cookies, llave });
    if (!via) {
      return jsonError(cliente?.borrado_en ? "Esta tarjeta ya está borrada." : "No podemos comprobar que esta tarjeta es tuya.", cliente?.borrado_en ? 410 : 403);
    }
    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return jsonError("Tienda no encontrada", 404);

    if (accion === "ver") {
      return NextResponse.json({ codigo: cliente.codigo, promos: !cliente.promos_no }, { headers: { "cache-control": "no-store" } });
    }
    if (accion === "promos" && typeof quiere === "boolean") {
      const nuevo = await cambiarPromos(cliente, negocio, quiere, "cliente");
      return NextResponse.json({ promos: !nuevo?.promos_no });
    }
    if (accion === "descargar") {
      return new NextResponse(JSON.stringify(await datosDeCliente(cliente, negocio), null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${ficheroDeDatos(cliente)}"`,
          "cache-control": "no-store",
        },
      });
    }
    if (accion === "borrar") {
      await borrarCliente(cliente, negocio, { motivo: "cliente", rol: "cliente" });
      const respuesta = NextResponse.json({ ok: true });
      // Este teléfono ya no tiene tarjeta aquí: el próximo escaneo le da una nueva.
      respuesta.cookies.set(cookieDeTarjeta(cliente.negocio), "", { path: "/", maxAge: 0 });
      return respuesta;
    }
    return jsonError("Acción no válida", 400);
  } catch (e) {
    return errorInterno("tarjeta datos", e);
  }
}
