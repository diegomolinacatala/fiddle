import { Geist } from "next/font/google";

// La letra de la web (/home, la demo y los primeros pasos del dueño): el resto de la
// app sigue con la del sistema. next/font la descarga al compilar y la sirve desde el
// propio dominio, que es lo único que deja la CSP (font-src 'self').
export const fuenteWeb = Geist({ subsets: ["latin"], display: "swap", variable: "--fuente-web" });
