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
  /* Las preguntas van en una ventana nuestra (app/Dialogo.js), nunca en la del navegador. */
  dialog.ventana::backdrop { background: rgb(15 18 22 / 0.5); }
  /* Las cifras que cambian ruedan: cada cifra nueva entra desde abajo (o desde arriba si
     baja), como un cuentakilómetros (app/Rueda.js). */
  .rueda-hueco { display: inline-block; overflow: hidden; vertical-align: bottom; line-height: 1.15; }
  .rueda-sube, .rueda-baja { display: inline-block; animation: rueda-sube 0.22s cubic-bezier(.2,.8,.3,1) both; }
  .rueda-baja { animation-name: rueda-baja; }
  @keyframes rueda-sube { from { transform: translateY(100%); opacity: 0 } }
  @keyframes rueda-baja { from { transform: translateY(-100%); opacity: 0 } }
  /* Un cliente que llega con la pantalla abierta entra en la lista y se ilumina un momento. */
  .fila-nueva { animation: fila-nueva 2.4s ease-out both; }
  .fila-nueva > td { animation: fila-entra 0.45s cubic-bezier(.2,.8,.3,1) both; }
  @keyframes fila-nueva { from { background: var(--fila-nueva, rgb(0 0 0 / 0.06)) } }
  @keyframes fila-entra { from { transform: translateY(-10px); opacity: 0 } }
  @media (prefers-reduced-motion: reduce) {
    .rueda-sube, .rueda-baja, .fila-nueva > td { animation: none; }
  }
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
