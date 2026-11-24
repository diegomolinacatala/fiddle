"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import CaraDelPase from "@/app/CaraDelPase";
import Icono from "@/app/Icono";
import { clienteDeEjemplo } from "./tienda";

// ============================================================================
// LA ESCENA DEL QR: el cartel del mostrador y un móvil que lo escanea
// ----------------------------------------------------------------------------
// Cuenta en unos 3,7 s lo que va a pasar en la tienda: el QR se dibuja, se coloca
// en el cartel, un móvil lo apunta y su pantalla se llena con la tarjeta de la
// tienda. Luego se queda quieta con un «Otra vez».
//
// El estado FINAL es el de partida del CSS y las animaciones solo hacen el viaje
// hasta él (`.pp-qr-juega`): con «reducir movimiento» no hay clase y sale el final.
// Todo se dibuja en un lienzo fijo de 400x300 que se escala entero al hueco
// (así las medidas del dibujo no dependen del alto, que va de 250 a 450 px).
// El QR son ~1000 módulos: se pintan como UN trazo por zona (filas de módulos
// seguidos), nunca uno a uno, y el barrido es un clip-path de toda la lámina.
// ============================================================================

const ANCHO = 400;
const ALTO = 300;
const ESCALA_MAX = 1.5;
const DURACION_MS = 3800; // lo que tarda en acabar la secuencia (estiloQr.js)
const OJO = 7; // los tres cuadrados de las esquinas miden 7 módulos

// A qué cuadrado de esquina (0, 1, 2) pertenece el módulo, o -1 si es dato.
function ojoDe(x, y, lado) {
  if (x < OJO && y < OJO) return 0;
  if (x >= lado - OJO && y < OJO) return 1;
  if (x < OJO && y >= lado - OJO) return 2;
  return -1;
}

/** Un trazo por zona: cada fila une sus módulos seguidos en un solo rectángulo. */
export function trazosDelQr({ modulos, lado }) {
  const datos = [];
  const ojos = [[], [], []];
  for (let y = 0; y < lado; y++) {
    let x = 0;
    while (x < lado) {
      if (modulos[y * lado + x] !== "1") { x++; continue; }
      const zona = ojoDe(x, y, lado);
      let largo = 1;
      while (x + largo < lado && modulos[y * lado + x + largo] === "1" && ojoDe(x + largo, y, lado) === zona) largo++;
      (zona < 0 ? datos : ojos[zona]).push(`M${x} ${y}h${largo}v1h-${largo}z`);
      x += largo;
    }
  }
  return { datos: datos.join(""), ojos: ojos.map((o) => o.join("")) };
}

/** Escala que hace caber el lienzo en el hueco, sin pasarse en pantallas grandes. */
function useEscala(caja) {
  const [escala, setEscala] = useState(null);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const medir = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width && height) setEscala(Math.min(width / ANCHO, height / ALTO, ESCALA_MAX));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [caja]);
  return escala;
}

function Codigo({ qr }) {
  const trazos = useMemo(() => trazosDelQr(qr), [qr]);
  const vista = `0 0 ${qr.lado} ${qr.lado}`;
  return (
    <div className="pp-qr-lamina">
      <svg className="pp-qr-datos" viewBox={vista} shapeRendering="crispEdges" focusable="false"><path d={trazos.datos} fill="#000" /></svg>
      <svg className="pp-qr-ojos" viewBox={vista} shapeRendering="crispEdges" focusable="false">
        {trazos.ojos.map((d, i) => <path key={i} className={`pp-qr-ojo o${i}`} d={d} fill="#000" />)}
      </svg>
      <i className="pp-qr-barrido" />
    </div>
  );
}

function Movil({ n, qr }) {
  const cliente = useMemo(() => clienteDeEjemplo(n), [n]);
  return (
    <div className="pp-qr-movil">
      <div className="pp-qr-pantalla">
        <div className="pp-qr-sale">
          <div className="pp-qr-tarjeta">
            <CaraDelPase cliente={cliente} negocio={n} estado={null} qr={{ src: qr.src, codigo: cliente.codigo }} />
          </div>
        </div>
        <div className="pp-qr-camara"><i className="a" /><i className="b" /><i className="c" /><i className="d" /></div>
      </div>
    </div>
  );
}

export default function EscenaQr({ n, qr, quieto }) {
  const caja = useRef(null);
  const escala = useEscala(caja);
  const [intento, setIntento] = useState(0);
  const [acabo, setAcabo] = useState(false);

  // Al repetir (o al empezar) se espera a que acabe para ofrecer «Otra vez».
  useEffect(() => {
    setAcabo(false);
    if (quieto) return undefined;
    const t = setTimeout(() => setAcabo(true), DURACION_MS);
    return () => clearTimeout(t);
  }, [intento, quieto]);

  const listo = quieto || acabo;
  const tinta = n.tema?.ink || "#fff";
  return (
    <div ref={caja} className="pp-qr-caja">
      <div
        key={intento}
        className={`pp-qr-lienzo${quieto ? "" : " pp-qr-juega"}`}
        style={{ transform: `scale(${escala ?? 1})`, visibility: escala ? undefined : "hidden", "--tinta-cartel": tinta }}
        aria-hidden="true"
      >
        <div className="pp-qr-mostrador" />
        <div className="pp-qr-cartel">
          <div className="pp-qr-cab"><span>{n.nombre}</span></div>
          <div className="pp-qr-hueco" />
          <p>Escanea y llévate tu tarjeta</p>
        </div>
        <div className="pp-qr-codigo"><Codigo qr={qr} /></div>
        <div className="pp-qr-haz" />
        <Movil n={n} qr={qr} />
      </div>
      {listo && (
        <button type="button" className="pp-qr-otra" onClick={() => setIntento((i) => i + 1)}>
          <Icono nombre="deshacer" tam={16} /> Otra vez
        </button>
      )}
    </div>
  );
}
