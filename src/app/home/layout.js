import { Geist } from "next/font/google";
import { appUrl } from "@/lib/url";
import { PALETA } from "./paleta";

// La letra de la web, solo aquí: el resto de la app sigue con la del sistema.
// next/font la descarga al compilar y la sirve desde el propio dominio, que es lo
// único que deja la CSP (font-src 'self').
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--fuente-web" });

const VERSION_IMAGENES = "violin";

const DESCRIPCION =
  "Tarjetas de fidelización para cafeterías en Apple Wallet y Android. Tus clientes la guardan con un escaneo y tú sumas sellos desde el móvil de la tienda.";

export const metadata = {
  metadataBase: new URL(appUrl()),
  title: "fiddle, tarjetas de fidelización en el móvil",
  description: DESCRIPCION,
  alternates: { canonical: "/home" },
  // ?v=: WhatsApp y los navegadores guardan estas imágenes por URL; al cambiar el
  // dibujo (scripts/gen-marca-web.mjs), se sube la versión.
  icons: { icon: `/marcas/fiddle.svg?v=${VERSION_IMAGENES}`, apple: `/marcas/fiddle-180.png?v=${VERSION_IMAGENES}` },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/home",
    siteName: "fiddle",
    title: "fiddle, clientes que no se pierden",
    description: DESCRIPCION,
    images: [{ url: `/marcas/fiddle-og.png?v=${VERSION_IMAGENES}`, width: 1200, height: 630, alt: "fiddle, tarjetas de fidelización en el móvil" }],
  },
};

export const viewport = { themeColor: PALETA.papel };

export default function LayoutHome({ children }) {
  return <div className={geist.variable}>{children}</div>;
}
