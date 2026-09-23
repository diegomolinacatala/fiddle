import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { datosCrm } from "@/lib/crmDatos";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import PanelCrm from "./PanelCrm";

export const dynamic = "force-dynamic";

// Los datos del CRM se calculan AQUÍ y la página llega ya pintada; mientras,
// Next enseña loading.js (el esqueleto). Ver lib/crmDatos.js.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/crm`);

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
