import PwaRegister from "@/app/pwa-register";
import { NEGOCIOS } from "@/lib/negocios";

// Cada negocio es su propia app instalable (manifest + icono propios).
export async function generateMetadata({ params }) {
  const { negocio } = await params;
  const n = NEGOCIOS[negocio];
  if (!n) return { title: "Sellos" };
  return {
    title: n.nombre,
    manifest: `/api/manifest?b=${negocio}`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: n.nombre },
    icons: { apple: `/icons/${negocio}-180.png` },
  };
}

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function NegocioLayout({ children }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
