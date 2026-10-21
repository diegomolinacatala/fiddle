import { Geist } from "next/font/google";
import { appUrl } from "@/lib/url";
import { PALETA } from "./paleta";
import { ICONOS_WEB, rutaMarca } from "@/lib/marcaFiddle";

// La letra de la web, solo aquí: el resto de la app sigue con la del sistema.
// next/font la descarga al compilar y la sirve desde el propio dominio, que es lo
// único que deja la CSP (font-src 'self').
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--fuente-web" });

const DESCRIPCION =
  "Tarjetas de fidelización para cafeterías en Apple Wallet y Android. Tus clientes la guardan con un escaneo y tú sumas puntos desde el móvil de la tienda.";

export const metadata = {
  metadataBase: new URL(appUrl()),
  title: "fiddle, tarjetas de fidelización en el móvil",
  description: DESCRIPCION,
  alternates: { canonical: "/home" },
  icons: ICONOS_WEB,
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/home",
    siteName: "fiddle",
    title: "fiddle, clientes que no se pierden",
    description: DESCRIPCION,
    images: [{ url: rutaMarca("fiddle-og.png"), width: 1200, height: 630, alt: "fiddle, tarjetas de fidelización en el móvil" }],
  },
};

// viewportFit cover: la barra de WhatsApp del móvil se apoya en el borde de abajo
// y respeta la raya del iPhone con env(safe-area-inset-bottom), que sin esto vale 0.
export const viewport = { themeColor: PALETA.papel, viewportFit: "cover" };

export default function LayoutHome({ children }) {
  return <div className={geist.variable}>{children}</div>;
}
