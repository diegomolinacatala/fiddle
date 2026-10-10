"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { PIN_MIN, PIN_MAX, HORAS_PIN } from "@/lib/plantilla";
import { C, panel, campo, botonPrimario, botonSecundario, aviso, RADIO } from "@/app/ui";

// ============================================================================
// ¿QUIÉN ATIENDE? Lo que ve la caja cuando en este móvil nadie se ha identificado.
// ----------------------------------------------------------------------------
// La cuenta de la caja la comparten; esto pone nombre a cada sello. Cada uno
// tiene su PIN: lo elige la primera vez (dos cajas iguales) y después solo lo
// teclea cuando el móvil lleva HORAS_PIN sin usar la caja. Si en este móvil la
// última fue Marta, se le pide directamente el PIN («¿Sigues siendo Marta?») y
// la lista queda detrás de «Soy otra persona».
//
// `onEnviar({ id, pin })` o `onEnviar({ id, nuevoPin })` devuelve el error en
// texto, o null si entró.
// ============================================================================

export default function QuienAtiende({ plantilla, ultimo, accent, onEnviar, ocupado = false }) {
  const [elegido, setElegido] = useState(ultimo || null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState(null);
  const paso = !elegido ? "lista" : elegido.tienePin ? "pin" : "crear";

  function elegir(e) {
    setElegido(e);
    setPin("");
    setPin2("");
    setError(null);
  }

  async function enviar(ev) {
    ev.preventDefault();
    setError(null);
    if (paso === "crear") {
      if (!/^\d+$/.test(pin) || pin.length < PIN_MIN || pin.length > PIN_MAX) return setError(`El PIN son de ${PIN_MIN} a ${PIN_MAX} cifras.`);
      if (/^(.)\1+$/.test(pin)) return setError("Todas las cifras iguales no vale.");
      if (pin !== pin2) return setError("Los dos PIN no coinciden.");
    } else if (!pin) {
      return setError("Escribe tu PIN.");
    }
    const problema = await onEnviar(paso === "crear" ? { id: elegido.id, nuevoPin: pin } : { id: elegido.id, pin });
    if (problema) {
      setError(problema);
      setPin("");
      setPin2("");
    }
  }

  const titulo = paso === "lista" ? "¿Quién atiende?"
    : paso === "crear" ? `${elegido.nombre}, elige tu PIN`
    : ultimo && elegido.id === ultimo.id ? `¿Sigues siendo ${elegido.nombre}?`
    : `${elegido.nombre}, tu PIN`;
  const explicacion = paso === "lista" ? "Cada sello se apunta a tu nombre. Con tu PIN, nadie sella por ti."
    : paso === "crear" ? `De ${PIN_MIN} a ${PIN_MAX} cifras. Lo pedirá cuando este móvil lleve ${HORAS_PIN} horas sin usar la caja; si lo olvidas, el manager te lo quita y eliges otro.`
    : `Se pide cuando este móvil lleva ${HORAS_PIN} horas sin usar la caja, o al cambiar de persona.`;

  return (
    <section style={{ ...panel, padding: 20 }} aria-labelledby="quien-titulo">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: RADIO.boton, background: `${accent}14`, color: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icono nombre={paso === "lista" ? "credencial" : "candado"} tam={22} />
        </span>
        <div>
          <h2 id="quien-titulo" style={{ fontSize: 18, fontWeight: 650, margin: 0 }}>{titulo}</h2>
          <p style={{ fontSize: 13, color: C.suave, margin: "2px 0 0" }}>{explicacion}</p>
        </div>
      </div>

      {paso === "lista" ? (
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {plantilla.map((e) => (
            <button key={e.id} type="button" disabled={ocupado} onClick={() => elegir(e)} style={botonNombre(accent)}>
              <span style={{ flex: 1, textAlign: "left" }}>{e.nombre}</span>
              <span style={{ fontSize: 12, color: C.tenue, fontWeight: 500 }}>{e.tienePin ? "" : "sin PIN aún"}</span>
              <Icono nombre={e.tienePin ? "candado" : "mas"} tam={18} grosor={2.2} style={{ opacity: 0.55 }} />
            </button>
          ))}
          {plantilla.length === 0 && <p style={{ fontSize: 14, color: C.suave, margin: 0 }}>No hay nadie dado de alta en la plantilla.</p>}
        </div>
      ) : (
        <form onSubmit={enviar} style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <input
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))}
            type="password" inputMode="numeric" pattern="[0-9]*" autoComplete={paso === "crear" ? "new-password" : "current-password"}
            maxLength={PIN_MAX} autoFocus aria-label={paso === "crear" ? "PIN nuevo" : "Tu PIN"} placeholder={paso === "crear" ? "PIN nuevo" : "PIN"}
            style={campoPin}
          />
          {paso === "crear" && (
            <input
              value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))}
              type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password"
              maxLength={PIN_MAX} aria-label="Repite el PIN" placeholder="Repítelo"
              style={campoPin}
            />
          )}
          {error && <div role="alert" style={aviso(false)}>{error}</div>}
          <button type="submit" disabled={ocupado} style={{ ...botonPrimario(accent), width: "100%", minHeight: 56, fontSize: 17 }}>
            {paso === "crear" ? "Guardar mi PIN" : `Sí, soy ${elegido.nombre}`}
          </button>
          <button type="button" disabled={ocupado} onClick={() => elegir(null)} style={{ ...botonSecundario, width: "100%", minHeight: 46 }}>
            Soy otra persona
          </button>
        </form>
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
const campoPin = { ...campo, fontSize: 24, letterSpacing: 8, textAlign: "center", minHeight: 56, fontVariantNumeric: "tabular-nums" };
