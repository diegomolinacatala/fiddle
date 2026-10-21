import { NextResponse } from "next/server";
import { listClientes, listClientesDeSeriales, getClientePorCodigo, clientePublico, listEventosDeNegocio, getNegocio } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { atendidosHoy, ultimosDeHoy, zonaDe } from "@/lib/actividad";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLIENTES = 200; // las pantallas muestran los más recientes
const MAX_HOY = 15; // filas de «Hoy en la caja»

// GET /api/clientes?b=<slug>            -> últimos clientes de ese negocio.
// GET /api/clientes?b=<slug>&codigo=K7M  -> UN cliente por su código corto.
// GET /api/clientes?b=<slug>&hoy=1       -> quién ha pasado hoy por la caja, el
//   último arriba (atendidosHoy): la lista de debajo del escáner. Solo código,
//   nombre y lo último de hoy: el móvil de la caja lo ve cualquiera.
// GET /api/clientes?b=<slug>&segunda=1   -> cuántos tienen algo en la SEGUNDA
//   cartilla (sellos o premios guardados): lo que el editor avisa que se queda
//   guardado, sin verse, al pasar a una sola. Solo cuentas, de todos.
//
// El código se busca solo dentro de `b`, y la sesión ya tiene que ser de ese
// negocio: el "K7M" de otra tienda no se puede resolver desde aquí.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("b");
  const codigo = searchParams.get("codigo");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { respuesta } = await exigirNegocio(request, slug, "caja");
  if (respuesta) return respuesta;
  try {
    if (searchParams.get("segunda") === "1") {
      const todos = await listClientes(slug);
      return NextResponse.json({
        conSellos: todos.filter((c) => (c.sellos2 || 0) > 0).length,
        conGuardados: todos.filter((c) => (c.guardados2 || 0) > 0).length,
      });
    }
    if (searchParams.get("hoy") === "1") {
      // Dos días por si la medianoche de la tienda no es la del servidor; lo de hoy lo filtra ultimosDeHoy.
      const [negocio, eventos] = await Promise.all([getNegocio(slug), listEventosDeNegocio(slug, { dias: 2, limite: 2000 })]);
      const zona = zonaDe(negocio);
      // Solo las tarjetas de los últimos atendidos, no la tienda entera. El doble de las
      // filas, por si alguna ya no está (fusionada o borrada).
      const candidatos = ultimosDeHoy(eventos, { zona }).slice(0, MAX_HOY * 2).map((e) => e.serial);
      const clientes = await listClientesDeSeriales(slug, candidatos);
      return NextResponse.json(atendidosHoy(eventos, clientes, { zona, max: MAX_HOY, revisados: candidatos.length }));
    }
    if (codigo) {
      const cliente = await getClientePorCodigo(slug, codigo);
      if (!cliente) return jsonError("Ningún pase de esta tienda con ese código", 404);
      return NextResponse.json(clientePublico(cliente));
    }
    return NextResponse.json((await listClientes(slug, { limite: MAX_CLIENTES })).map(clientePublico));
  } catch (e) {
    return errorInterno("clientes", e);
  }
}
