"use client";

import { useMemo } from "react";
import Escena from "@/app/home/tarjeta/Escena";
import Icono from "@/app/Icono";
import { PASOS } from "@/lib/primerosPasos";
import { Escenario, Panel, usePasos } from "./Marco";
import { armarTienda } from "./tienda";

// La pantalla del final: su tarjeta en escena con dos ondas que salen de ella, y
// lo que ha hecho. Lo que se saltó sale con «Hacerlo», sin reñir: se puede volver.
export default function PasoListo() {
  const { n, qr, slug, hechos, ir } = usePasos();
  const armar = useMemo(() => armarTienda(n), [n]);
  const faltan = PASOS.filter((p) => !hechos.includes(p.id)).length;

  return (
    <>
      <Escenario etiqueta="Tu tarjeta" className="pp-escena-listo">
        <span className="pp-onda" aria-hidden="true" />
        <span className="pp-onda" aria-hidden="true" />
        <Escena eleccion={{}} armar={armar} qr={qr.src} aria-hidden="true" />
      </Escenario>
      <Panel
        titulo={faltan ? "Tu tarjeta ya funciona" : "Todo listo"}
        pista={faltan ? "Lo pendiente te espera en Tienda." : "Pon el QR en el mostrador y a sumar puntos."}
        principal={{ texto: "Ir a mi panel", onClick: () => { window.location.href = `/${slug}/manager`; } }}
        ahoraNo={false}
        className="pp-listo"
      >
        <ul className="pp-lista">
          {PASOS.map((p) => {
            const hecho = hechos.includes(p.id);
            return (
              <li key={p.id} className={hecho ? "hecho" : undefined}>
                <span className="pp-marca" aria-hidden="true">{hecho ? <Icono nombre="check" tam={16} /> : null}</span>
                <span className="pp-lista-nombre">{p.nombre}<span className="sr-solo">{hecho ? ", hecho" : ", pendiente"}</span></span>
                {!hecho && <button type="button" className="pp-volver" onClick={() => ir(p.id)}>Hacerlo</button>}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
