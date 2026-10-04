import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { datosCrm } from "@/lib/crmDatos";
import { puedeAcceder, COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import PanelCrm from "./PanelCrm";

export const dynamic = "force-dynamic";

// Los datos del CRM se calculan AQUÍ y la página llega ya pintada; mientras,
// Next enseña loading.js (el esqueleto). Ver lib/crmDatos.js.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/crm`);
  // Lo que ve aquí el admin son los clientes de otro: queda apuntado (docs/RGPD.md, 6.9).
  await apuntarEntradaAdmin(sesion, slug, "Clientes");

  let datos;
  try {
    datos = await datosCrm(slug);
  } catch (e) {
    console.error(`[crm ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "clientes")} />;
  }
  if (!datos) notFound();
  return <PanelCrm slug={slug} inicial={datos} />;
}
