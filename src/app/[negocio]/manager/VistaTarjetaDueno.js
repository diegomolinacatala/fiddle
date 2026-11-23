"use client";

import { useEffect, useMemo, useState } from "react";
import { partesConEnlaces } from "./partesConEnlaces";
import Icono from "@/app/Icono";
import { fuentePase } from "@/app/fuentePase";
import { camposDelDueno } from "@/lib/dueno/pase";
import { svgStripDueno, svgLogoDueno, COLORES_DUENO } from "@/lib/dueno/dibujo";
import { comoDataUri } from "@/lib/apple/dibujo";
import { WALLET as W, FUENTE_PASE, colocarFila, medirAprox } from "@/lib/vistaWallet";
import { C, botonPequeno } from "@/app/ui";

// ============================================================================
// LA TARJETA DEL DUEÑO, COMO SE VERÁ EN EL IPHONE
// ----------------------------------------------------------------------------
// Sale de las mismas funciones que arman el .pkpass (camposDelDueno, la banda y
// el lacre) y se coloca con las medidas de un pase de verdad (WALLET, como
// CaraDelPase): cabecera, banda a 139 de alto recortada por los lados y la fila de
// campos repartida como iOS (colocarFila: encoge entera y el largo pasa a dos
// líneas). La tarjeta es un dibujo del pase, no interfaz: lleva colores fijos y no
// sigue el modo oscuro. El botón y el reverso, que sí son interfaz, usan los de C.
// ============================================================================

// Un punto de Wallet: la tarjeta crece o encoge con su ancho (container query), como CaraDelPase.
const pt = (n) => `calc(${n} * var(--pt, 1px))`;

export default function VistaTarjetaDueno({ informe, aviso, negocio }) {
  const [info, setInfo] = useState(false);
  // Con el origen delante, los enlaces del reverso se pueden tocar en la vista previa.
  const [base, setBase] = useState("");
  useEffect(() => setBase(window.location.origin), []);
  const campos = useMemo(() => camposDelDueno({ informe, aviso }, negocio, { base }), [informe, aviso, negocio, base]);
  const logo = useMemo(() => comoDataUri(svgLogoDueno()), []);
  const banda = useMemo(() => svgStripDueno(informe), [informe]);
  const abajo = useMemo(() => [...campos.secondaryFields, ...campos.auxiliaryFields], [campos]);
  // Una regla de tres y no un canvas: esto también se pinta en el servidor.
  const fila = useMemo(() => colocarFila(abajo, {
    total: W.ancho - W.margen * 2, hueco: W.hueco, max: W.valor, min: W.valorMin,
    medir: medirAprox, etiquetas: abajo.map((f) => medirAprox(f.label, W.etiqueta)),
  }), [abajo]);
  const cabecera = campos.headerFields[0];

  return (
    <div className={fuentePase.variable} style={{ width: `min(${W.ancho}px, 100%)` }}>
      <article aria-label={`Tarjeta de dueño de ${negocio.nombre}`}
        style={{ ...tarjeta, "--pt": `calc(100cqw / ${W.ancho})`, background: COLORES_DUENO.fondo, color: COLORES_DUENO.texto }}>
        <header style={cabeceraEstilo}>
          <img src={logo} alt="" width={W.logo} height={W.logo} style={{ display: "block", flexShrink: 0, width: pt(W.logo), height: pt(W.logo) }} />
          <strong style={nombreTienda}>{negocio.nombre}</strong>
          {cabecera && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={etiqueta}>{cabecera.label}</div>
              <div style={{ fontSize: pt(W.valorCabecera), lineHeight: 1.1, marginTop: pt(2) }}>{cabecera.value}</div>
            </div>
          )}
        </header>
        {/* Alto de Wallet y `cover`: la banda se pinta más alta que su imagen y pierde los lados. */}
        <div style={{ aspectRatio: `${W.ancho} / ${W.banda}` }}>
          <img src={comoDataUri(banda.svg)} alt="Visitas de cada día de la semana"
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: pt(W.hueco), padding: `${pt(W.arribaCampos)} ${pt(W.margen)} ${pt(W.margen)}` }}>
          {abajo.map((c, i) => (
            <div key={c.key} style={{ flex: "0 1 auto", minWidth: 0 }}>
              <div style={{ ...etiqueta, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
              <div style={{ fontSize: pt(fila[i].tam), lineHeight: 1.18, marginTop: pt(3), letterSpacing: "-0.01em" }}>
                {fila[i].lineas.map((l, j) => <div key={j} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>)}
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* En el iPhone la (i) abre la hoja de información de la tarjeta: aquí se ve que se toca. */}
      <button type="button" onClick={() => setInfo((v) => !v)} aria-expanded={info}
        style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 7, marginTop: 10 }}>
        <Icono nombre={info ? "cerrar" : "nota"} tam={16} />
        {info ? "Cerrar información" : "Información"}
      </button>
      {info && (
        <div style={reverso}>
          {campos.backFields.filter(Boolean).map((c, i) => (
            <div key={c.key} style={{ padding: "10px 0", borderTop: i ? `1px solid ${C.borde}` : "none" }}>
              <div style={{ fontSize: 12, color: C.suave }}>{c.label}</div>
              <div style={{ fontSize: 14, marginTop: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {partesConEnlaces(c.value).map((p, j) => p.enlace
                  ? <a key={j} href={p.texto} target="_blank" rel="noopener noreferrer" style={{ color: C.azul }}>{p.texto}</a>
                  : <span key={j}>{p.texto}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const tarjeta = {
  containerType: "inline-size",
  borderRadius: W.radio,
  overflow: "hidden",
  fontFamily: FUENTE_PASE,
  boxShadow: "0 22px 44px -18px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.1), inset 0 0 0 1px rgba(255,255,255,.06)",
};

// El brillo de arriba es de Wallet: la cabecera sale un pelo más clara que el resto.
const cabeceraEstilo = {
  display: "flex", alignItems: "center", gap: pt(12), minHeight: pt(W.cabecera), padding: `0 ${pt(W.margen)}`,
  background: "linear-gradient(rgba(255,255,255,.07), rgba(255,255,255,0))",
};

const nombreTienda = {
  flex: 1, minWidth: 0, fontSize: pt(W.nombre), fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const etiqueta = {
  fontSize: pt(W.etiqueta), fontWeight: 500, lineHeight: 1.2, letterSpacing: pt(0.4),
  textTransform: "uppercase", color: COLORES_DUENO.etiqueta,
};

const reverso = {
  marginTop: 10, padding: "4px 14px", borderRadius: 12,
  background: C.panel, color: C.texto, border: `1px solid ${C.borde}`,
};
