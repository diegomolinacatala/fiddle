import { listClientes, serialesRegistrados, getNegocio } from "@/lib/store";
import { perfilDe, GRUPOS, esGrupo } from "@/lib/crm";
import { csvClientes } from "@/lib/exportar";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/crm/export?b=<slug>[&grupo=riesgo] -> CSV para abrir en una hoja.
// Sin `grupo`, la tienda entera.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("b");
  const grupo = searchParams.get("grupo");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const { respuesta } = await exigirNegocio(request, slug, "manager");
  if (respuesta) return respuesta;
  if (grupo && !esGrupo(grupo)) return jsonError(`No existe el grupo "${grupo}"`, 400);

  try {
    const negocio = await getNegocio(slug);
    if (!negocio) return jsonError("Ese negocio no existe", 404);

    const [clientes, registrados] = await Promise.all([listClientes(slug), serialesRegistrados(slug)]);
    const filas = clientes
      .map((c) => {
        // Igual que en el CRM (lib/crmDatos.js): un registro vivo manda sobre las fechas.
        const vivo = registrados.has(c.serial);
        const conRegistro = { ...c, instalado: c.instalado || (vivo ? c.creado : null), desinstalado: vivo ? null : c.desinstalado };
        return { cliente: c, perfil: perfilDe(conRegistro, negocio) };
      })
      .filter(({ perfil }) => !grupo || GRUPOS[grupo].incluye(perfil));

    return new Response(csvClientes(filas, negocio), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${slug}-${grupo || "clientes"}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorInterno("crm export", e);
  }
}
