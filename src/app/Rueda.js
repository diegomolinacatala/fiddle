"use client";

import { useEffect, useRef } from "react";

/**
 * Una cifra que rueda como un cuentakilómetros: cada cifra que cambia entra
 * desde abajo si el número sube y desde arriba si baja (las reglas, en
 * app/layout.js). `texto` es el número ya escrito («1.234») y `valor` el número,
 * para saber hacia dónde va. Lo mueve quien le cambia el valor (useVisto): esto
 * solo lo pinta. Se lee entero (`aria-label`), no cifra a cifra.
 */
export default function Rueda({ texto, valor }) {
  const antes = useRef(valor);
  const baja = typeof valor === "number" && typeof antes.current === "number" && valor < antes.current;
  useEffect(() => { antes.current = valor; }, [valor]);
  const letras = String(texto).split("");
  return (
    <span aria-label={String(texto)} role="text" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {letras.map((c, i) => (
        // Contando desde la derecha: las unidades siguen siendo las unidades aunque el número crezca.
        <span key={letras.length - i} className="rueda-hueco" aria-hidden>
          <span key={c} className={baja ? "rueda-baja" : "rueda-sube"}>{c}</span>
        </span>
      ))}
    </span>
  );
}
