import { notFound, redirect } from "next/navigation";
import { datosAvisos } from "@/lib/motorAvisos";
import { sesionDePeticion } from "../negocioDePeticion";
import { puedeAcceder } from "@/lib/auth";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import PanelAvisos from "./PanelAvisos";

export const dynamic = "force-dynamic";

// Todo lo que se les dice a los clientes, en un sitio: los avisos automáticos,
// mandar uno ahora (a todos o a un grupo) y lo ya enviado. Los datos se leen
// AQUÍ y la página llega pintada; mientras, Next enseña loading.js.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await sesionDePeticion();
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/avisos`);
  // Lo que ve aquí el admin son los clientes de otro: queda apuntado (docs/RGPD.md, 6.9).
  await apuntarEntradaAdmin(sesion, slug, "Avisos");

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
