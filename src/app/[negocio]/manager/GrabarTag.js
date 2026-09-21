"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { C, aviso, botonPrimario, botonSecundario } from "@/app/ui";

// ============================================================================
// GRABAR EL TAG NFC DESDE EL NAVEGADOR (Android)
// ----------------------------------------------------------------------------
// Chrome en Android sabe escribir tags NFC (Web NFC): el dueño toca "Grabar",
// acerca el tag a la parte de atrás del móvil y listo, sin instalar NFC Tools.
// En iPhone y en ordenador no existe, y este bloque no sale: queda el QR y el
// botón de copiar la URL de siempre.
// ============================================================================

const ERRORES = {
  NotAllowedError: "Chrome no tiene permiso para usar el NFC. Acéptalo cuando lo pregunte.",
  NotSupportedError: "Este móvil no tiene NFC o lo tiene apagado (Ajustes > Conexiones > NFC).",
  NetworkError: "El tag se apartó antes de terminar. Vuelve a acercarlo y no lo muevas.",
  NotReadableError: "No se pudo escribir en ese tag. ¿Está bloqueado contra escritura?",
};

export default function GrabarTag({ url, accent }) {
  const [soportado, setSoportado] = useState(false);
  const [estado, setEstado] = useState(null); // null | "esperando" | "hecho" | "error"
  const [error, setError] = useState(null);
  const cancelar = useRef(null);

  useEffect(() => {
    setSoportado("NDEFReader" in window);
    return () => cancelar.current?.abort();
  }, []);

  if (!soportado || !url) return null;

  async function grabar() {
    setError(null);
    setEstado("esperando");
    const control = new AbortController();
    cancelar.current = control;
    try {
      const ndef = new window.NDEFReader();
      await ndef.write({ records: [{ recordType: "url", data: url }] }, { signal: control.signal, overwrite: true });
      navigator.vibrate?.(80);
      setEstado("hecho");
    } catch (e) {
      if (e?.name === "AbortError") return setEstado(null);
      setError(ERRORES[e?.name] || "No se pudo grabar el tag. Prueba otra vez.");
      setEstado("error");
    }
  }

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: `1px dashed ${accent}88`, background: `${accent}0d` }}>
      {estado === "esperando" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <span style={{ color: accent }}><Icono nombre="nfc" tam={22} /></span>
            Acerca el tag a la parte de atrás del móvil…
          </div>
          <button onClick={() => cancelar.current?.abort()} style={{ ...botonSecundario, marginTop: 10, fontSize: 13, padding: "0.45rem 0.85rem" }}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button onClick={grabar} style={{ ...botonPrimario(accent), display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icono nombre="nfc" tam={18} /> Grabar un tag con este móvil
          </button>
          <p style={{ fontSize: 12, color: C.suave, margin: "8px 0 0" }}>
            Graba esta URL en el tag. Cualquier teléfono que lo toque recibirá su tarjeta.
          </p>
        </>
      )}
      {estado === "hecho" && <div role="status" style={{ ...aviso(true), marginTop: 10 }}>Tag grabado. Pruébalo acercando otro móvil.</div>}
      {estado === "error" && <div role="alert" style={{ ...aviso(false), marginTop: 10 }}>{error}</div>}
    </div>
  );
}
