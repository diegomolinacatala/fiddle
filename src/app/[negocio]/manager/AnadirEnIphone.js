"use client";

import { useCallback, useEffect, useState } from "react";
import QrImagen from "@/app/QrImagen";
import { BotonAppleWallet } from "@/app/BotonesWallet";
import { plataformaDe } from "@/lib/plataforma";
import { C, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// AÑADIR LA TARJETA DEL DUEÑO A SU IPHONE
// ----------------------------------------------------------------------------
// En el iPhone, el botón de Wallet de siempre (va con su sesión). En cualquier
// otro sitio (el ordenador, casi siempre) un QR: la cámara del iPhone lo abre en
// Safari, que no tiene la sesión, así que el enlace lleva una llave firmada que
// caduca (lib/dueno/enlace.js). Se pide al enseñarlo y, al caducar, se ofrece otro:
// un QR que ya no vale no se queda en pantalla como si valiera.
// ============================================================================

/** La llave del QR: { url, hasta } o el error. Se pide al montar y con `otra()`. */
function useEnlace(slug, activo) {
  const [enlace, setEnlace] = useState(null);
  const [error, setError] = useState(false);
  const [caducado, setCaducado] = useState(false);
  const pedir = useCallback(async () => {
    setError(false);
    setCaducado(false);
    setEnlace(null);
    try {
      const res = await fetch(`/api/dueno/enlace?b=${encodeURIComponent(slug)}`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const { token, hasta, minutos } = await res.json();
      setEnlace({ url: `${window.location.origin}/api/dueno/pase?t=${encodeURIComponent(token)}`, hasta, minutos });
    } catch {
      setError(true);
    }
  }, [slug]);
  useEffect(() => {
    if (activo) pedir();
  }, [activo, pedir]);
  useEffect(() => {
    if (!enlace) return undefined;
    const quedan = Date.parse(enlace.hasta) - Date.now();
    const t = setTimeout(() => setCaducado(true), Math.max(0, quedan));
    return () => clearTimeout(t);
  }, [enlace]);
  return { enlace, error, caducado, otra: pedir };
}

export default function AnadirEnIphone({ slug, instalada }) {
  // null hasta montar: el servidor no sabe qué teléfono es y no debe pintar ni lo uno ni lo otro.
  const [plataforma, setPlataforma] = useState(null);
  useEffect(() => setPlataforma(plataformaDe(navigator.userAgent)), []);
  const { enlace, error, caducado, otra } = useEnlace(slug, plataforma !== null && plataforma !== "ios");

  if (plataforma === null) return null;
  if (plataforma === "ios") {
    return (
      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
        <BotonAppleWallet href={`/api/dueno/pase?b=${encodeURIComponent(slug)}`} />
        {instalada && <span style={nota}>Ya está en tu Wallet. Añadirla otra vez la pone al día.</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ ...marco, background: enlace && !caducado ? "#fff" : C.panelSuave }} aria-live="polite">
        {enlace && !caducado
          ? <QrImagen texto={enlace.url} lado={116} />
          : <span style={{ ...nota, textAlign: "center", padding: 8 }}>{error ? "No se pudo crear el código." : caducado ? "Caducado." : ""}</span>}
      </div>
      <div style={{ flex: "1 1 160px", minWidth: 0, display: "grid", gap: 8, justifyItems: "start" }}>
        <span style={{ fontSize: 13, lineHeight: 1.4 }}>
          {instalada ? "Ya está en tu Wallet. Para otro iPhone, escanéalo con su cámara." : "Escanéalo con la cámara de tu iPhone y añádela a la Cartera."}
        </span>
        <span style={nota}>
          {caducado || error ? "Pide otro para escanearlo." : `Vale ${enlace?.minutos ?? 10} minutos: es la llave de tu tarjeta, no lo compartas.`}
        </span>
        {(caducado || error) && <button type="button" onClick={otra} style={botonPequeno}>Otro código</button>}
      </div>
    </div>
  );
}

const nota = { fontSize: 12.5, color: C.suave, lineHeight: 1.4 };
// El QR siempre sobre blanco (fondo en línea), también en modo oscuro: las cámaras
// leen mal uno invertido. Sin QR, el fondo del panel, que el texto se lea.
const marco = {
  width: 132, height: 132, flexShrink: 0, display: "grid", placeItems: "center", boxSizing: "border-box",
  padding: 8, borderRadius: RADIO.boton, border: `1px solid ${C.borde}`,
};
