"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

// Escáner de QR con la cámara del móvil. Al leer el pase (que codifica /w/<serial>)
// navega al perfil del cliente. Necesita HTTPS o localhost (contexto seguro).
export default function QrScanner() {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  function handleDecoded(text) {
    // El QR puede ser una URL (…/w/<serial>) o el serial pelado.
    const m = text.match(/\/w\/([^/?#\s]+)/i) || text.match(/([0-9a-f]{8}-[0-9a-f-]{27})/i);
    const serial = (m ? m[1] : text).trim();
    if (!serial) return;
    stop();
    router.push(`/w/${serial}`);
  }

  function tick() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) return handleDecoded(code.data);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      v.setAttribute("playsinline", "true"); // iOS: no pantalla completa
      await v.play();
      setActive(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError("No se pudo abrir la cámara. Da permiso o usa HTTPS. " + (e?.message || ""));
    }
  }

  useEffect(() => () => stop(), []);

  return (
    <div>
      {!active ? (
        <button onClick={start} style={scanBtn}>📷 Escanear pase</button>
      ) : (
        <button onClick={stop} style={stopBtn}>Cerrar cámara</button>
      )}

      <div style={{ display: active ? "block" : "none", marginTop: 12, position: "relative" }}>
        <video ref={videoRef} style={{ width: "100%", borderRadius: 14, background: "#000" }} muted playsInline />
        <div style={frame} />
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {error && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

const scanBtn = {
  width: "100%",
  padding: "1rem",
  borderRadius: 14,
  border: 0,
  background: "#fff",
  color: "#000",
  fontWeight: 500,
  fontSize: "1.05rem",
  cursor: "pointer",
};
const stopBtn = {
  width: "100%",
  padding: "0.7rem",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.3)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
};
const frame = {
  position: "absolute",
  inset: "18%",
  border: "3px solid rgba(255,255,255,.85)",
  borderRadius: 16,
  boxShadow: "0 0 0 9999px rgba(0,0,0,.25)",
  pointerEvents: "none",
};
