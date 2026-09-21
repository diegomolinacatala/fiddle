import { NextResponse } from "next/server";
import {
  getCliente, getNegocio, registrarPase, borrarRegistro, destinosDeAviso,
  marcarInstalacion, addEvento, borrarDispositivos,
} from "@/lib/store";
import { validarSuscripcion, endpointValido, idDeSuscripcion, TIPO_WEB } from "@/lib/push/suscripcion";
import { hayPush } from "@/lib/push/vapid";
import { enviarPush } from "@/lib/push/enviar";
import { avisoPush } from "@/lib/avisos";
import { jsonError, errorInterno } from "@/lib/http";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Avisos del navegador de UNA tarjeta (Android). Público como /p/<serial>: quien
// tiene el enlace de la tarjeta es su dueño.
//   POST   /api/push/<serial>  { suscripcion }  -> activar (y aviso de bienvenida)
//   DELETE /api/push/<serial>  { endpoint }     -> desactivar

// Un cliente con el móvil, la tablet y el ordenador ya son tres. Más, sobra.
const MAX_NAVEGADORES = 5;

async function clienteYNegocio(params) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) return { error: jsonError("Tarjeta no encontrada", 404) };
  const negocio = await getNegocio(cliente.negocio);
  if (!negocio) return { error: jsonError("Tienda no encontrada", 404) };
  return { cliente, negocio };
}

export async function POST(request, { params }) {
  try {
    if (!hayPush()) return jsonError("Los avisos no están activados en este servidor", 503);
    const { suscripcion } = await request.json().catch(() => ({}));
    const sub = validarSuscripcion(suscripcion);
    if (!sub) return jsonError("Suscripción no válida", 400);
    if (await usoExcedido("push", ipDe(request))) return jsonError("Demasiados intentos. Prueba en unos minutos.", 429);

    const { cliente, negocio, error } = await clienteYNegocio(params);
    if (error) return error;

    const dispositivo = idDeSuscripcion(sub.endpoint);
    const token = JSON.stringify(sub);
    // El que ya estaba puede renovar su suscripción; uno nuevo, solo si hay hueco.
    const actuales = await destinosDeAviso({ seriales: [cliente.serial], passType: TIPO_WEB });
    if (!actuales.some((d) => d.dispositivo === dispositivo) && actuales.length >= MAX_NAVEGADORES) {
      return jsonError("Esta tarjeta ya tiene los avisos activados en demasiados sitios.", 409);
    }

    const nuevo = await registrarPase({ dispositivo, pushToken: token, passType: TIPO_WEB, serial: cliente.serial, negocio: negocio.slug });
    // Renovar una suscripción que ya estaba (el navegador la rehace sola) no
    // es noticia: ni evento ni aviso de bienvenida.
    if (!nuevo) return NextResponse.json({ ok: true, nuevo });

    // Un primer aviso de verdad: prueba el camino entero y el cliente ve cómo se
    // verán los de los sellos. Si el servicio de push la rechaza, no sirve: se
    // borra y el CRM no apunta nada.
    const r = await enviarPush([{
      token,
      payload: avisoPush({ titulo: negocio.nombre, cuerpo: "Avisos activados. Te diremos cada sello y cada promo.", tipo: "bienvenida" }, negocio, cliente.serial),
    }]);
    if (r.caducados.length) {
      await borrarDispositivos([dispositivo]);
      return jsonError("El navegador rechazó la suscripción. Vuelve a intentarlo.", 410);
    }

    await marcarInstalacion(cliente.serial, true);
    await addEvento(cliente.serial, "instalado", "Activó los avisos en el móvil", { negocio: negocio.slug, actor: "cliente" });
    return NextResponse.json({ ok: true, nuevo, probado: r.enviados > 0 });
  } catch (e) {
    return errorInterno("push alta", e);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { endpoint } = await request.json().catch(() => ({}));
    if (!endpointValido(endpoint)) return jsonError("Falta el endpoint", 400);
    if (await usoExcedido("push", ipDe(request))) return jsonError("Demasiados intentos. Prueba en unos minutos.", 429);
    const { cliente, negocio, error } = await clienteYNegocio(params);
    if (error) return error;

    const { ultimo } = await borrarRegistro({ dispositivo: idDeSuscripcion(endpoint), passType: TIPO_WEB, serial: cliente.serial });
    if (ultimo) {
      await marcarInstalacion(cliente.serial, false);
      await addEvento(cliente.serial, "desinstalado", "Desactivó los avisos en el móvil", { negocio: negocio.slug, actor: "cliente" });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorInterno("push baja", e);
  }
}
