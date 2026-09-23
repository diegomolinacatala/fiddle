import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getNegocio } from "@/lib/store";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import PanelManager from "./PanelManager";

export const dynamic = "force-dynamic";

// El negocio se lee AQUÍ, en el servidor, y la página llega ya pintada: antes
// el navegador cargaba el JS, pedía /api/negocio y mientras tanto "Cargando…".
// Mientras llega, Next enseña loading.js (el esqueleto).
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  // El middleware ya lo exige; esto es la segunda puerta, como en /w/<serial>.
  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/manager`);

  let n;
  try {
    n = await getNegocio(slug);
  } catch (e) {
    console.error(`[manager ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();
  return <PanelManager negocio={slug} inicial={n} />;
}
