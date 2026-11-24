"use client";

import Icono from "@/app/Icono";
import { Escenario, Panel, usePasos } from "./Marco";
import EscenaQr from "./EscenaQr";
import CartelImpreso from "./CartelImpreso";

// El paso 2: el QR de la tienda. La escena enseña la historia entera (el QR, el
// cartel del mostrador, un cliente que lo escanea y se lleva la tarjeta); el panel
// solo da dos salidas para tenerlo en papel o en fichero. «Seguir» lo da por hecho.
export default function PasoQr() {
  const { n, qr, slug, quieto } = usePasos();
  return (
    <>
      <Escenario etiqueta="Un cliente escanea el QR del mostrador y se lleva tu tarjeta al móvil" className="pp-qr-escena">
        <EscenaQr n={n} qr={qr} quieto={quieto} />
      </Escenario>
      <Panel
        titulo="Tu QR del mostrador"
        pista="Ponlo junto a la caja: quien lo escanee se lleva tu tarjeta al móvil, sin descargar nada."
        className="pp-qr-cuerpo"
      >
        <div className="pp-qr-acciones">
          <button type="button" className="pp-qr-accion" onClick={() => window.print()}>
            <Icono nombre="nota" tam={18} /> Imprimir cartel
          </button>
          <a className="pp-qr-accion" href={qr.src} download={`qr-${slug}.svg`}>
            <Icono nombre="descargar" tam={18} /> Descargar QR
          </a>
        </div>
      </Panel>
      <CartelImpreso nombre={n.nombre} qrSrc={qr.src} tono={n.tema.cardBg} />
    </>
  );
}
