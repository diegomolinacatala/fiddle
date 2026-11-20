import { Geist } from "next/font/google";
import { PALETA } from "@/app/home/paleta";

// La misma letra que la web de venta (home/layout.js): next/font la sirve desde el
// propio dominio, que es lo único que deja la CSP.
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--fuente-web" });

export const viewport = { themeColor: PALETA.papel };

export default function LayoutAlta({ children }) {
  return <div className={geist.variable}>{children}</div>;
}
