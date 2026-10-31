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
  /* Un botón que espera al servidor lleva aria-busy: gira a la izquierda del texto y no
     se ve apagado. Con mala cobertura, un botón gris y quieto parecía la página rota. */
  /* Donde el giro no va junto al texto (subir una imagen), un <span className="giro">. */
  button[aria-busy="true"] { cursor: progress !important; opacity: 1 !important; }
  /* Dos reglas iguales y no una lista: un navegador sin :has() tiraría la lista entera. */
  .giro {
    display: inline-block; flex-shrink: 0; width: 1em; height: 1em; vertical-align: -0.15em;
    border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent;
    animation: espera 0.7s linear infinite; }
  button[aria-busy="true"]:not(:has(.giro))::before {
    content: ""; margin-right: 0.5em;
    display: inline-block; flex-shrink: 0; width: 1em; height: 1em; vertical-align: -0.15em;
    border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent;
    animation: espera 0.7s linear infinite; }
  @keyframes espera { to { transform: rotate(360deg) } }
  @media (prefers-reduced-motion: reduce) { .giro { animation-duration: 1.6s } }
  @media (prefers-reduced-motion: reduce) { button[aria-busy="true"]::before { animation-duration: 1.6s } }
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
