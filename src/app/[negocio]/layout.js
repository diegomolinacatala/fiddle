import PwaRegister from "@/app/pwa-register";
import { getNegocio } from "@/lib/store";
import { rutaIcono } from "@/lib/rutasImagen";
import { CAPTURAR_INSTALAR } from "@/app/temprano";

// Cada negocio es su propia app instalable (manifest + icono propios). El icono
// sale de su marca: una tienda nueva lo tiene sin que nadie dibuje nada.
export async function generateMetadata({ params }) {
  const { negocio } = await params;
  const n = await getNegocio(negocio).catch(() => null);
  if (!n) return { title: "Sellos" };
  return {
    title: n.nombre,
    manifest: `/api/manifest?b=${negocio}`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: n.nombre },
    icons: { icon: rutaIcono(n, 192), apple: rutaIcono(n, 180) },
  };
}

export async function generateViewport({ params }) {
  const { negocio } = await params;
  const n = await getNegocio(negocio).catch(() => null);
  return { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: n?.tema?.accent };
}

export default function NegocioLayout({ children }) {
  return (
    <>
      {/* Para ofrecer "Instalar la caja" en Android: Chrome lo avisa una sola vez. */}
      <script dangerouslySetInnerHTML={{ __html: CAPTURAR_INSTALAR }} />
      <PwaRegister />
      {children}
    </>
  );
}
