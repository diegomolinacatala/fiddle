"use client";

import { useRef, useState } from "react";
import Icono from "@/app/Icono";
import { PIN_MIN, PIN_MAX, HORAS_PIN } from "@/lib/plantilla";
import { C, panel, campo, botonPrimario, botonSecundario, aviso, RADIO, legible } from "@/app/ui";

// ============================================================================
// ¿QUIÉN ATIENDE? Lo que ve la caja cuando en este móvil nadie se ha identificado.
// ----------------------------------------------------------------------------
// La cuenta de la caja la comparten; esto pone nombre a cada sello. Cada uno
// tiene su PIN: lo elige la primera vez (dos cajas iguales) y después solo lo
// teclea cuando el móvil lleva HORAS_PIN sin usar la caja. Si en este móvil la
// última fue Marta, se le pide directamente el PIN («¿Sigues siendo Marta?») y
// la lista queda detrás de «Soy otra persona».
//
// Entra SOLO al teclear la última cifra: el servidor dice cuántas tiene el PIN
// (`largoPin`), así que no hay que darle a nada. Al elegirlo, igual: en cuanto el
// segundo tiene las mismas cifras que el primero, se guarda. El botón se queda
// para los PIN de antes, que no saben su largo.
//
// `onEnviar({ id, pin })` o `onEnviar({ id, nuevoPin })` devuelve el error en
// texto, o null si entró.
// ============================================================================

export default function QuienAtiende({ plantilla, ultimo, accent, onEnviar, ocupado = false }) {
  const [elegido, setElegido] = useState(ultimo || null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState(null);
  const enviando = useRef(false); // la última cifra y el botón no mandan dos veces
  const campo1 = useRef(null); // para devolver el foco tras un fallo: se vuelve a teclear sin tocar nada
  const paso = !elegido ? "lista" : elegido.tienePin ? "pin" : "crear";
  const largo = paso === "pin" ? elegido.largoPin || null : null;

  function elegir(e) {
    setElegido(e);
    setPin("");
    setPin2("");
    setError(null);
  }

  const soloCifras = (v) => v.replace(/\D/g, "").slice(0, PIN_MAX);

  function cambiarPin(v) {
    const limpio = soloCifras(v);
    setPin(limpio);
    if (largo && limpio.length === largo) mandar(limpio, pin2);
  }
  function cambiarPin2(v) {
    const limpio = soloCifras(v);
    setPin2(limpio);
    if (pin.length >= PIN_MIN && limpio.length === pin.length) mandar(pin, limpio);
  }

  async function mandar(p1, p2) {
    if (enviando.current || ocupado) return;
    setError(null);
    if (paso === "crear") {
      if (!/^\d+$/.test(p1) || p1.length < PIN_MIN || p1.length > PIN_MAX) return setError(`El PIN son de ${PIN_MIN} a ${PIN_MAX} cifras.`);
      if (/^(.)\1+$/.test(p1)) return setError("Todas las cifras iguales no vale.");
      if (p1 !== p2) return reempezar("Los dos PIN no coinciden. Vuelve a escribirlo.");
    } else if (!p1) {
      return setError("Escribe tu PIN.");
    }
    enviando.current = true;
    try {
      const problema = await onEnviar(paso === "crear" ? { id: elegido.id, nuevoPin: p1 } : { id: elegido.id, pin: p1 });
      if (problema) reempezar(problema);
    } finally {
      enviando.current = false;
    }
  }

  /** Tras un fallo: campos vacíos y el foco en el primero, para volver a teclear sin tocar nada. */
  function reempezar(mensaje) {
    setError(mensaje);
    setPin("");
    setPin2("");
    campo1.current?.focus();
  }

  function enviar(ev) {
    ev.preventDefault();
    mandar(pin, pin2);
  }

  const titulo = paso === "lista" ? "¿Quién atiende?"
    : paso === "crear" ? `${elegido.nombre}, elige tu PIN`
    : ultimo && elegido.id === ultimo.id ? `¿Sigues siendo ${elegido.nombre}?`
    : `${elegido.nombre}, tu PIN`;
  const explicacion = paso === "lista" ? "Cada punto se apunta a tu nombre. Con tu PIN, nadie suma por ti."
    : paso === "crear" ? `De ${PIN_MIN} a ${PIN_MAX} cifras. Lo pedirá cuando este móvil lleve ${HORAS_PIN} horas sin usar la caja; si lo olvidas, el manager te lo quita y eliges otro.`
    : `${largo ? "Con la última cifra entras. " : ""}Se pide cuando este móvil lleva ${HORAS_PIN} horas sin usar la caja, o al cambiar de persona.`;

  return (
    <section style={{ ...panel, padding: 20 }} aria-labelledby="quien-titulo">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: RADIO.boton, background: `${accent}14`, color: legible(accent), display: "grid", placeItems: "center", flexShrink: 0 }}>
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
          {/* `readOnly` mientras se comprueba, no `disabled`: así no pierde el foco ni se cierra el teclado del móvil. */}
          <input
            ref={campo1} value={pin} onChange={(e) => cambiarPin(e.target.value)} readOnly={ocupado}
            type="password" inputMode="numeric" pattern="[0-9]*" autoComplete={paso === "crear" ? "new-password" : "current-password"}
            maxLength={PIN_MAX} autoFocus aria-label={paso === "crear" ? "PIN nuevo" : "Tu PIN"} placeholder={paso === "crear" ? "PIN nuevo" : "PIN"}
            style={campoPin}
          />
          {paso === "crear" && (
            <input
              value={pin2} onChange={(e) => cambiarPin2(e.target.value)} readOnly={ocupado}
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
