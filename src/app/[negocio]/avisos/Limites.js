"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { MAX_PAUSA, LIMITE_DIA, PAUSA_CORTA } from "@/lib/automatizaciones";
import { C, panel, campo, h2, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// PARA NO CANSAR A NADIE: los dos topes que valen para TODO lo que sale solo
// (automáticos y programados), y lo que ponen Apple y Google por su cuenta.
// Dos números y ya: la pausa entre avisos y cuántos al día como mucho. De
// partida, escasos (una semana, uno al día); lo que pase de ahí se puede
// elegir, pero la pantalla dice que cansa.
// ============================================================================

export default function Limites({ negocio: n, ocupado, guardar, flash, children }) {
  const [pausa, setPausa] = useState(n.pausaAvisos);
  const [dia, setDia] = useState(n.limiteAvisosDia ?? LIMITE_DIA.def);
  const cambiado = (pausa !== "" && Number(pausa) !== n.pausaAvisos) || dia !== n.limiteAvisosDia;
  const avisos = [
    pausa !== "" && Number(pausa) < PAUSA_CORTA
      && (Number(pausa) === 0 ? "Sin pausa, alguien puede recibir un aviso detrás de otro." : `Con ${pausa} ${Number(pausa) === 1 ? "día" : "días"} de pausa, a quien encaje en varios le llegan casi seguidos.`),
    dia > 1 && `${dia} avisos al día a la misma persona es mucho: cansa, y la tarjeta acaba silenciada o borrada.`,
  ].filter(Boolean);

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
        {avisos.map((t) => (
          <p key={t} role="alert" style={alerta}>
            <Icono nombre="alerta" tam={15} style={{ marginTop: 1 }} /><span>{t} Lo recomendable: una semana de pausa y uno al día.</span>
          </p>
        ))}
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

const alerta = {
  display: "flex", gap: 7, alignItems: "flex-start", margin: 0, fontSize: 12.5, lineHeight: 1.45, color: "#9a5b00",
  background: "#fff6e5", border: "1px solid #f5d9a8", borderRadius: RADIO.boton, padding: "8px 10px",
};
