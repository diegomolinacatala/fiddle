import PwaRegister from "@/app/pwa-register";
import { negocioDePeticion, sesionDePeticion } from "./negocioDePeticion";
import { puedeAcceder } from "@/lib/auth";
import MarcoGestion from "./MarcoGestion";
import { conPlantilla } from "@/lib/plantilla";

const leerNegocio = (slug) => negocioDePeticion(slug).catch(() => null);
import { ICONOS_WEB, appleWebApp } from "@/lib/marcaFiddle";
import { CAPTURAR_INSTALAR } from "@/app/temprano";

// Cada negocio es su propia app instalable (su manifest), pero guardada en el
// móvil es fiddle: el violín y «fiddle» bajo el icono (lib/marcaFiddle.js).
export async function generateMetadata({ params }) {
  const { negocio } = await params;
  const n = await leerNegocio(negocio);
  if (!n) return { title: "fiddle" };
  return {
    title: n.nombre,
    manifest: `/api/manifest?b=${negocio}`,
    appleWebApp: appleWebApp("black-translucent"),
    icons: ICONOS_WEB,
  };
}

export async function generateViewport({ params }) {
  const { negocio } = await params;
  const n = await leerNegocio(negocio);
  return { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: n?.tema?.accent };
}

export default async function NegocioLayout({ children, params }) {
  const { negocio: slug } = await params;
  const [n, sesion] = await Promise.all([leerNegocio(slug), sesionDePeticion().catch(() => null)]);
  // La cabecera del dueño, solo a quien puede entrar: al resto la página le manda al login.
  const cabecera = n && puedeAcceder(sesion, slug, "manager")
    ? { nombre: n.nombre, tema: n.tema, avisosAvanzados: n.avisosAvanzados === true, plantillaActiva: conPlantilla(n) }
    : null;
  return (
    <>
      {/* Para ofrecer "Instalar la caja" en Android: Chrome lo avisa una sola vez. */}
      <script dangerouslySetInnerHTML={{ __html: CAPTURAR_INSTALAR }} />
      <PwaRegister />
      <MarcoGestion slug={slug} negocio={cabecera}>{children}</MarcoGestion>
    </>
  );
}
