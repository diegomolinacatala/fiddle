"use client";

import { useMemo } from "react";
import Escena from "@/app/home/tarjeta/Escena";
import Icono from "@/app/Icono";
import { PASOS } from "@/lib/primerosPasos";
import { Escenario, Panel, usePasos } from "./Marco";
import { armarTienda } from "./tienda";

// ============================================================================
// LA BIENVENIDA (antes del primer paso)
// ----------------------------------------------------------------------------
// Entrar de golpe en «Tu color» sin saber cuánto queda echa para atrás. Aquí, de
// un vistazo: su tarjeta ya hecha, los cinco pasos que vienen y que se puede saltar
// cualquiera. Solo sale la primera vez (sin nada hecho y sin paso en la URL), no se
// cuenta en el progreso y no se apunta.
// ============================================================================

const ICONOS = { tarjeta: "cartera", qr: "qr", horario: "reloj", clientes: "clientes", promos: "megafono" };

export default function PasoHola() {
  const { n, qr, seguir } = usePasos();
  const armar = useMemo(() => armarTienda(n), [n]);
  return (
    <>
      <Escenario etiqueta="Tu tarjeta">
        <Escena eleccion={{}} armar={armar} qr={qr.src} aria-hidden="true" />
      </Escenario>
      <Panel
        titulo="Vamos a dejarla lista"
        pista="Cinco pasos, unos dos minutos. Puedes saltarte cualquiera."
        principal={{ texto: "Empezar", onClick: seguir }}
        ahoraNo={false}
        className="pp-hola"
      >
        <ol className="pp-hola-lista">
          {PASOS.map((p, i) => (
            <li key={p.id} style={{ "--i": i }}>
              <span className="pp-hola-icono" aria-hidden="true"><Icono nombre={ICONOS[p.id]} tam={18} /></span>
              {p.nombre}
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
