import { Geist } from "next/font/google";
import { appUrl } from "@/lib/url";

// La letra de la web, solo aquí: el resto de la app sigue con la del sistema.
// next/font la descarga al compilar y la sirve desde el propio dominio, que es lo
// único que deja la CSP (font-src 'self').
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--fuente-web" });

const DESCRIPCION =
  "Tarjetas de fidelización para cafeterías en Apple Wallet y Android. Tus clientes la guardan con un escaneo y tú sumas sellos desde el móvil de la tienda.";

export const metadata = {
  metadataBase: new URL(appUrl()),
  title: "fiddle, tarjetas de fidelización en el móvil",
  description: DESCRIPCION,
  alternates: { canonical: "/home" },
  icons: { icon: "/marcas/fiddle.svg", apple: "/marcas/fiddle-180.png" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/home",
    siteName: "fiddle",
    title: "fiddle, sellos que no se pierden",
    description: DESCRIPCION,
    images: [{ url: "/marcas/fiddle-og.png", width: 1200, height: 630, alt: "fiddle, tarjetas de fidelización en el móvil" }],
  },
};

export const viewport = { themeColor: "#f6f4ef" };

export default function LayoutHome({ children }) {
  return <div className={geist.variable}>{children}</div>;
}
