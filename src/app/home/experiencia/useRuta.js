"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { pasoDeHash, indiceDe, hashDe, anteriorDe } from "./logica";

// ============================================================================
// EL PASO VIVE EN LA URL
// ----------------------------------------------------------------------------
// Avanzar hace pushState: el botón atrás del navegador (o del móvil) vuelve un
// paso, y recargar deja en el mismo. A los precios no se entra por URL sin haber
// pasado por `guarda` en esta visita: `vistoGuarda` lo recuerda.
// El servidor pinta `hola` y el hash se lee antes de pintar en el navegador.
// ============================================================================

const urlDe = (id) => `${window.location.pathname}${window.location.search}${hashDe(id)}`;
const sentidoEntre = (de, a) => (indiceDe(a) >= indiceDe(de) ? 1 : -1);

export default function useRuta({ guardada }) {
  const [ruta, setRuta] = useState({ paso: "hola", sentido: 1 });
  const actual = useRef("hola");
  const vistoGuarda = useRef(false);
  const puedePrecios = () => vistoGuarda.current || Boolean(guardada);

  const poner = useCallback((id) => {
    if (id === "guarda" || id === "precios") vistoGuarda.current = true;
    const sentido = sentidoEntre(actual.current, id);
    actual.current = id;
    setRuta({ paso: id, sentido });
  }, []);

  // Recargar o entrar con un hash: sin historial nuevo, solo se corrige la barra si hace falta.
  useLayoutEffect(() => {
    const id = pasoDeHash(window.location.hash, { puedePrecios: false });
    poner(id);
    if (hashDe(id) !== window.location.hash) window.history.replaceState(null, "", urlDe(id));
  }, [poner]);

  useEffect(() => {
    const alVolver = () => poner(pasoDeHash(window.location.hash, { puedePrecios: puedePrecios() }));
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
    // `puedePrecios` lee refs y `guardada`: se vuelve a atar si cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poner, guardada]);

  const ir = useCallback((id) => {
    if (!id || id === actual.current) return;
    window.history.pushState(null, "", urlDe(id));
    poner(id);
  }, [poner]);

  const atras = useCallback(() => ir(anteriorDe(actual.current)), [ir]);

  return { paso: ruta.paso, sentido: ruta.sentido, ir, atras };
}
