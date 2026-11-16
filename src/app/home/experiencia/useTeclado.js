"use client";

import { useEffect, useState } from "react";

// ¿Hay un teclado tapando parte de la pantalla? (visualViewport mide lo que queda a la vista.)
const TAPADO_MIN = 80; // px: menos es la barra del navegador, no un teclado

export default function useTeclado() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const mirar = () => setAbierto(window.innerHeight - vv.height > TAPADO_MIN);
    mirar();
    vv.addEventListener("resize", mirar);
    return () => vv.removeEventListener("resize", mirar);
  }, []);
  return abierto;
}
