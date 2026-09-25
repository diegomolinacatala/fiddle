"use client";

import { useEffect, useState } from "react";
import { estadoAhora } from "@/lib/horario";

// ============================================================================
// ¿ABIERTA AHORA?
// ----------------------------------------------------------------------------
// Una línea bajo el nombre de la tienda, como la ponen Google Maps y Apple Maps:
// un punto de color y "Abierto hasta las 18:30". El punto es verde, ámbar en la
// última hora antes de cerrar o de abrir, y rojo cerrada; el texto va en la
// tinta de la tarjeta, bajado, para que no compita con el premio.
//
// Solo en la tarjeta web: Wallet no puede tener algo que cambia solo con la
// hora (el pase se queda como se instaló hasta que el servidor lo empuja).
//
// Se calcula en el navegador y se repasa al cambiar el minuto: una tarjeta
// instalada en la pantalla de inicio puede quedarse abierta horas.
// ============================================================================

// Colores de sistema de iOS: se ven sobre la tarjeta clara de una tienda y sobre
// la negra de otra. El punto solo acompaña; lo que dice el estado es el texto.
const PUNTO = { abierto: "#34c759", pronto: "#ff9f0a", cerrado: "#ff453a" };

const MINUTO = 60_000;

export default function AbiertoAhora({ horario }) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let reloj = null;
    // Al cambiar el minuto, no cada 60 s desde que se abrió: "Cierra pronto"
    // tiene que salir a su hora.
    const programar = () => {
      reloj = setTimeout(() => { setAhora(Date.now()); programar(); }, MINUTO - (Date.now() % MINUTO) + 50);
    };
    // El móvil congela los temporizadores con la pantalla apagada: al volver, al momento.
    const alVolver = () => { if (document.visibilityState === "visible") setAhora(Date.now()); };
    setAhora(Date.now());
    programar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  const estado = estadoAhora(horario, ahora);
  if (!estado) return null;

  // suppressHydrationWarning: el servidor lo pinta con su minuto y el teléfono
  // con el suyo; si cae justo en el cambio, manda el del teléfono.
  //
  // El resto ("hasta las 18:30") va en su propia pieza: si no cabe entero en la
  // línea (un Android estrecho con "PREMIO GUARDADO" al lado), baja a una segunda
  // línea que no se ve y queda "Abierto". Nunca "Abierto hasta las 16:…".
  const resto = estado.texto.slice(estado.corto.length).trim();
  return (
    <span style={linea}>
      <span aria-hidden suppressHydrationWarning style={{ ...punto, background: PUNTO[estado.tono] }} />
      <span style={texto}>
        <span suppressHydrationWarning>{estado.corto}</span>
        <span suppressHydrationWarning>{resto}</span>
      </span>
    </span>
  );
}

const linea = { display: "flex", alignItems: "center", gap: 6, marginTop: 1, minWidth: 0 };
const punto = { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 };
const texto = {
  display: "flex",
  flexWrap: "wrap",
  columnGap: "0.28em", // el espacio entre "Abierto" y "hasta…"
  minWidth: 0,
  height: "1.2em", // una línea: lo que baja a la segunda no se ve
  overflow: "hidden",
  fontSize: 12.5,
  fontWeight: 500,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  opacity: 0.72,
};
