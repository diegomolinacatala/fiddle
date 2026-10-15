"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cuentaSinTocar, SEGUNDOS_AVISO, TOQUES } from "@/lib/sinTocar";
import Icono from "@/app/Icono";
import { C, legible } from "@/app/ui";

// ============================================================================
// SIN TOCARLA, LA FICHA VUELVE AL ESCÁNER (lib/sinTocar.js)
// ----------------------------------------------------------------------------
// Escucha toques, scroll y teclado en toda la página. La cuenta es pura
// (`cuentaSinTocar`) y un solo temporizador la mira cuando le toca cambiar de
// fase: un toque solo apunta la hora, y al mirar la cuenta ya ha vuelto a empezar.
//
// Los últimos segundos, arriba del todo, una barra que se vacía y «Volviendo al
// escáner». Al llegar a cero, `prepararSalida` (TarjetaCaja) vacía la fila por
// el camino normal; si alguien toca mientras tanto, o algo no se guardó, se
// queda y la cuenta vuelve a empezar. Se va con `replace`: «atrás» no devuelve
// a la ficha que se quería dejar.
// ============================================================================

// Lo que tarda la pastilla en quitarse tras un toque. Mientras, sigue recogiendo
// toques aunque ya no se vea: si desapareciera en el acto, el mismo dedo caería
// en lo que haya debajo (un «Añadir sello», con la página bajada).
const MS_CIERRE = 400;

export default function VueltaSinTocar({ destino, accent, prepararSalida }) {
  const router = useRouter();
  const [aviso, setAviso] = useState(null); // { quedan } mientras se ve la barra
  const [cerrando, setCerrando] = useState(false);
  // La de este render: la ficha la crea de nuevo en cada uno, y la cuenta no debe empezar otra vez por eso.
  const preparar = useRef(prepararSalida);
  useEffect(() => { preparar.current = prepararSalida; });

  useEffect(() => {
    let ultimo = Date.now();
    let avisando = false;
    let saliendo = false;
    let viva = true;
    let temporizador = null;
    let cierre = null;

    function mirar() {
      clearTimeout(temporizador);
      if (saliendo) return;
      const c = cuentaSinTocar(ultimo, Date.now());
      if (c.fase === "salir") {
        salir();
        return;
      }
      if (c.fase === "aviso" && !avisando) {
        avisando = true;
        clearTimeout(cierre);
        setCerrando(false);
        setAviso({ quedan: c.quedan });
      }
      temporizador = setTimeout(mirar, c.mirar);
    }

    async function salir() {
      saliendo = true;
      const desde = ultimo;
      const puede = await preparar.current();
      if (!viva) return;
      if (puede && ultimo === desde) {
        router.replace(destino);
        return;
      }
      saliendo = false;
      // Algo no se guardó: su aviso se queda a la vista otra cuenta entera.
      if (ultimo === desde) ultimo = Date.now();
      quitarAviso();
      mirar();
    }

    function quitarAviso() {
      if (!avisando) return;
      avisando = false;
      setCerrando(true);
      clearTimeout(cierre);
      cierre = setTimeout(() => {
        setAviso(null);
        setCerrando(false);
      }, MS_CIERRE);
    }

    function tocar() {
      ultimo = Date.now();
      quitarAviso();
    }

    // Con la pantalla apagada los temporizadores se duermen: al volver, se mira en el acto.
    const alVolver = () => { if (document.visibilityState === "visible") mirar(); };
    const opciones = { capture: true, passive: true };
    for (const ev of TOQUES) document.addEventListener(ev, tocar, opciones);
    document.addEventListener("visibilitychange", alVolver);
    mirar();
    return () => {
      viva = false;
      clearTimeout(temporizador);
      clearTimeout(cierre);
      for (const ev of TOQUES) document.removeEventListener(ev, tocar, opciones);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [destino, router]);

  if (!aviso) return null;
  const total = SEGUNDOS_AVISO * 1000;
  return (
    <div role="status" style={capa}>
      <style>{CSS}</style>
      <div aria-hidden="true" style={pista}>
        {/* Si el aviso empezó tarde (la pantalla estuvo apagada), la barra arranca ya mermada. */}
        <div className="caja-sin-tocar" style={{ height: "100%", background: accent, animationDuration: `${total}ms`, animationDelay: `${aviso.quedan - total}ms` }} />
      </div>
      {/* Tocarla es tocar la ficha: la cuenta ya se para con el toque, el botón no hace nada más. */}
      <button type="button" style={{ ...pastilla, opacity: cerrando ? 0 : 1 }}>
        <Icono nombre="camara" tam={16} />
        <span>Volviendo al escáner</span>
        <span style={{ color: legible(accent), fontWeight: 650, textDecoration: "underline" }}>Quedarme aquí</span>
      </button>
    </div>
  );
}

const CSS = `
@keyframes caja-sin-tocar { from { transform: scaleX(1) } to { transform: scaleX(0) } }
.caja-sin-tocar { transform-origin: left; animation: caja-sin-tocar linear forwards; }
@media (prefers-reduced-motion: reduce) { .caja-sin-tocar { animation: none } }
`;

// Por encima de todo y sin ocupar sitio: lo de debajo no se mueve. Solo la pastilla recoge toques.
const capa = {
  position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
  paddingTop: "env(safe-area-inset-top, 0px)",
  display: "flex", flexDirection: "column", alignItems: "center",
  pointerEvents: "none",
};
const pista = { alignSelf: "stretch", height: 4, background: C.borde };
const pastilla = {
  pointerEvents: "auto", margin: "10px 16px 0", maxWidth: "calc(100% - 32px)",
  display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center",
  padding: "8px 14px", borderRadius: 999, cursor: "pointer",
  border: `1px solid ${C.borde}`, background: C.panel, color: C.texto,
  boxShadow: "0 6px 18px rgba(16,20,28,.16)",
  font: "inherit", fontSize: 13, fontWeight: 500,
  transition: "opacity 150ms ease",
};
