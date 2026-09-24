import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { datosAvisos } from "@/lib/motorAvisos";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import PanelAvisos from "./PanelAvisos";

export const dynamic = "force-dynamic";

// Todo lo que se les dice a los clientes, en un sitio: los avisos automáticos,
// mandar uno ahora (a todos o a un grupo) y lo ya enviado. Los datos se leen
// AQUÍ y la página llega pintada; mientras, Next enseña loading.js.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/avisos`);

  let datos;
  try {
    datos = await datosAvisos(slug);
  } catch (e) {
    console.error(`[avisos ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "campanas")} />;
  }
  if (!datos) notFound();
  return <PanelAvisos slug={slug} inicial={datos} />;
}
