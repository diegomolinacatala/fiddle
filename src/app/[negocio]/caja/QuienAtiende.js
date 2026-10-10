"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { C, panel, botonPrimario, botonSecundario, RADIO } from "@/app/ui";

// ============================================================================
// ¿QUIÉN ATIENDE? Lo primero que ve la caja cada día en cada móvil.
// ----------------------------------------------------------------------------
// La cuenta de la caja la comparten; esto pone nombre a cada sello. Si ayer en
// este móvil era Sebas, se le propone con un toque («Sí, soy Sebas») y la lista
// queda detrás de «Soy otra persona». Sin PIN: es el móvil de cada uno.
// ============================================================================

/**
 * @param {{plantilla:{id:string,nombre:string}[], ultimo:{id:string,nombre:string}|null, accent:string, onElegir:(e:object)=>void, ocupado?:boolean}} props
 */
export default function QuienAtiende({ plantilla, ultimo, accent, onElegir, ocupado = false }) {
  const [otros, setOtros] = useState(!ultimo);
  const proponer = ultimo && !otros;

  return (
    <section style={{ ...panel, padding: 20 }} aria-labelledby="quien-titulo">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: RADIO.boton, background: `${accent}14`, color: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icono nombre="credencial" tam={22} />
        </span>
        <div>
          <h2 id="quien-titulo" style={{ fontSize: 18, fontWeight: 650, margin: 0 }}>
            {proponer ? `¿Sigues siendo ${ultimo.nombre}?` : "¿Quién atiende?"}
          </h2>
          <p style={{ fontSize: 13, color: C.suave, margin: "2px 0 0" }}>Cada sello se apunta a tu nombre. Se pregunta una vez al día en cada móvil.</p>
        </div>
      </div>

      {proponer ? (
        <div style={{ marginTop: 18 }}>
          <button type="button" disabled={ocupado} onClick={() => onElegir(ultimo)} style={{ ...botonPrimario(accent), width: "100%", minHeight: 58, fontSize: 17 }}>
            Sí, soy {ultimo.nombre}
          </button>
          <button type="button" disabled={ocupado} onClick={() => setOtros(true)} style={{ ...botonSecundario, width: "100%", marginTop: 10, minHeight: 46 }}>
            Soy otra persona
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {plantilla.map((e) => (
            <button key={e.id} type="button" disabled={ocupado} onClick={() => onElegir(e)} style={botonNombre(accent)}>
              <span style={{ flex: 1, textAlign: "left" }}>{e.nombre}</span>
              <Icono nombre="check" tam={20} grosor={2.2} style={{ opacity: 0.55 }} />
            </button>
          ))}
          {ultimo && (
            <button type="button" onClick={() => setOtros(false)} style={{ ...botonSecundario, border: 0, background: "transparent", color: C.suave, marginTop: 4 }}>
              Volver
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const botonNombre = (accent) => ({
  ...botonSecundario,
  display: "flex", alignItems: "center", gap: 10,
  minHeight: 56, fontSize: 17, fontWeight: 600, padding: "0 16px",
  borderColor: `${accent}55`, borderRadius: RADIO.fila,
});
