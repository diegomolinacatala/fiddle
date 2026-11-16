"use client";

import { useEffect, useRef, useState } from "react";
import { Flecha } from "../tarjeta/controles";
import { SECCIONES } from "../tarjeta/opciones";
import PasoDiseno from "../tarjeta/PasoDiseno";
import { useTarjeta } from "./Tarjeta";
import { siguienteDe } from "./logica";
import Cabeza from "./Cabeza";

const PAUSA_AL_ELEGIR = 280; // ms: lo justo para ver el cambio en la tarjeta antes de seguir

// Los pasos de diseño (premios, puntos, color, icono): elegir avanza solo, salvo el color,
// que se desliza y lleva su botón. Con dos premios, el icono se elige dos veces.
export default function PasoElegir({ paso, ir, latido, quieto }) {
  const { e, eleccion, tema, cambiar, escribirNombre } = useTarjeta();
  const [hueco, setHueco] = useState(0); // con dos premios, de cuál se elige el icono
  const espera = useRef(0);
  useEffect(() => () => clearTimeout(espera.current), []);

  const seccion = SECCIONES.find((s) => s.id === paso.seccion);
  const siguiente = siguienteDe(paso.id);

  const elegirYSeguir = (cambios) => {
    cambiar(cambios);
    latido();
    clearTimeout(espera.current);
    espera.current = setTimeout(() => ir(siguiente), quieto ? 0 : PAUSA_AL_ELEGIR);
  };
  const elegirIcono = (id) => {
    if (e.cartillas === 2 && hueco === 0) {
      cambiar({ icono: id });
      latido();
      setHueco(1);
      return;
    }
    elegirYSeguir(hueco === 0 ? { icono: id } : { icono2: id });
  };

  const titulo = paso.id === "icono" && e.cartillas === 2 ? (hueco === 0 ? "El primer premio" : "Y el segundo") : seccion.titulo;

  return (
    <>
      <div className="exp-cuerpo">
        <Cabeza titulo={titulo} pista={seccion.pista} />
        <PasoDiseno
          id={seccion.id}
          e={e}
          nombre={eleccion.nombre}
          hueco={hueco}
          tema={tema}
          quieto={quieto}
          cambiar={cambiar}
          escribirNombre={escribirNombre}
          elegirYSeguir={elegirYSeguir}
          elegirIcono={elegirIcono}
        />
      </div>
      {seccion.boton && (
        <div className="exp-accion">
          <button type="button" className="prob-siguiente prob-ancho exp-principal" onClick={() => ir(siguiente)}>
            Seguir <Flecha />
          </button>
        </div>
      )}
    </>
  );
}
