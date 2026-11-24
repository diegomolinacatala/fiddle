"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ============================================================================
// EL CARTEL PARA IMPRIMIR (A5 vertical)
// ----------------------------------------------------------------------------
// Va colgado de <body> y solo se ve al imprimir: en @media print (estiloQr.js)
// todo lo demás de la página se oculta. Colgarlo de body, y no dentro de la
// página, evita pelear con el `overflow:hidden` y la altura fija de la demo.
// Tampoco hereda las variables de `.prob`: lleva su color puesto.
// ============================================================================

export default function CartelImpreso({ nombre, qrSrc, tono }) {
  const [raiz, setRaiz] = useState(null);
  useEffect(() => { setRaiz(document.body); }, []);
  if (!raiz) return null;
  return createPortal(
    <div className="pp-qr-impresion" style={{ "--tono-impreso": tono }} aria-hidden="true">
      <div className="pp-qr-imp-banda" />
      <h1>{nombre}</h1>
      <img src={qrSrc} alt="" width="640" height="640" />
      <p className="pp-qr-imp-frase">Escanea y llévate tu tarjeta</p>
      <p className="pp-qr-imp-pie">Sin apps. Apple Wallet y Android.</p>
    </div>,
    raiz,
  );
}
