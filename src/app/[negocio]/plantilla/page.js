import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { datosPlantilla } from "@/lib/plantillaDatos";
import { puedeAcceder, COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import PanelPlantilla from "./PanelPlantilla";

export const dynamic = "force-dynamic";

// La pestaña PLANTILLA: quién atiende la caja y qué hace cada uno. Como el
// resto, se lee en el servidor y llega pintada (lib/plantillaDatos.js).
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/plantilla`);
  // Lo que ve aquí el admin es la actividad de otra tienda: queda apuntado (docs/RGPD.md, 6.9).
  await apuntarEntradaAdmin(sesion, slug, "Plantilla");

  let datos;
  try {
    datos = await datosPlantilla(slug);
  } catch (e) {
    console.error(`[plantilla ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "eventos")} />;
  }
  if (!datos) notFound();
  return <PanelPlantilla slug={slug} inicial={datos} />;
}
