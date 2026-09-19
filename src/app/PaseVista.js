"use client";

import { useState } from "react";
import QrImagen from "@/app/QrImagen";
import { camposDelPase } from "@/lib/apple/pase";
import { puntosDe, estadoDe } from "@/lib/resumen";
import { C } from "@/app/ui";

// ============================================================================
// VISTA PREVIA DEL PASE (Apple / Google)
// ----------------------------------------------------------------------------
// Lo que el manager ve mientras configura su cartilla. No es un pase de verdad:
// es una maqueta HTML con la misma información y una disposición parecida.
//
// Los campos NO se escriben aquí: salen de `camposDelPase` (Apple) y `puntosDe`
// (Google), las mismas funciones que rellenan el pase real. Así la vista previa
// no puede mentir sobre lo que verá el cliente, aunque los píxeles no cuadren.
// ============================================================================

export default function PaseVista({ negocio, cliente, qrTexto, pie = null }) {
  const [cual, setCual] = useState("apple");

  return (
    <div>
      <div style={conmutador}>
        {[
          ["apple", " Apple Wallet"],
          ["google", "Google Wallet"],
        ].map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCual(id)}
            aria-pressed={cual === id}
            style={opcion(cual === id)}
          >
            {texto}
          </button>
        ))}
      </div>

      {cual === "apple"
        ? <TarjetaApple negocio={negocio} cliente={cliente} qrTexto={qrTexto} />
        : <TarjetaGoogle negocio={negocio} cliente={cliente} qrTexto={qrTexto} />}

      <p style={{ fontSize: 12, color: C.tenue, margin: "10px 0 0", textAlign: "center" }}>
        {pie || "Aproximado: el pase definitivo lo dibuja el teléfono."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Apple
// storeCard / coupon: cabecera con el nombre, filas de campos y el QR abajo.
// Colores del pase real: fondo cardBg, texto ink, etiquetas accent.
function TarjetaApple({ negocio, cliente, qrTexto }) {
  const t = negocio.tema;
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields, backFields } =
    camposDelPase(cliente, negocio);
  const codigo = cliente.codigo || "—";

  return (
    <div style={{ ...marco, background: t.cardBg, color: t.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <strong style={{ fontSize: 15, fontWeight: 600 }}>{t.emoji} {negocio.nombre}</strong>
        <Fila campos={headerFields} accent={t.accent} alinear="right" compacto />
      </div>

      {primaryFields.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={etiquetaPase(t.accent)}>{primaryFields[0].label}</div>
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{primaryFields[0].value}</div>
        </div>
      )}

      <Fila campos={secondaryFields} accent={t.accent} margen={18} />
      <Fila campos={auxiliaryFields} accent={t.accent} margen={14} />

      <div style={{ display: "grid", placeItems: "center", marginTop: 18 }}>
        <div style={{ background: "#fff", padding: 8, borderRadius: 6 }}>
          <QrImagen texto={qrTexto} lado={104} />
        </div>
        <div style={{ fontSize: 12, letterSpacing: 2, marginTop: 6, fontFamily: "ui-monospace, Menlo, monospace" }}>
          {codigo}
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.accent}33`, opacity: 0.75 }}>
        <div style={{ ...etiquetaPase(t.accent), marginBottom: 4 }}>Reverso</div>
        {backFields.map((f) => (
          <div key={f.key} style={{ fontSize: 11, marginTop: 2 }}>
            <span style={{ opacity: 0.7 }}>{f.label}: </span>{f.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function Fila({ campos, accent, margen = 0, alinear = "left", compacto = false }) {
  if (!campos.length) return null;
  return (
    <div style={{ display: "flex", gap: 18, marginTop: margen, textAlign: alinear }}>
      {campos.map((f) => (
        <div key={f.key} style={{ flex: alinear === "right" ? "0 0 auto" : 1, minWidth: 0 }}>
          <div style={etiquetaPase(accent)}>{f.label}</div>
          <div style={{ fontSize: compacto ? 15 : 16, fontWeight: 500, marginTop: 1 }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Google
// LoyaltyObject: cabecera de color con el negocio, nombre de la cuenta, el
// contador de puntos y el código de barras abajo, sobre blanco.
function TarjetaGoogle({ negocio, cliente, qrTexto }) {
  const t = negocio.tema;
  const puntos = puntosDe(cliente, negocio);
  const e = estadoDe(cliente, negocio);

  return (
    <div style={{ ...marco, background: "#fff", color: "#202124", padding: 0, overflow: "hidden", fontFamily: "Roboto, system-ui, sans-serif" }}>
      <div style={{ background: t.accent, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{t.emoji}</span>
        <strong style={{ fontSize: 15, fontWeight: 500 }}>{negocio.nombre}</strong>
      </div>

      <div style={{ padding: "16px 18px" }}>
        <div style={etiquetaGoogle}>Titular</div>
        <div style={{ fontSize: 16 }}>{cliente.nombre || "Cliente"}</div>

        <div style={{ ...etiquetaGoogle, marginTop: 14 }}>{puntos.label}</div>
        <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.2 }}>{puntos.balance}</div>
        <div style={{ fontSize: 13, color: "#5f6368", marginTop: 4 }}>
          {e.esCupon
            ? negocio.premio
            : e.completa ? `Premio listo: ${negocio.premio}` : `Faltan ${e.faltan} para ${negocio.premio}`}
        </div>

        {negocio.promo && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "#f1f3f4", borderRadius: 8 }}>
            <div style={etiquetaGoogle}>Promoción</div>
            <div style={{ fontSize: 14 }}>{negocio.promo}</div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e8eaed", padding: "16px", display: "grid", placeItems: "center" }}>
        <QrImagen texto={qrTexto} lado={104} />
        <div style={{ fontSize: 12, letterSpacing: 2, marginTop: 6, color: "#5f6368", fontFamily: "ui-monospace, Menlo, monospace" }}>
          {cliente.codigo || "—"}
        </div>
      </div>
    </div>
  );
}

const marco = {
  width: "100%",
  maxWidth: 320,
  margin: "0 auto",
  borderRadius: 16,
  padding: 18,
  border: `1px solid ${C.borde}`,
  boxShadow: "0 8px 24px rgba(16,20,28,.12)",
};

const etiquetaPase = (accent) => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: accent,
});

const etiquetaGoogle = { fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "#5f6368" };

const conmutador = {
  display: "flex",
  gap: 4,
  padding: 4,
  background: C.fondo,
  border: `1px solid ${C.borde}`,
  borderRadius: 10,
  margin: "0 auto 14px",
  maxWidth: 320,
};

const opcion = (activo) => ({
  flex: 1,
  padding: "0.45rem 0.5rem",
  borderRadius: 7,
  border: 0,
  background: activo ? "#fff" : "transparent",
  color: activo ? C.texto : C.suave,
  fontSize: 13,
  fontWeight: activo ? 600 : 500,
  cursor: "pointer",
  boxShadow: activo ? "0 1px 3px rgba(16,20,28,.16)" : "none",
});
