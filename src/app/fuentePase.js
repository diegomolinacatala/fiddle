import { Inter } from "next/font/google";

// Inter, para pintar el pase donde no hay San Francisco (FUENTE_PASE en
// lib/vistaWallet.js). Sin precarga a propósito: en un iPhone o un Mac gana la letra
// del sistema y el archivo ni se pide. Las páginas del cliente (/p, la tienda) no la
// cargan: ahí cuenta cada KB y en Android la del sistema ya es la de su teléfono.
export const fuentePase = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--fuente-pase" });
