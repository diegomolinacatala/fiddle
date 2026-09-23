import { listClientes, serialesRegistrados, getNegocio } from "@/lib/store";
import { perfilDe, GRUPOS, ESTADOS, esGrupo, cadenciaTexto } from "@/lib/crm";
import { esSlug } from "@/lib/negocios";
import { jsonError, errorInterno, exigirNegocio } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Una celda CSV segura: comillas dobladas y, si empieza por un signo de
// fórmula, un apóstrofo delante (Excel ejecuta =... al abrir el fichero).
function celda(v) {
  const s = v === null || v === undefined ? "" : String(v);
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
}

const COLUMNAS = [
  ["codigo", (c) => c.codigo],
  ["nombre", (c) => c.nombre || ""],
  ["estado", (c, p) => ESTADOS[p.estado].label],
  ["visitas", (c, p) => p.visitas],
  ["sellos", (c) => c.sellos],
  ["sellos2", (c) => c.sellos2 || 0],
  ["guardados", (c) => (c.guardados || 0) + (c.guardados2 || 0)],
  ["premios", (c) => c.premios],
  ["alta", (c) => (c.creado || "").slice(0, 10)],
  ["ultima_visita", (c) => (c.ultima_visita || "").slice(0, 10)],
  ["dias_sin_venir", (c, p) => (p.diasSinVenir === null ? "" : Math.floor(p.diasSinVenir))],
  ["ritmo", (c, p) => cadenciaTexto(p.cadencia)],
  ["origen", (c) => c.origen || ""],
  ["pase_instalado", (c, p) => (p.contactable ? "sí" : "no")],
  ["nota", (c) => c.nota || ""],
];

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
        const conRegistro = { ...c, instalado: c.instalado || (registrados.has(c.serial) ? c.creado : null) };
        return { cliente: c, perfil: perfilDe(conRegistro, negocio) };
      })
      .filter(({ perfil }) => !grupo || GRUPOS[grupo].incluye(perfil));

    const csv = [
      COLUMNAS.map(([nombre]) => celda(nombre)).join(","),
      ...filas.map(({ cliente, perfil }) => COLUMNAS.map(([, saca]) => celda(saca(cliente, perfil))).join(",")),
    ].join("\r\n");

    return new Response(`﻿${csv}`, {   // BOM: Excel abre los acentos bien
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
