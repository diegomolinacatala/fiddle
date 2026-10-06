import { NextResponse } from "next/server";
import {
  listNegocios, getNegocio, crearNegocio, saveNegocio, archivarNegocio, borrarNegocio, listClientes,
  anularTarjetas, purgarAnuladas,
} from "@/lib/store";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { ACCIONES } from "@/lib/acciones";
import { datosNegocioNuevo, patchNegocioAdmin, notaDeCampo } from "@/lib/validacion";
import { notificarNegocio, avisarDeBaja } from "@/lib/wallet";
import { nuevaClave, ROLES_TIENDA } from "@/lib/accesos";
import { jsonError, errorInterno, exigirAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// API DEL ADMIN DE LA PLATAFORMA
// ----------------------------------------------------------------------------
// Crear, editar, archivar y borrar negocios. El middleware ya ha comprobado que
// la sesión es de admin (acceso.js -> tipo "admin"); cada handler lo vuelve a
// mirar (exigirAdmin) por si una ruta se le escapa, y luego mira que los datos
// tengan sentido.
//
//   GET    ?archivados=1        lista (activos, o los archivados)
//   POST                        crea un negocio
//   PUT                         edita uno; con `nota` guarda un comentario de campo
//   DELETE ?slug=&modo=         archivar (por defecto), borrar para siempre o
//                               vaciar (dar de baja todas sus tarjetas)
// ============================================================================

// Cuántos clientes tiene cada negocio: el admin necesita saberlo antes de borrar.
async function conClientes(negocios) {
  return Promise.all(
    negocios.map(async (n) => ({ ...n, clientes: (await listClientes(n.slug)).length })),
  );
}

export async function GET(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const archivados = new URL(request.url).searchParams.get("archivados") === "1";
    const todos = await listNegocios({ incluirArchivados: true });
    return NextResponse.json(await conClientes(todos.filter((n) => n.archivado === archivados)));
  } catch (e) {
    return errorInterno("admin negocios GET", e);
  }
}

export async function POST(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const body = await request.json().catch(() => ({}));
    const r = datosNegocioNuevo(body, { esSlug, ESTILOS, temaPorDefecto });
    if (r.error) return jsonError(r.error, 400);

    const creado = await crearNegocio(r.datos);
    if (creado.error) return jsonError(creado.error, 409);
    // Las contraseñas nacen con la tienda y se enseñan UNA vez: nadie tiene que
    // tocar Vercel para que pueda entrar. Si fallan, la tienda ya existe y se
    // generan después desde su ficha.
    let accesos = null;
    try {
      accesos = await Promise.all(ROLES_TIENDA.map((rol) => nuevaClave(creado.negocio.slug, rol)));
    } catch (e) {
      console.error(`[admin] tienda ${creado.negocio.slug} creada sin contraseñas:`, e);
    }
    return NextResponse.json({ ...creado.negocio, accesos }, { status: 201 });
  } catch (e) {
    return errorInterno("admin negocios POST", e);
  }
}

export async function PUT(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const body = await request.json().catch(() => ({}));
    const slug = body?.slug;
    if (!esSlug(slug)) return jsonError("Falta el negocio", 400);
    const actual = await getNegocio(slug, { incluirArchivados: true });
    if (!actual) return jsonError("Ese negocio no existe", 404);

    // Nota sobre un campo del pase ("esto debería ser X"): se mezcla con las que ya había.
    if (body.nota) {
      const n = notaDeCampo(body.nota);
      if (n.error) return jsonError(n.error, 400);
      const notas = { ...actual.notas };
      if (n.texto) notas[n.clave] = n.texto;
      else delete notas[n.clave];
      return NextResponse.json(await saveNegocio(slug, { notas }));
    }

    const r = patchNegocioAdmin(body, Object.keys(ACCIONES), {
      ESTILOS, temaPorDefecto, cartillasActuales: actual.cartillas, cartillasAparcadas: actual.cartillasAparcadas,
    });
    if (r.error) return jsonError(r.error, 400);
    const nuevo = await saveNegocio(slug, r.patch);

    // Si cambió algo que se ve en el pase, los teléfonos tienen que enterarse.
    const aviso = nuevo.archivado ? null : await notificarNegocio(nuevo, { cartilla: true });
    return NextResponse.json({ ...nuevo, aviso });
  } catch (e) {
    return errorInterno("admin negocios PUT", e);
  }
}

export async function DELETE(request) {
  const { respuesta } = await exigirAdmin(request);
  if (respuesta) return respuesta;
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const modo = searchParams.get("modo") || "archivar";
    if (!esSlug(slug)) return jsonError("Falta el negocio", 400);
    const negocio = await getNegocio(slug, { incluirArchivados: true });
    if (!negocio) return jsonError("Ese negocio no existe", 404);

    if (modo === "archivar" || modo === "desarchivar") {
      const guardado = await archivarNegocio(slug, modo === "archivar");
      return NextResponse.json({ ok: true, archivado: guardado.archivado });
    }

    // Borrado definitivo y baja de tarjetas: hay que escribir el slug para confirmarlo.
    if ((modo === "borrar" || modo === "vaciar") && searchParams.get("confirmar") !== slug) {
      return jsonError("Para esto hay que escribir el identificador exacto", 400);
    }
    if (modo === "borrar") {
      const { borrados } = await borrarNegocio(slug);
      return NextResponse.json({ ok: true, borrado: slug, clientes: borrados });
    }
    // Las tarjetas se anulan en los teléfonos y LUEGO se borran: borradas sin más,
    // cada iPhone se quedaría con la suya, sellos incluidos, para siempre.
    if (modo === "vaciar") {
      const anuladas = await anularTarjetas(slug);
      const aviso = await avisarDeBaja(anuladas, negocio);
      const borradas = await purgarAnuladas({ negocio: slug });
      return NextResponse.json({ ok: true, anuladas: anuladas.length, enIphone: anuladas.length - borradas, aviso });
    }
    return jsonError("Modo no válido", 400);
  } catch (e) {
    return errorInterno("admin negocios DELETE", e);
  }
}
