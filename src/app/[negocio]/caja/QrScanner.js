"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icono from "@/app/Icono";
import { C, botonSecundario } from "@/app/ui";
import { serialDeQr } from "@/lib/url";

// ============================================================================
// ESCÁNER DE LA CAJA
// ----------------------------------------------------------------------------
// Lee el QR de la tarjeta (que lleva /w/<serial>) y abre el perfil del cliente.
//
// En Android usa el lector de códigos del propio Chrome (BarcodeDetector): es
// nativo, lee a más distancia y con peor luz que jsQR, y no calienta el móvil.
// Donde no existe (iPhone, Firefox) se cae a jsQR sobre una imagen reducida.
//
// Extras del mostrador: linterna si la cámara la tiene, vibración al leer y
// arranque directo (`autoabrir`) cuando la caja vuelve de atender a alguien.
// Necesita HTTPS o localhost para la cámara.
// ============================================================================

const ANCHO_JSQR = 640; // jsQR sobre la imagen entera de una cámara 1080p va a tirones

async function crearDetector() {
  if (!("BarcodeDetector" in window)) return null;
  try {
    const formatos = await window.BarcodeDetector.getSupportedFormats();
    return formatos.includes("qr_code") ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

export default function QrScanner({ accent = C.texto, autoabrir = false }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const bucleRef = useRef(null);
  const detectorRef = useRef(null);
  const jsQRRef = useRef(null);
  const [activo, setActivo] = useState(false);
  const [linterna, setLinterna] = useState(null); // null = la cámara no tiene
  const [error, setError] = useState(null);
  const [ajeno, setAjeno] = useState(false);

  function parar() {
    cancelAnimationFrame(bucleRef.current);
    bucleRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActivo(false);
    setLinterna(null);
  }

  function leido(texto) {
    const serial = serialDeQr(texto);
    if (!serial) {
      // Un QR que no es una tarjeta (el de la carta, el del wifi): se avisa y se sigue.
      setAjeno(true);
      return false;
    }
    navigator.vibrate?.(60);
    parar();
    router.push(`/w/${serial}`);
    return true;
  }

  async function leerFotograma() {
    const v = videoRef.current;
    if (!v || v.readyState < v.HAVE_ENOUGH_DATA) return null;
    if (detectorRef.current) {
      const codigos = await detectorRef.current.detect(v);
      return codigos[0]?.rawValue || null;
    }
    // jsQR solo se descarga donde hace falta (iPhone, Firefox): en Android no pesa nada.
    jsQRRef.current ||= (await import("jsqr")).default;
    const c = canvasRef.current;
    const escala = Math.min(1, ANCHO_JSQR / v.videoWidth);
    c.width = Math.round(v.videoWidth * escala);
    c.height = Math.round(v.videoHeight * escala);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    return jsQRRef.current(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data || null;
  }

  function bucle() {
    bucleRef.current = requestAnimationFrame(async () => {
      if (!streamRef.current) return;
      try {
        const texto = await leerFotograma();
        if (texto && leido(texto)) return;
      } catch {
        // Un fotograma que no se pudo leer no es un error: se prueba con el siguiente.
      }
      if (streamRef.current) bucle();
    });
  }

  async function empezar() {
    setError(null);
    setAjeno(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      detectorRef.current = await crearDetector();
      const v = videoRef.current;
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      await v.play();
      setActivo(true);
      const pista = stream.getVideoTracks()[0];
      if (pista?.getCapabilities?.().torch) setLinterna(false);
      bucle();
    } catch (e) {
      parar();
      setError(e?.name === "NotAllowedError"
        ? "Sin permiso para la cámara. Dáselo en los ajustes del navegador para esta web."
        : "No se pudo abrir la cámara. Comprueba que ninguna otra app la está usando.");
    }
  }

  async function alternarLinterna() {
    const pista = streamRef.current?.getVideoTracks()[0];
    if (!pista) return;
    try {
      await pista.applyConstraints({ advanced: [{ torch: !linterna }] });
      setLinterna(!linterna);
    } catch {
      setLinterna(null);
    }
  }

  // Volviendo de atender a un cliente (?escanear=1): si ya hay permiso, la
  // cámara se abre sola y el siguiente de la cola no espera.
  useEffect(() => {
    let vivo = true;
    const auto = autoabrir || new URLSearchParams(window.location.search).get("escanear") === "1";
    if (auto && navigator.permissions?.query) {
      navigator.permissions.query({ name: "camera" })
        .then((p) => { if (vivo && p.state === "granted") empezar(); })
        .catch(() => {});
    }
    return () => { vivo = false; parar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ajeno) return;
    const t = setTimeout(() => setAjeno(false), 2500);
    return () => clearTimeout(t);
  }, [ajeno]);

  return (
    <div>
      {!activo && (
        <button onClick={empezar} style={{ ...botonEscanear, background: accent }}>
          <Icono nombre="camara" tam={22} />
          Escanear tarjeta
        </button>
      )}

      <div style={{ display: activo ? "block" : "none", position: "relative" }}>
        <video ref={videoRef} style={video} muted playsInline />
        <div style={marco} aria-hidden>
          {["tl", "tr", "bl", "br"].map((e) => <span key={e} style={esquina(e)} />)}
        </div>
        <div style={pista}>{ajeno ? "Ese QR no es una tarjeta de la tienda" : "Apunta al QR de la tarjeta"}</div>
      </div>

      {activo && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {linterna !== null && (
            <button onClick={alternarLinterna} style={{ ...botonSecundario, flex: 1, ...fila, ...(linterna ? { background: "#fff7d6", borderColor: "#e8c95a" } : {}) }} aria-pressed={linterna}>
              <Icono nombre="linterna" tam={18} /> {linterna ? "Apagar luz" : "Linterna"}
            </button>
          )}
          <button onClick={parar} style={{ ...botonSecundario, flex: 1, ...fila }}>
            <Icono nombre="cerrar" tam={18} /> Cerrar cámara
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
      {error && <p role="alert" style={{ color: C.mal, fontSize: 14, margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}

const botonEscanear = {
  width: "100%", minHeight: 58, padding: "0 1rem", borderRadius: 14, border: 0, color: "#fff",
  fontWeight: 650, fontSize: "1.08rem", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
};
const fila = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const video = { width: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 16, background: "#000", display: "block" };
const marco = { position: "absolute", inset: "14% 12% 22%", pointerEvents: "none" };
const esquina = (donde) => ({
  position: "absolute", width: 34, height: 34, borderColor: "#fff", borderStyle: "solid", borderWidth: 0,
  ...(donde[0] === "t" ? { top: 0, borderTopWidth: 4 } : { bottom: 0, borderBottomWidth: 4 }),
  ...(donde[1] === "l" ? { left: 0, borderLeftWidth: 4 } : { right: 0, borderRightWidth: 4 }),
  borderRadius: { tl: "14px 0 0 0", tr: "0 14px 0 0", bl: "0 0 0 14px", br: "0 0 14px 0" }[donde],
});
const pista = {
  position: "absolute", left: 12, right: 12, bottom: 14, textAlign: "center", color: "#fff", fontSize: 14,
  fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,.6)",
};
