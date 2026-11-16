"use client";

import { useEffect, useState } from "react";

// ============================================================================
// DÓNDE SE PONE LA TARJETA EN LA PRUEBA
// ----------------------------------------------------------------------------
// En la prueba la tarjeta se encoge y se aparta a la izquierda para dejar sitio al
// cliente (Cliente.js), que se coloca a la derecha con las mismas consultas de
// medios en estiloPrueba.js. `escala` multiplica la cámara de la Escena y `desplaza`
// es fracción del ancho y del alto de la escena (ver el contrato de Escena.js).
// Las escalas salen de lo que mide la escena: la tarjeta entera ya se ajusta a su
// alto (506 puntos), aquí solo se le quita lo que ocupa el cliente.
// ============================================================================

const COMPOSICIONES = {
  ancho: { escala: 0.85, desplaza: { x: -0.22, y: 0.04 } },
  movil: { escala: 0.8, desplaza: { x: -0.24, y: 0.05 } },
  bajo: { escala: 0.9, desplaza: { x: -0.25, y: 0.05 } },
  horizontal: { escala: 0.75, desplaza: { x: -0.24, y: 0.04 } },
};

// En este orden: la primera que se cumple es la disposición.
const CONSULTAS = [
  ["ancho", "(min-width:900px)"],
  ["horizontal", "(max-width:899.98px) and (orientation:landscape)"],
  ["bajo", "(max-width:899.98px) and (max-height:640px)"],
];

const modoActual = () => CONSULTAS.find(([, q]) => window.matchMedia(q).matches)?.[0] ?? "movil";

export default function useComposicion() {
  // El servidor no sabe la pantalla: se pinta la de móvil y se corrige al montar.
  const [modo, setModo] = useState("movil");
  useEffect(() => {
    const listas = CONSULTAS.map(([, q]) => window.matchMedia(q));
    const poner = () => setModo(modoActual());
    poner();
    listas.forEach((l) => l.addEventListener("change", poner));
    return () => listas.forEach((l) => l.removeEventListener("change", poner));
  }, []);
  return COMPOSICIONES[modo];
}
