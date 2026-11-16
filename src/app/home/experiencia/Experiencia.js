"use client";

import { useEffect } from "react";
import { useTarjeta } from "./Tarjeta";
import useRuta from "./useRuta";
import Pantalla from "./Pantalla";
import Final from "./Final";

// ============================================================================
// LA EXPERIENCIA (/home)
// ----------------------------------------------------------------------------
// Una pantalla fija con la tarjeta del visitante y una pregunta cada vez
// (Pantalla.js), y al final los precios (Final.js), que son una página normal con
// scroll. El paso vive en la URL (useRuta.js): el contrato está en logica.js.
// Los precios no pintan la pantalla fija: así su `body{overflow:hidden}` (que cuelga
// de `.prob-pagina`) no los encierra.
// ============================================================================

export default function Experiencia() {
  const { guardada } = useTarjeta();
  const { paso, sentido, ir } = useRuta({ guardada });
  const enPrecios = paso === "precios";

  // Venir de una pantalla fija: la página de precios empieza arriba.
  useEffect(() => {
    if (enPrecios) window.scrollTo(0, 0);
  }, [enPrecios]);

  if (enPrecios) return <Final alVolver={() => ir("guarda")} />;
  return <Pantalla paso={paso} sentido={sentido} ir={ir} />;
}
