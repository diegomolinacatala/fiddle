"use client";

import { useEffect, useRef } from "react";
import { Flecha } from "../tarjeta/controles";
import { MAX_NOMBRE, NOMBRE_POR_DEFECTO } from "../tarjeta/opciones";
import { useTarjeta } from "./Tarjeta";

// El gancho: el nombre de su cafetería, que ya sale en la tarjeta mientras lo escribe.
export default function PasoHola({ seguir, pedirFoco, alEnfocar, alFoco }) {
  const { eleccion, escribirNombre } = useTarjeta();
  const campo = useRef(null);

  // Tocar la cabecera de la tarjeta lleva aquí con el cursor en el campo.
  useEffect(() => {
    if (!pedirFoco) return;
    campo.current?.focus({ preventScroll: true });
    alEnfocar();
  }, [pedirFoco, alEnfocar]);

  return (
    <>
      <div className="exp-cuerpo exp-hola">
        <div className="prob-cabeza">
          {/* Se llega desde «Diseña tu tarjeta» de la web: el titular de allí aquí sobraría. */}
          <h1 data-titulo tabIndex={-1}>Empieza por el nombre</h1>
          <p>Y mira cómo sale en tu tarjeta mientras lo escribes.</p>
        </div>
        <label className="prob-nombre exp-nombre">
          <span className="exp-etiqueta">¿Cómo se llama tu cafetería?</span>
          <input
            ref={campo}
            value={eleccion.nombre}
            onChange={(ev) => escribirNombre(ev.target.value)}
            onFocus={() => alFoco(true)}
            onBlur={() => alFoco(false)}
            onKeyDown={(ev) => ev.key === "Enter" && seguir()}
            placeholder={NOMBRE_POR_DEFECTO}
            maxLength={MAX_NOMBRE}
            autoComplete="organization"
            enterKeyHint="next"
          />
        </label>
      </div>
      <div className="exp-accion">
        <button type="button" className="prob-siguiente prob-ancho exp-principal" onClick={seguir}>
          Diseñar mi tarjeta <Flecha />
        </button>
        <p className="exp-nota">Un minuto. Sin registrarte.</p>
      </div>
    </>
  );
}
