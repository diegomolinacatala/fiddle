"use client";

import { useMemo } from "react";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { PALETAS, MODOS, MODOS_DOS, tarjetaDe } from "./opciones";

// Cada forma de contar, con su banda de verdad en pequeño.
export function Modos({ eleccion, alElegir }) {
  const { cartillas, paleta, icono, icono2, fondo, cifras } = eleccion;
  const modos = cartillas === 2 ? MODOS_DOS : MODOS;
  const bandas = useMemo(
    () => Object.fromEntries(modos.map((m) => {
      const { negocio, cliente } = tarjetaDe({ cartillas, paleta, icono, icono2, fondo, cifras, modo: m.id });
      return [m.id, comoDataUri(stripDelPase(negocio, cliente).svg)];
    })),
    [modos, cartillas, paleta, icono, icono2, fondo, cifras],
  );
  const { cardBg } = PALETAS.find((p) => p.id === paleta);
  return (
    <div className="prob-rejilla prob-modos" role="radiogroup" aria-label="Cómo se cuentan los puntos">
      {modos.map((m) => (
        <Opcion key={m.id} activa={eleccion.modo === m.id} alElegir={() => alElegir(m.id)} etiqueta={m.nombre}>
          <img src={bandas[m.id]} alt="" className="prob-modo-banda" style={{ background: cardBg }} />
        </Opcion>
      ))}
    </div>
  );
}

export function Opcion({ activa, alElegir, etiqueta, children }) {
  return (
    <button type="button" role="radio" aria-checked={activa} className="prob-opcion" onClick={alElegir}>
      {children}
      <span className="prob-opcion-texto">{etiqueta}</span>
    </button>
  );
}

export function Segmentos({ opciones, valor, alCambiar }) {
  const i = Math.max(0, opciones.findIndex((o) => o.id === valor));
  return (
    <div className="prob-segmentos" role="radiogroup" style={{ "--n": opciones.length, "--i": i }}>
      <span className="prob-segmentos-pildora" aria-hidden="true" />
      {opciones.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === valor} onClick={() => alCambiar(o.id)}>
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

export function Grupo({ titulo, children }) {
  return (
    <div className="prob-grupo">
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}

export const Flecha = ({ atras = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={atras ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Hecho = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
