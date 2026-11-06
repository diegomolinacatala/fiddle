"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// LA PANTALLA ABIERTA SE PONE AL DÍA SOLA
// ----------------------------------------------------------------------------
// Cada `cada` ms (medio minuto), y al volver a la pestaña, pregunta a `url` por
// la huella de la tienda (/api/crm/huella: tres consultas de una fila). Solo si
// es otra que la de lo que se ve llama a `alCambiar`, que pide los datos enteros.
// Así una pantalla abierta toda la mañana son dos peticiones pequeñas por
// minuto, no el CRM entero cada vez.
//
// Con la pantalla oculta (otra pestaña, el móvil bloqueado) no pregunta: al
// volver, pregunta enseguida. Si la sesión se cae (401/403), deja de preguntar.
// ============================================================================

export function useEnVivo({ url, huella, alCambiar, cada = 30000, activo = true }) {
  const vista = useRef(huella);
  vista.current = huella;
  const aviso = useRef(alCambiar);
  aviso.current = alCambiar;

  useEffect(() => {
    if (!activo || !url) return undefined;
    let parado = false;
    let enCurso = false;
    let ultima = Date.now();
    let reloj = 0;

    async function preguntar() {
      if (parado || enCurso || document.visibilityState !== "visible") return;
      enCurso = true;
      ultima = Date.now();
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.status === 401 || r.status === 403) { parado = true; return; }
        if (!r.ok) return;
        const { huella: nueva } = await r.json();
        if (nueva && nueva !== vista.current) await aviso.current(nueva);
      } catch {
        // Sin red: lo que se ve sigue valiendo, y se vuelve a preguntar en la siguiente.
      } finally {
        enCurso = false;
      }
    }
    const programar = () => { clearTimeout(reloj); reloj = setTimeout(async () => { await preguntar(); if (!parado) programar(); }, cada); };
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima > cada / 2) preguntar();
      programar();
    };
    programar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      parado = true;
      clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [url, cada, activo]);
}
