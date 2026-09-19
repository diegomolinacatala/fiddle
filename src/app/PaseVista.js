"use client";

import { useState } from "react";
import QrImagen from "@/app/QrImagen";
import { camposDelPase } from "@/lib/apple/pase";
import { svgLogo, stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { puntosDe, estadoDe } from "@/lib/resumen";
import { C } from "@/app/ui";

// ============================================================================
// VISTA PREVIA DEL PASE (Apple / Google)
// ----------------------------------------------------------------------------
// Lo que el manager ve mientras configura su cartilla. No es un pase de verdad,
// pero tampoco es una maqueta inventada: todo lo que sale aquí viene de las
// mismas funciones que arman el pase real.
//
//   texto  -> camposDelPase()             (el mismo que llena pass.json)
//   dibujo -> stripDelPase() y svgLogo()  (el mismo SVG que va dentro del .pkpass)
//   Google -> puntosDe()                  (el mismo contador del loyaltyObject)
//
// Lo que no se puede copiar es la tipografía de iOS y su espaciado exacto, así
// que la disposición es la de Apple (cabecera, banda a sangre, secundarios,
// auxiliares y código) pero con tipos del sistema.
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
        {pie || "Parecido, no idéntico: la banda y el logo son los del pase real; la tipografía la pone iOS."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Apple
// Orden real de un pase: cabecera (logo + nombre | headerFields), banda a
// sangre, secundarios, auxiliares y el código abajo. En los cupones los
// primaryFields van ENCIMA de la banda (por eso su dibujo deja hueco a la
// izquierda); en las cartillas no hay primarios y la banda se ve entera.
function TarjetaApple({ negocio, cliente, qrTexto }) {
  const t = negocio.tema;
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields, backFields } =
    camposDelPase(cliente, negocio);
  const strip = stripDelPase(negocio, cliente);

  return (
    <div style={{ ...marco, background: t.cardBg, color: t.ink, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <img src={comoDataUri(svgLogo(t))} alt="" width={26} height={26} style={{ display: "block", flexShrink: 0 }} />
        <strong style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{negocio.nombre}</strong>
        {headerFields.map((f) => (
          <div key={f.key} style={{ textAlign: "right" }}>
            <div style={etiquetaPase(t.accent)}>{f.label}</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{f.value}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <img
          src={comoDataUri(strip.svg)}
          alt={`Banda del pase, ${strip.ancho}×${strip.alto} puntos`}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        {primaryFields.length > 0 && (
          <div style={sobreLaBanda}>
            <div style={{ ...etiquetaPase("#ffffff"), opacity: 0.9 }}>{primaryFields[0].label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.1, maxWidth: "58%", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
              {primaryFields[0].value}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 12px 0" }}>
        <Fila campos={secondaryFields} accent={t.accent} />
        <Fila campos={auxiliaryFields} accent={t.accent} margen={12} />
      </div>

      <div style={{ display: "grid", placeItems: "center", padding: "16px 12px 14px" }}>
        <div style={{ background: "#fff", padding: 8, borderRadius: 6 }}>
          <QrImagen texto={qrTexto} lado={104} />
        </div>
        <div style={{ fontSize: 12, letterSpacing: 2, marginTop: 6, fontFamily: "ui-monospace, Menlo, monospace" }}>
          {cliente.codigo || "—"}
        </div>
      </div>

      <div style={{ margin: "0 12px 12px", paddingTop: 10, borderTop: `1px solid ${t.accent}33`, opacity: 0.75 }}>
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

function Fila({ campos, accent, margen = 0 }) {
  if (!campos.length) return null;
  return (
    <div style={{ display: "flex", gap: 14, marginTop: margen }}>
      {campos.map((f) => (
        <div key={f.key} style={{ flex: 1, minWidth: 0 }}>
          <div style={etiquetaPase(accent)}>{f.label}</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 1 }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Google
// LoyaltyObject: cabecera de color, titular, contador de puntos y el código
// abajo. Sin banda: el objeto que manda `googlewallet.js` no lleva imagen, así
// que dibujarla aquí sería enseñar algo que el cliente no va a ver.
function TarjetaGoogle({ negocio, cliente, qrTexto }) {
  const t = negocio.tema;
  const puntos = puntosDe(cliente, negocio);
  const e = estadoDe(cliente, negocio);

  return (
    <div style={{ ...marco, background: "#fff", color: "#202124", overflow: "hidden", fontFamily: "Roboto, system-ui, sans-serif" }}>
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
  border: `1px solid ${C.borde}`,
  boxShadow: "0 8px 24px rgba(16,20,28,.12)",
};

const sobreLaBanda = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "0 14px",
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
