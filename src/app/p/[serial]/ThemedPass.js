"use client";

import { useEffect, useState } from "react";

// Tarjeta del cliente, con diseño propio por negocio. El QR codifica /w/<serial>
// (lo que escanea la caja). Es solo lectura: el cliente no actúa aquí.
export default function ThemedPass({ serial, cliente, negocio }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const qr = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${origin}/w/${serial}`)}`
    : null;

  const t = negocio.tema;
  const Body =
    t.estilo === "barber" ? <Barber n={negocio} c={cliente} />
    : t.estilo === "pizza" ? <Pizza n={negocio} c={cliente} />
    : <Coffee n={negocio} c={cliente} />;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: t.pageBg, padding: "1.5rem" }}>
      <style>{keyframes}</style>
      <div style={{ width: "min(360px, 92vw)", textAlign: "center" }}>
        {Body}
        <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 12, display: "inline-block" }}>
          {qr && <img src={qr} alt="QR del pase" width={170} height={170} />}
        </div>
        <p style={{ opacity: 0.75, fontSize: 12, marginTop: 12, color: "#111" }}>
          Este QR es lo que escanea la tienda. En real vive dentro de tu Wallet.
        </p>
        <a href={`/w/${serial}`} style={{ color: "#111", fontSize: 13, fontWeight: 600 }}>Abrir vista de caja →</a>
      </div>
    </main>
  );
}

// ---------------- ☕ COFFEE: colorido y juguetón ----------------
function Coffee({ n, c }) {
  const meta = n.meta, mostr = Math.min(c.sellos, meta), completa = c.sellos >= meta;
  const cups = Array.from({ length: meta }, (_, i) => i < mostr);
  return (
    <div style={{ background: n.tema.cardBg, color: n.tema.ink, borderRadius: 24, padding: 22, boxShadow: "0 18px 50px rgba(0,0,0,.25)", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 18 }}>{n.tema.emoji} {n.nombre}</strong>
        <span style={{ fontSize: 13, opacity: 0.6 }}>{mostr}/{meta}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 18 }}>
        {cups.map((on, i) => (
          <div key={i} style={{ height: 46, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 20, background: on ? n.tema.accent : "#0000000d", border: on ? "0" : `2px dashed ${n.tema.accent}55`, transform: on ? "scale(1)" : "scale(.94)" }}>
            {on ? "☕" : ""}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, fontWeight: 700, color: n.tema.accent }}>
        {completa ? `¡${n.premio}! 🎉` : `Faltan ${meta - c.sellos} para ${n.premio}`}
      </div>
      {n.promo && <Promo t={n.tema} text={n.promo} />}
    </div>
  );
}

// ---------------- 💈 BARBER: sleek, animado, niveles ----------------
function Barber({ n, c }) {
  const meta = n.meta, mostr = Math.min(c.sellos, meta), completa = c.sellos >= meta;
  const cuts = Array.from({ length: meta }, (_, i) => i < mostr);
  const nivel = c.premios >= 3 ? "Oro" : c.premios >= 1 ? "Plata" : "Bronce";
  const nivelColor = nivel === "Oro" ? "#e5c15a" : nivel === "Plata" ? "#cfd3d8" : "#c08457";
  return (
    <div style={{ position: "relative", overflow: "hidden", background: n.tema.cardBg, color: n.tema.ink, borderRadius: 20, padding: 22, border: "1px solid rgba(201,162,75,.35)", textAlign: "left" }}>
      <div className="shine" />
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 8, background: "repeating-linear-gradient(45deg,#c9a24b 0 8px,#1c1c22 8px 16px)", animation: "pole 1.6s linear infinite" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 8 }}>
        <strong style={{ fontSize: 18, letterSpacing: 0.5 }}>{n.tema.emoji} {n.nombre}</strong>
        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, border: `1px solid ${nivelColor}`, color: nivelColor }}>{nivel}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20, paddingLeft: 8, flexWrap: "wrap" }}>
        {cuts.map((on, i) => (
          <span key={i} style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 15, background: on ? "rgba(201,162,75,.18)" : "transparent", border: `1px solid ${on ? n.tema.accent : "rgba(255,255,255,.15)"}`, color: n.tema.accent }}>
            {on ? "✂" : ""}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 18, paddingLeft: 8, color: n.tema.accent, fontWeight: 600 }}>
        {completa ? `¡${n.premio}! ✨` : `${meta - c.sellos} cortes para ${n.premio}`}
      </div>
      <div style={{ marginTop: 6, paddingLeft: 8, fontSize: 12, opacity: 0.55 }}>Nivel {nivel} · {c.premios || 0} premios</div>
      {n.promo && <Promo t={n.tema} text={n.promo} />}
    </div>
  );
}

// ---------------- 🍕 PIZZA: cupón de descuento ----------------
function Pizza({ n, c }) {
  const usado = (c.premios || 0) > 0;
  return (
    <div style={{ position: "relative", background: n.tema.cardBg, color: n.tema.ink, borderRadius: 18, padding: "22px 20px", border: `2px dashed ${n.tema.accent}`, textAlign: "center", overflow: "hidden" }}>
      <div style={{ fontSize: 30, letterSpacing: 6 }}>🍕🍕🍕</div>
      <strong style={{ display: "block", marginTop: 6, fontSize: 18 }}>{n.nombre}</strong>
      <div style={{ marginTop: 14, fontSize: 40, fontWeight: 800, color: n.tema.accent, lineHeight: 1 }}>{n.premio}</div>
      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>Cupón de un solo uso · enséñalo en caja</div>
      <div style={{ marginTop: 14, display: "inline-block", padding: "6px 16px", borderRadius: 999, fontWeight: 700, fontSize: 14, background: usado ? "#8883" : n.tema.accent, color: usado ? "#666" : "#fff", transform: usado ? "rotate(-8deg)" : "none", border: usado ? "2px solid #666" : "0" }}>
        {usado ? "USADO" : "VÁLIDO"}
      </div>
      {n.promo && <Promo t={n.tema} text={n.promo} />}
    </div>
  );
}

function Promo({ t, text }) {
  return (
    <div style={{ marginTop: 14, padding: "10px 12px", background: `${t.accent}22`, borderRadius: 12, textAlign: "left" }}>
      <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>Promoción</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{text}</div>
    </div>
  );
}

const keyframes = `
.shine{position:absolute;top:0;left:-60%;width:50%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.14),transparent);transform:skewX(-18deg);animation:shine 3.2s ease-in-out infinite}
@keyframes shine{0%{left:-60%}55%{left:130%}100%{left:130%}}
@keyframes pole{0%{background-position:0 0}100%{background-position:0 22px}}
`;
