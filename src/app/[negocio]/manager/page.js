import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getNegocio } from "@/lib/store";
import { relojVivo } from "@/lib/relojAvisos";
import { puedeAcceder, COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import { negocioDelPersonal } from "@/lib/tarjeta";
import PanelManager from "./PanelManager";

export const dynamic = "force-dynamic";

// El negocio se lee AQUÍ, en el servidor, y la página llega ya pintada: antes
// el navegador cargaba el JS, pedía /api/negocio y mientras tanto "Cargando…".
// Mientras llega, Next enseña loading.js (el esqueleto).
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  // El middleware ya lo exige; esto es la segunda puerta, como en /w/<serial>.
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/manager`);
  // Lo que ve aquí el admin son los clientes de otro: queda apuntado (docs/RGPD.md, 6.9).
  await apuntarEntradaAdmin(sesion, slug, "Tienda");

  let n;
  let reloj;
  try {
    [n, reloj] = await Promise.all([getNegocio(slug), relojVivo()]);
  } catch (e) {
    console.error(`[manager ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();
  // `reloj`: si anda, el pase lleva "ABIERTO / CERRADO" y la vista previa también.
  return <PanelManager negocio={slug} inicial={negocioDelPersonal(n)} reloj={reloj} />;
}
