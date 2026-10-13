"use client";

import { useEffect, useState } from "react";
import Icono from "@/app/Icono";
import { CLAVE_TEMA } from "@/app/temprano";
import { botonPequeno } from "@/app/ui";

// ============================================================================
// MODO OSCURO — al lado de «Salir», en todas las pantallas del personal
// ----------------------------------------------------------------------------
// Es de cada DISPOSITIVO, no de la cuenta ni de la tienda: el móvil de la caja,
// que nunca abre Ajustes, también tiene que poder cambiarlo. Por eso vive junto
// a «Salir», el único sitio que está en todas (manager, caja, admin).
// Claro de partida. Se guarda en el navegador y lo aplica TEMA_TEMPRANO al
// cargar; aquí solo se cambia el atributo de <html> y se apunta.
// ============================================================================

export default function BotonTema() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.dataset.tema === "oscuro"), []);

  function cambiar() {
    const siguiente = !oscuro;
    setOscuro(siguiente);
    if (siguiente) document.documentElement.dataset.tema = "oscuro";
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem(CLAVE_TEMA, siguiente ? "oscuro" : "claro"); } catch { /* sin almacén: dura hasta recargar */ }
  }

  const texto = oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro";
  return (
    <button type="button" onClick={cambiar} aria-pressed={oscuro} aria-label="Modo oscuro" title={texto}
      style={{ ...botonPequeno, flexShrink: 0, padding: "0.4rem 0.55rem", display: "inline-flex", alignItems: "center" }}>
      <Icono nombre={oscuro ? "sol" : "luna"} tam={16} />
    </button>
  );
}
