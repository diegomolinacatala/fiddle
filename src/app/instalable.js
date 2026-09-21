"use client";

import { useEffect, useState } from "react";

// ============================================================================
// "INSTALAR" EN ANDROID
// ----------------------------------------------------------------------------
// Lee el aviso de Chrome que recoge CAPTURAR_INSTALAR (app/temprano.js) en
// cuanto carga la página. Lo usan la tarjeta del cliente y la caja de la tienda.
// ============================================================================

/** ¿Se puede instalar como app, y está ya instalada? */
export function useInstalar() {
  const [evento, setEvento] = useState(null);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    setInstalada(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
    if (window.__instalar) setEvento(window.__instalar);
    const alPoder = () => setEvento(window.__instalar || null);
    const alInstalar = () => { setInstalada(true); setEvento(null); };
    window.addEventListener("instalable", alPoder);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("instalable", alPoder);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const instalar = async () => {
    if (!evento) return;
    evento.prompt();
    const { outcome } = await evento.userChoice;
    window.__instalar = null;
    setEvento(null);
    if (outcome === "accepted") setInstalada(true);
  };

  return { puede: Boolean(evento), instalada, instalar };
}
