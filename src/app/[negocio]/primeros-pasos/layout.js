import { fuenteWeb } from "@/app/fuenteWeb";
import { fuentePase } from "@/app/fuentePase";

// Los primeros pasos llevan la letra de la web (como la demo) y la del pase.
export default function LayoutPrimerosPasos({ children }) {
  return <div className={`${fuenteWeb.variable} ${fuentePase.variable}`}>{children}</div>;
}
