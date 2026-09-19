import { C } from "./ui";

export const metadata = {
  title: "Sellos",
  description: "Tarjetas de fidelización en Wallet — multi-negocio",
};

export const viewport = { width: "device-width", initialScale: 1 };

// Base clara para toda la app. Lo que se repetía en cada pantalla (caja de los
// elementos, tipografía de inputs, foco visible) se pone una sola vez aquí.
const base = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: ${C.fondo}; color: ${C.texto};
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         -webkit-font-smoothing: antialiased; }
  input, button, textarea, select { font: inherit; }
  a { color: inherit; }
  :focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  summary { list-style-position: outside; }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head><style>{base}</style></head>
      <body>{children}</body>
    </html>
  );
}
