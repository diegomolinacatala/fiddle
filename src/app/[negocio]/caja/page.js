import { notFound, redirect } from "next/navigation";
import { negocioDePeticion, sesionDePeticion } from "../negocioDePeticion";
import { puedeAcceder } from "@/lib/auth";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import { negocioDelPersonal } from "@/lib/tarjeta";
import { empleadosActivos, plantillaDeCaja } from "@/lib/plantilla";
import { recorridoVisto } from "@/lib/tutorial";
import ErrorDatos from "@/app/ErrorDatos";
import Caja from "./Caja";

export const dynamic = "force-dynamic";

// La caja llega ya con su tienda, como el manager: el layout ya ha leído el negocio
// y la sesión en esta misma petición (negocioDePeticion), así que aquí no cuestan
// nada. Antes el navegador pedía /api/negocio, /api/plantilla/quien y
// /api/tutorial al abrirse, y la caja se abre tras cada cliente: eran tres
// funciones de Vercel más por cada uno.
export default async function Page({ params }) {
  const { negocio: slug } = await params;
  // El middleware ya lo exige; esto es la segunda puerta. Una sesión que ya no vale
  // (cambiaron la contraseña de la caja) vuelve a entrar, como hacía el 401 de antes.
  const sesion = await sesionDePeticion();
  if (!puedeAcceder(sesion, slug, "caja")) redirect(`/login?b=${slug}&next=/${slug}/caja`);
  // «Hoy en la caja» lleva nombres de clientes: el admin queda apuntado (docs/RGPD.md, 6.9).
  await apuntarEntradaAdmin(sesion, slug, "Caja");

  let n;
  let visto;
  try {
    [n, visto] = await Promise.all([negocioDePeticion(slug), recorridoVisto(sesion, "caja")]);
  } catch (e) {
    console.error(`[caja ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();
  // Solo con alguien en la plantilla (y encendida) hay que preguntar quién atiende.
  const conPlantilla = empleadosActivos(plantillaDeCaja(n)).length > 0;
  return <Caja inicial={negocioDelPersonal(n)} conPlantilla={conPlantilla} recorridoVisto={visto} />;
}
