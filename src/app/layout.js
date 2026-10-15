import { C, hojaDeColores } from "./ui";
import { TEMA_TEMPRANO } from "./temprano";
import { ICONOS_WEB, appleWebApp } from "@/lib/marcaFiddle";

export const metadata = {
  title: "fiddle",
  description: "Tarjetas de fidelización en Apple Wallet y Android",
  icons: ICONOS_WEB,
  appleWebApp: appleWebApp(),
};

export const viewport = { width: "device-width", initialScale: 1 };

// Base para toda la app. Lo que se repetía en cada pantalla (caja de los
// elementos, tipografía de inputs, foco visible) se pone una sola vez aquí, con
// los colores de día y de noche (ui.js).
const base = `${hojaDeColores}
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: ${C.fondo}; color: ${C.texto};
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         -webkit-font-smoothing: antialiased; }
  input, button, textarea, select { font: inherit; }
  a { color: inherit; }
  :focus-visible { outline: 2px solid ${C.azul}; outline-offset: 2px; }
  summary { list-style-position: outside; }
`;

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: TEMA_TEMPRANO pone data-tema antes de React, a propósito.
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_TEMPRANO }} />
        <style>{base}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
