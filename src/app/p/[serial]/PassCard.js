"use client";

import { useEffect, useState } from "react";

// Dibujo del pase estilo Wallet (solo lectura) + su QR de identidad.
// El QR codifica /w/<serial>: al escanearlo, la tienda abre el perfil del cliente.
export default function PassCard({ serial, nombre, sellos, premios, meta, titulo, premio, promo, googleSaveUrl }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const completa = sellos >= meta;
  const mostrados = Math.min(sellos, meta);
  const dots = Array.from({ length: meta }, (_, i) => i < mostrados);

  const workerUrl = origin ? `${origin}/w/${serial}` : "";
  const qr = workerUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(workerUrl)}`
    : null;

  return (
    <div style={{ width: "min(360px, 92vw)", textAlign: "center" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 500 }}>☕ {titulo}</span>
          <span style={{ fontSize: 13, opacity: 0.6 }}>{mostrados}/{meta}</span>
        </div>

        {nombre && <div style={{ marginTop: 10, fontSize: 15, opacity: 0.9 }}>👤 {nombre}</div>}

        <div style={cap}>Sellos</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {dots.map((on, i) => <span key={i} style={dot(on)}>{on ? "★" : ""}</span>)}
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <div style={cap}>Premio</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }}>
            {completa ? `¡${premio}! 🎉` : `Faltan ${meta - sellos}`}
          </div>
        </div>

        {promo && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,214,10,.14)", borderRadius: 12 }}>
            <div style={cap}>Promoción</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{promo}</div>
          </div>
        )}

        {/* El "barcode" del pase */}
        <div style={{ marginTop: 18, background: "#fff", borderRadius: 12, padding: 12 }}>
          {qr && <img src={qr} alt="QR del pase" width={180} height={180} />}
        </div>
      </div>

      {googleSaveUrl && (
        <a href={googleSaveUrl} style={googleBtn}>
          🤖 Guardar en Google Wallet
        </a>
      )}

      <p style={{ opacity: 0.5, fontSize: 13, marginTop: 14 }}>
        Este QR es lo que escanea la tienda. En real vive dentro de tu Wallet.
      </p>
      {workerUrl && (
        <a href={`/w/${serial}`} style={{ color: "#6cf", fontSize: 13 }}>
          Abrir vista del trabajador →
        </a>
      )}
    </div>
  );
}

const cardStyle = {
  background: "#141416",
  borderRadius: 20,
  padding: "22px 20px",
  boxShadow: "0 20px 60px rgba(0,0,0,.55)",
  border: "1px solid rgba(255,255,255,.08)",
  textAlign: "left",
};
const cap = { fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1, margin: "18px 0 8px" };
const googleBtn = {
  display: "inline-block",
  marginTop: 16,
  padding: "0.7rem 1.2rem",
  borderRadius: 999,
  background: "#fff",
  color: "#000",
  fontWeight: 500,
  fontSize: 14,
  textDecoration: "none",
};
const dot = (on) => ({
  width: 26,
  height: 26,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  background: on ? "#fff" : "transparent",
  color: "#000",
  border: on ? "0" : "1.5px solid rgba(255,255,255,.3)",
});
