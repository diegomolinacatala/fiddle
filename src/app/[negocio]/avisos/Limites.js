"use client";

import { useState } from "react";
import { MAX_PAUSA, LIMITE_DIA } from "@/lib/automatizaciones";
import { C, panel, campo, h2, botonPequeno } from "@/app/ui";

// ============================================================================
// PARA NO CANSAR A NADIE: los dos topes que valen para TODO lo que sale solo
// (automáticos y programados), y lo que ponen Apple y Google por su cuenta.
// Dos números y ya: la pausa entre avisos y cuántos al día como mucho.
// ============================================================================

export default function Limites({ negocio: n, ocupado, guardar, flash, children }) {
  const [pausa, setPausa] = useState(n.pausaAvisos);
  const [dia, setDia] = useState(n.limiteAvisosDia ?? LIMITE_DIA.def);
  const cambiado = (pausa !== "" && Number(pausa) !== n.pausaAvisos) || dia !== n.limiteAvisosDia;

  return (
    <section style={{ ...panel, background: C.panelSuave }}>
      <h2 style={h2}>Para no cansar a nadie</h2>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.suave, lineHeight: 1.6 }}>
        {children}
        <li>Solo les llega a quienes tienen la tarjeta en el teléfono.</li>
        <li>En la tarjeta cabe <strong style={{ color: C.texto }}>un mensaje</strong>: uno nuevo tapa al anterior.</li>
      </ul>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await guardar({ pausaAvisos: pausa === "" ? n.pausaAvisos : pausa, limiteAvisosDia: dia })) flash("Límites guardados");
        }}
        style={{ display: "grid", gap: 10, marginTop: 14, fontSize: 14 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label htmlFor="pausa">Entre dos avisos a la misma persona, al menos</label>
          <input id="pausa" type="number" min={0} max={MAX_PAUSA} value={pausa}
            onChange={(e) => setPausa(e.target.value === "" ? "" : Number(e.target.value))} style={{ ...campo, width: 70 }} />
          <span>días</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Y como mucho</span>
          <div role="radiogroup" aria-label="Avisos al día" style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: LIMITE_DIA.max - LIMITE_DIA.min + 1 }, (_, i) => LIMITE_DIA.min + i).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={dia === v} onClick={() => setDia(v)} style={{
                width: 38, height: 34, borderRadius: 8, cursor: "pointer", fontWeight: 650,
                border: `1px solid ${dia === v ? n.tema.accent : C.borde}`, background: dia === v ? `${n.tema.accent}14` : "#fff",
                color: dia === v ? n.tema.accent : C.texto,
              }}>{v}</button>
            ))}
          </div>
          <span>al día.</span>
          {cambiado && <button type="submit" disabled={ocupado} style={botonPequeno}>Guardar</button>}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: C.tenue, lineHeight: 1.5 }}>
          Cuentan también los que mandes a mano. Un aviso programado puede saltarse la pausa (se elige en él), pero
          nunca el máximo del día. <strong style={{ color: C.suave }}>Google Wallet</strong> suena como mucho 3 veces al
          día por tarjeta: los que pasen de ahí llegan en silencio. <strong style={{ color: C.suave }}>Apple</strong> no
          pone tope, pero una tarjeta que suena mucho se silencia o se borra.
        </p>
      </form>
    </section>
  );
}
