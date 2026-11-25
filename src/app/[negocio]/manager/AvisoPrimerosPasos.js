"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { PASOS, avanceDe, mostrarAviso, conOculto } from "@/lib/primerosPasos";
import { C, panel, botonPrimario, RADIO, legible, tinte } from "@/app/ui";

// ============================================================================
// EL AVISO DE LOS PRIMEROS PASOS, ARRIBA DE TIENDA
// ----------------------------------------------------------------------------
// Para quien dejó los primeros pasos para luego: cuánto lleva (cinco tramos, uno
// por paso), cuál toca y UN botón para seguir justo ahí. Se va solo al terminar.
//
// Quien ya lo ha tocado todo por su cuenta lo quita con la X: se oculta al
// momento, con «Deshacer» unos segundos, y queda en Ajustes → Primeros pasos.
// Sale solo en Tienda (lo primero que se ve al entrar), no en cada pestaña.
// ============================================================================

const SEGUNDOS_DESHACER = 6;

export default function AvisoPrimerosPasos({ slug, negocio, accent, onCambio }) {
  const [deshacer, setDeshacer] = useState(false);
  const temporizador = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const avance = avanceDe(negocio);

  async function ocultar(oculto) {
    // Al momento, sin esperar al servidor; si falla, vuelve a como estaba.
    const antes = negocio.primerosPasos;
    onCambio(conOculto(antes, oculto));
    clearTimeout(temporizador.current);
    setDeshacer(oculto);
    if (oculto) temporizador.current = setTimeout(() => setDeshacer(false), SEGUNDOS_DESHACER * 1000);
    try {
      const r = await fetch(`/api/primeros-pasos?b=${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oculto }),
      });
      if (!r.ok) throw new Error();
    } catch {
      onCambio(antes);
      setDeshacer(false);
    }
  }

  if (!mostrarAviso(negocio)) {
    return deshacer ? (
      <div role="status" style={toast}>
        <span>Oculto. Lo tienes en Ajustes.</span>
        <button type="button" onClick={() => ocultar(false)} style={botonToast}>Deshacer</button>
      </div>
    ) : null;
  }

  const siguiente = PASOS.find((p) => p.id === avance.siguiente);
  const quedan = avance.total - avance.hechos.length;
  return (
    <section aria-labelledby="pp-aviso-titulo" className="ppa" style={{ ...panel, marginTop: 20 }}>
      <style>{CSS}</style>
      <div className="ppa-cab">
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: RADIO.boton, background: tinte(accent, 9), color: legible(accent), display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icono nombre="brote" tam={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 id="pp-aviso-titulo" style={{ fontSize: 15.5, fontWeight: 650, margin: 0 }}>Pon en marcha tu tarjeta</h2>
          <p style={{ fontSize: 13.5, color: C.suave, margin: "2px 0 0", lineHeight: 1.35 }}>
            {quedan === 1 ? "Te queda uno" : `Te quedan ${quedan}`}: {siguiente.nombre.charAt(0).toLowerCase() + siguiente.nombre.slice(1)}
          </p>
        </div>
      </div>

      <ol aria-label={`${avance.hechos.length} de ${avance.total} hechos`} className="ppa-tramos">
        {PASOS.map((p) => {
          const hecho = avance.hechos.includes(p.id);
          const ahora = p.id === avance.siguiente;
          return (
            <li key={p.id} style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span aria-hidden style={{ height: 5, borderRadius: 99, background: hecho ? accent : ahora ? tinte(accent, 35) : C.borde }} />
              <span className="ppa-nombre" style={{ fontWeight: ahora ? 650 : 500, color: hecho || ahora ? C.texto : C.suave }}>
                {p.corto}
                <span style={srSolo}>{hecho ? ", hecho" : ", pendiente"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <a href={`/${slug}/primeros-pasos#${avance.siguiente}`} className="ppa-seguir" style={{ ...botonPrimario(accent), textDecoration: "none" }}>
        Seguir <Icono nombre="adelante" tam={16} />
      </a>

      <button type="button" onClick={() => ocultar(true)} aria-label="Ocultar los primeros pasos" title="Ocultar" style={cerrar}>
        <Icono nombre="cerrar" tam={18} />
      </button>
    </section>
  );
}

// En el móvil, uno debajo de otro; con sitio, una franja: lo que falta, el progreso y el
// botón en línea (a todo el ancho quedaba medio vacío). La X, siempre arriba a la derecha.
const CSS = `
.ppa{position:relative;display:grid;gap:14px;padding:16px 56px 16px 16px!important;animation:ppa-entra .4s cubic-bezier(.16,1,.3,1) both}
.ppa-cab{display:flex;gap:12px;align-items:center;min-width:0}
.ppa-tramos{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:0;padding:0;list-style:none}
.ppa-nombre{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* En un móvil estrecho los cinco nombres no caben: los tramos solos (los nombres quedan para el lector de pantalla) y la frase dice cuál toca. */
@media (max-width:399.98px){.ppa-nombre{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
.ppa-seguir{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;justify-self:start}
@media (min-width:760px){
  .ppa{grid-template-columns:minmax(0,auto) minmax(200px,1fr) auto;align-items:center;gap:28px}
  .ppa-tramos{max-width:520px}
}
@keyframes ppa-entra{from{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){.ppa{animation:none}}
`;

const cerrar = {
  position: "absolute", top: 8, right: 8, width: 40, height: 40, display: "grid", placeItems: "center", padding: 0,
  border: 0, borderRadius: RADIO.boton, background: "none", color: C.suave, cursor: "pointer",
};
const srSolo = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 20,
  display: "flex", alignItems: "center", gap: 14, width: "max-content", background: C.toastFondo, color: C.toastTexto, padding: "8px 8px 8px 16px", borderRadius: 10,
  fontWeight: 500, fontSize: 14, maxWidth: "calc(100vw - 32px)", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
const botonToast = { border: 0, background: "none", color: "inherit", fontWeight: 650, fontSize: 14, padding: "8px 10px", minHeight: 40, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 };
