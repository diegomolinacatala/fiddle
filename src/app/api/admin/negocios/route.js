import { NextResponse } from "next/server";
import {
  listNegocios, getNegocio, crearNegocio, saveNegocio, archivarNegocio, borrarNegocio, listClientes,
} from "@/lib/store";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { ACCIONES } from "@/lib/acciones";
import { datosNegocioNuevo, patchNegocioAdmin, notaDeCampo } from "@/lib/validacion";
import { notificarNegocio } from "@/lib/wallet";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// API DEL ADMIN DE LA PLATAFORMA
// ----------------------------------------------------------------------------
// Crear, editar, archivar y borrar negocios. El middleware ya ha comprobado que
// la sesión es de admin (acceso.js -> tipo "admin"), así que aquí no se vuelve
// a mirar el permiso: se mira que los datos tengan sentido.
//
//   GET    ?archivados=1        lista (activos, o los archivados)
//   POST                        crea un negocio
//   PUT                         edita uno; con `nota` guarda un comentario de campo
//   DELETE ?slug=&modo=         archivar (por defecto) o borrar para siempre
// ============================================================================

// Cuántos clientes tiene cada negocio: el admin necesita saberlo antes de borrar.
async function conClientes(negocios) {
  return Promise.all(
    negocios.map(async (n) => ({ ...n, clientes: (await listClientes(n.slug)).length })),
  );
}

export async function GET(request) {
  try {
    const archivados = new URL(request.url).searchParams.get("archivados") === "1";
    const todos = await listNegocios({ incluirArchivados: true });
    return NextResponse.json(await conClientes(todos.filter((n) => n.archivado === archivados)));
  } catch (e) {
    return errorInterno("admin negocios GET", e);
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const r = datosNegocioNuevo(body, { esSlug, ESTILOS, temaPorDefecto });
    if (r.error) return jsonError(r.error, 400);

    const creado = await crearNegocio(r.datos);
    if (creado.error) return jsonError(creado.error, 409);
    return NextResponse.json(creado.negocio, { status: 201 });
  } catch (e) {
    return errorInterno("admin negocios POST", e);
  }
}

export async function PUT(request) {
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

    const r = patchNegocioAdmin(body, Object.keys(ACCIONES), { ESTILOS, temaPorDefecto });
    if (r.error) return jsonError(r.error, 400);
    const nuevo = await saveNegocio(slug, r.patch);

    // Si cambió algo que se ve en el pase, los teléfonos tienen que enterarse.
    const aviso = nuevo.archivado ? null : await notificarNegocio(nuevo);
    return NextResponse.json({ ...nuevo, aviso });
  } catch (e) {
    return errorInterno("admin negocios PUT", e);
  }
}

export async function DELETE(request) {
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

    // Borrado definitivo: hay que escribir el slug para confirmarlo.
    if (modo === "borrar") {
      if (searchParams.get("confirmar") !== slug) {
        return jsonError("Para borrar del todo hay que escribir el identificador exacto", 400);
      }
      const { borrados } = await borrarNegocio(slug);
      return NextResponse.json({ ok: true, borrado: slug, clientes: borrados });
    }
    return jsonError("Modo no válido", 400);
  } catch (e) {
    return errorInterno("admin negocios DELETE", e);
  }
}
