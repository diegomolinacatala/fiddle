import PwaRegister from "@/app/pwa-register";
import { negocioDePeticion, sesionDePeticion } from "./negocioDePeticion";
import { puedeAcceder } from "@/lib/auth";
import MarcoGestion from "./MarcoGestion";

const leerNegocio = (slug) => negocioDePeticion(slug).catch(() => null);
import { rutaIcono } from "@/lib/rutasImagen";
import { CAPTURAR_INSTALAR } from "@/app/temprano";

// Cada negocio es su propia app instalable (manifest + icono propios). El icono
// sale de su marca: una tienda nueva lo tiene sin que nadie dibuje nada.
export async function generateMetadata({ params }) {
  const { negocio } = await params;
  const n = await leerNegocio(negocio);
  if (!n) return { title: "fiddle" };
  return {
    title: n.nombre,
    manifest: `/api/manifest?b=${negocio}`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: n.nombre },
    icons: { icon: rutaIcono(n, 192), apple: rutaIcono(n, 180) },
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
    ? { nombre: n.nombre, tema: n.tema, avisosAvanzados: n.avisosAvanzados === true }
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
