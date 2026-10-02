import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getNegocio } from "@/lib/store";
import { puedeAcceder, COOKIE, usuarioDe } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import { negocioDelPersonal } from "@/lib/tarjeta";
import PanelAjustes from "./PanelAjustes";

export const dynamic = "force-dynamic";

// Lo de la cuenta, que se toca casi nunca: la contraseña de la caja y cómo abrir
// la caja en otro móvil. Como el resto, llega pintado desde el servidor.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/ajustes`);

  let n;
  try {
    n = await getNegocio(slug);
  } catch (e) {
    console.error(`[ajustes ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();
  return (
    <PanelAjustes
      slug={slug} negocio={negocioDelPersonal(n)}
      usuarios={{ manager: usuarioDe(slug, "manager"), caja: usuarioDe(slug, "caja") }}
      esAdmin={sesion.rol === "admin"}
    />
  );
}
