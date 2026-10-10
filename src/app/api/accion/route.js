import { NextResponse } from "next/server";
import { getCliente, saveCliente, getNegocio, addEvento, registrarVisita, clientePublico } from "@/lib/store";
import { TIPOS_VISITA } from "@/lib/crm";
import { ACCIONES, accionPermitida } from "@/lib/acciones";
import { notificarCliente } from "@/lib/wallet";
import { quienDeCookie, hayQueElegir, COOKIE_QUIEN } from "@/lib/plantilla";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La caja ejecuta una acción sobre un cliente. El negocio se deduce del cliente y
// la sesión tiene que ser de ESE negocio.
// POST /api/accion  body: { serial, accion }
export async function POST(request) {
  try {
    const { serial, accion } = await request.json().catch(() => ({}));
    if (typeof serial !== "string" || typeof accion !== "string") return jsonError("Falta serial o accion", 400);

    const def = Object.hasOwn(ACCIONES, accion) ? ACCIONES[accion] : null;
    if (!def) return jsonError(`Acción desconocida: ${accion}`, 400);

    const cliente = await getCliente(serial);
    if (!cliente) return jsonError("Cliente no encontrado", 404);
    // Sus sellos ya viven en la tarjeta nueva (lib/unaTarjeta.js): sellar aquí se perdería.
    if (cliente.fusionado_en) return jsonError("Esta tarjeta se pasó a una nueva. Vuelve a escanear al cliente.", 409);
    if (cliente.borrado_en) return jsonError("Esta tarjeta se borró a petición del cliente. Puede sacar otra.", 410);

    const { sesion, respuesta } = await exigirNegocio(request, cliente.negocio, "caja");
    if (respuesta) return respuesta;

    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return jsonError("Negocio no encontrado", 404);
    if (!accionPermitida(negocio, accion)) return jsonError("Esa acción no está activada por el manager", 403);

    // Quién atiende desde este móvil (lib/plantilla.js). Con gente dada de alta, la
    // caja tiene que haber elegido a alguien hoy; la pantalla lo pide con `elegir`.
    // El dueño, con su cuenta, no elige: queda como actor "manager".
    const quien = quienDeCookie(request.cookies.get(COOKIE_QUIEN)?.value, negocio.slug, negocio.plantilla);
    if (hayQueElegir(sesion, negocio.plantilla) && !quien) {
      return NextResponse.json({ ok: false, elegir: true, mensaje: "Antes de sellar, di quién atiende en este móvil." }, { status: 428 });
    }
    const empleado = sesion.rol === "caja" ? quien?.id ?? null : null;

    const r = def.aplicar(cliente, negocio);
    if (r.ok === false) return NextResponse.json({ ok: false, mensaje: r.mensaje, cliente: clientePublico(cliente) });

    // Guardado optimista: si otra caja tocó a este cliente entre la lectura y ahora
    // (dos canjes a la vez), no se aplica y se pide repetir con el estado nuevo.
    const guardado = await saveCliente(r.cliente, { esperado: cliente });
    if (!guardado) {
      return NextResponse.json(
        { ok: false, mensaje: "Otra caja acaba de actualizar a este cliente. Vuelve a intentarlo.", cliente: clientePublico(await getCliente(serial)) },
        { status: 409 },
      );
    }
    if (r.evento) await addEvento(serial, accion, r.evento, { negocio: cliente.negocio, actor: sesion.rol, empleado });
    // El cliente estuvo aquí: cuenta como visita. Una corrección, no (ver crm.js).
    if (TIPOS_VISITA.includes(accion)) await registrarVisita(serial);
    // Con el estado de antes se sabe qué pasó (un sello, un canje) y si Android debe sonar.
    const aviso = await notificarCliente(r.cliente, negocio, { antes: cliente });

    return NextResponse.json({ ok: true, mensaje: r.mensaje, cliente: clientePublico(r.cliente), aviso });
  } catch (e) {
    return errorInterno("accion", e);
  }
}
