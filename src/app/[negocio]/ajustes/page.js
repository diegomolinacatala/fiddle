import { notFound, redirect } from "next/navigation";
import { negocioDePeticion, sesionDePeticion } from "../negocioDePeticion";
import { puedeAcceder, usuarioDe } from "@/lib/auth";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import { negocioDelPersonal } from "@/lib/tarjeta";
import PanelAjustes from "./PanelAjustes";
import { relojVivo } from "@/lib/relojAvisos";
import { planesGlobales, contarTarjetas } from "@/lib/store";
import { cupoDe } from "@/lib/planes";
import { estadoEspera } from "@/lib/listaDeEspera";

export const dynamic = "force-dynamic";

// Lo de la cuenta, que se toca casi nunca: la contraseña de la caja y cómo abrir
// la caja en otro móvil. Como el resto, llega pintado desde el servidor.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await sesionDePeticion();
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/ajustes`);
  // Lo que ve aquí el admin son los clientes de otro: queda apuntado (docs/RGPD.md, 6.9).
  await apuntarEntradaAdmin(sesion, slug, "Ajustes");

  let n, reloj, planes;
  try {
    [n, reloj, planes] = await Promise.all([negocioDePeticion(slug), relojVivo(), planesGlobales()]);
  } catch (e) {
    console.error(`[ajustes ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();
  // «Tu plan» (lib/planes.js): su nombre y, si tiene límite, cuántas tarjetas lleva
  // y cuántos esperan en la lista (lib/listaDeEspera.js). Solo se cuenta con
  // límite: a las demás no les cuesta nada.
  const [emitidas, espera] = n.cupo
    ? await Promise.all([contarTarjetas(slug).catch(() => 0), estadoEspera(slug)])
    : [0, null];
  const plan = {
    id: n.planId,
    nombre: planes[n.planId].nombre,
    cupo: n.cupo ? cupoDe(n, emitidas) : null,
    esperan: espera?.esperan ?? 0,
  };
  return (
    <PanelAjustes
      slug={slug} negocio={negocioDelPersonal(n)} plan={plan}
      usuarios={{ manager: usuarioDe(slug, "manager"), caja: usuarioDe(slug, "caja") }}
      esAdmin={sesion.rol === "admin"} reloj={reloj}
    />
  );
}
