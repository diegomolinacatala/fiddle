import { notFound, redirect } from "next/navigation";
import { negocioDePeticion, sesionDePeticion } from "../negocioDePeticion";
import { puedeAcceder } from "@/lib/auth";
import { estadoAccesos } from "@/lib/accesos";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "@/app/ErrorDatos";
import { negocioDelPersonal } from "@/lib/tarjeta";
import PanelAjustes from "./PanelAjustes";
import { relojVivo } from "@/lib/relojAvisos";
import { planesGlobales, contarTarjetas } from "@/lib/store";
import { cupoDe, FUNCIONES } from "@/lib/planes";
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

  let n, reloj, planes, accesos;
  try {
    [n, reloj, planes, accesos] = await Promise.all([negocioDePeticion(slug), relojVivo(), planesGlobales(), estadoAccesos(slug)]);
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
    // Lo que su plan no lleva (Básico), para decir qué ganaría pasando a Pro.
    faltan: FUNCIONES.filter((f) => n.funciones?.[f.id] === false).map((f) => f.nombre),
  };
  return (
    <PanelAjustes
      slug={slug} negocio={negocioDelPersonal(n)} plan={plan}
      usuarios={usuariosDeEntrada(accesos)}
      esAdmin={sesion.rol === "admin"} reloj={reloj}
    />
  );
}

/**
 * Con qué entra cada uno, para enseñarlo en «Tu acceso» y en la caja: el correo del
 * dueño o el usuario elegido de la caja (accesos.login) y, si aún no lo tienen (una
 * tienda sin migrar), el usuario de siempre (`slug`, `slug-caja`).
 */
function usuariosDeEntrada(accesos) {
  const de = (rol) => {
    const a = accesos.find((x) => x.rol === rol);
    return a?.login || a?.usuario || "";
  };
  return { manager: de("manager"), caja: de("caja") };
}
