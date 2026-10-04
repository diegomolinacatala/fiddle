import { NextResponse } from "next/server";
import {
  listNegocios, getNegocio, crearNegocio, saveNegocio, archivarNegocio, borrarNegocio, listClientes, registrarBorrado,
} from "@/lib/store";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { ACCIONES } from "@/lib/acciones";
import { datosNegocioNuevo, patchNegocioAdmin, notaDeCampo } from "@/lib/validacion";
import { notificarNegocio } from "@/lib/wallet";
import { nuevaClave, ROLES_TIENDA } from "@/lib/accesos";
import { auditar } from "@/lib/auditoria";
import { normalizarLegal } from "@/lib/legal";
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
//   DELETE ?slug=&modo=         archivar (por defecto) o borrar para siempre
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
  const { sesion, respuesta } = await exigirAdmin(request);
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

    // Los datos legales (razón social, NIF…) no salen en el pase: se guardan solos,
    // sin mover ningún teléfono.
    if ("legal" in body && Object.keys(body).every((k) => k === "slug" || k === "legal")) {
      const legal = normalizarLegal(body.legal);
      const guardado = await saveNegocio(slug, { legal });
      await auditar(sesion, slug, "config", "legal");
      return NextResponse.json(guardado);
    }

    const r = patchNegocioAdmin(body, Object.keys(ACCIONES), {
      ESTILOS, temaPorDefecto, cartillasActuales: actual.cartillas, cartillasAparcadas: actual.cartillasAparcadas,
    });
    if (r.error) return jsonError(r.error, 400);
    const nuevo = await saveNegocio(slug, r.patch);
    await auditar(sesion, slug, "config", Object.keys(r.patch).join(", "));

    // Si cambió algo que se ve en el pase, los teléfonos tienen que enterarse.
    const aviso = nuevo.archivado ? null : await notificarNegocio(nuevo, { cartilla: true });
    return NextResponse.json({ ...nuevo, aviso });
  } catch (e) {
    return errorInterno("admin negocios PUT", e);
  }
}

export async function DELETE(request) {
  const { sesion, respuesta } = await exigirAdmin(request);
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
      await auditar(sesion, slug, modo);
      return NextResponse.json({ ok: true, archivado: guardado.archivado });
    }

    // Borrado definitivo: hay que escribir el slug para confirmarlo.
    if (modo === "borrar") {
      if (searchParams.get("confirmar") !== slug) {
        return jsonError("Para borrar del todo hay que escribir el identificador exacto", 400);
      }
      const { borrados } = await borrarNegocio(slug);
      // La constancia del borrado (sin datos personales): es lo que pide el contrato.
      await registrarBorrado({ negocio: slug, tipo: "tienda", motivo: "admin", rol: "admin", cuantos: borrados });
      await auditar(sesion, slug, "borrar_tienda", `${borrados} tarjetas`);
      return NextResponse.json({ ok: true, borrado: slug, clientes: borrados });
    }
    return jsonError("Modo no válido", 400);
  } catch (e) {
    return errorInterno("admin negocios DELETE", e);
  }
}
