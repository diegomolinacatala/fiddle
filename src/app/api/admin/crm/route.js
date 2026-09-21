import { NextResponse } from "next/server";
import { listNegocios, listClientes, listEventosDeNegocio, serialesRegistrados } from "@/lib/store";
import { perfilDe, metricas } from "@/lib/crm";
import { errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Las mismas cuentas del CRM, pero de TODAS las tiendas a la vez. Para poder
// comparar: cuál crece, cuál se está apagando, cuál no consigue que instalen
// el pase. El middleware ya deja esta ruta solo para el admin.
//
// GET /api/admin/crm
export async function GET() {
  try {
    const negocios = await listNegocios();

    const tiendas = await Promise.all(negocios.map(async (n) => {
      const [clientes, eventos, registrados] = await Promise.all([
        listClientes(n.slug),
        listEventosDeNegocio(n.slug, { dias: 60 }),
        serialesRegistrados(n.slug),
      ]);
      const perfiles = clientes.map((c) =>
        perfilDe({ ...c, instalado: c.instalado || (registrados.has(c.serial) ? c.creado : null) }, n),
      );
      return {
        slug: n.slug,
        nombre: n.nombre,
        emoji: n.tema.emoji,
        accent: n.tema.accent,
        tipo: n.tipo,
        metricas: metricas(perfiles, eventos, clientes),
      };
    }));

    // Totales de la plataforma: la suma de lo sumable. Las tasas se recalculan
    // sobre el total, no se promedian medias (una tienda de 3 clientes no pesa
    // lo mismo que una de 300).
    const suma = (k) => tiendas.reduce((a, t) => a + t.metricas[k], 0);
    const total = suma("total");
    const pct = (parte) => (total ? Math.round((parte / total) * 100) : 0);

    return NextResponse.json({
      tiendas: tiendas.sort((a, b) => b.metricas.total - a.metricas.total),
      totales: {
        tiendas: tiendas.length,
        total,
        activos: suma("activos"),
        enRiesgo: suma("enRiesgo"),
        nuevos30: suma("nuevos30"),
        visitas30: suma("visitas30"),
        premios: suma("premios"),
        instalados: suma("instalados"),
        tasaInstalacion: pct(suma("instalados")),
        tasaVuelta: pct(suma("repiten")),
      },
    });
  } catch (e) {
    return errorInterno("admin crm", e);
  }
}
