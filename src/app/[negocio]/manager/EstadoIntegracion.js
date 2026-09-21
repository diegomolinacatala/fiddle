"use client";

import { useEffect, useState } from "react";
import { C } from "@/app/ui";

// Panel "¿está todo conectado?" del manager. Lee /api/estado, que comprueba de
// verdad certificado de Apple, base de datos, avisos de Android y Google Wallet,
// y dice qué tocar si algo falla. Se abre solo cuando hay algo mal.
export default function EstadoIntegracion({ accent }) {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    fetch("/api/estado").then((r) => (r.ok ? r.json() : null)).then(setEstado).catch(() => {});
  }, []);

  if (!estado) return null;

  const { apple, push, google } = estado;
  const filas = [
    {
      ok: estado.proveedor === "apple" && apple.ok,
      aviso: estado.proveedor === "walletwallet" || (apple.ok && apple.avisos.length > 0),
      titulo: "iPhone · Apple Wallet",
      detalle: detalleApple(estado),
    },
    { ok: Boolean(push?.ok), titulo: "Android · avisos", detalle: push?.detalle || "Sin datos" },
    {
      ok: Boolean(google?.ok),
      // Sin configurar no es un fallo: Android ya tiene su tarjeta web con avisos.
      aviso: google && !google.configurado,
      titulo: "Android · Google Wallet",
      detalle: google?.detalle || "Sin datos",
    },
    {
      ok: estado.httpsPublico,
      titulo: "URL pública HTTPS",
      detalle: estado.httpsPublico
        ? estado.appUrl
        : `${estado.appUrl} — Apple solo actualiza pases contra HTTPS. Pon APP_URL del deploy.`,
    },
    { ok: estado.supabase.ok, titulo: "Base de datos", detalle: estado.supabase.detalle },
    { ok: estado.authSecret, titulo: "Login seguro", detalle: estado.authSecret ? "AUTH_SECRET configurado" : "Secreto de demo: configura AUTH_SECRET" },
  ];
  const todoBien = filas.every((f) => f.ok || f.aviso);

  return (
    <details open={!todoBien} style={{ ...panel, borderColor: todoBien ? "#bfe5cd" : `${accent}66` }}>
      <summary style={{ cursor: "pointer", fontSize: 14 }}>
        Estado de la integración · {filas.filter((f) => f.ok).length}/{filas.length} listo
      </summary>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {filas.map((f) => (
          <div key={f.titulo} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline", flexWrap: "wrap" }}>
            <span aria-label={f.ok && !f.aviso ? "bien" : f.ok || f.aviso ? "opcional" : "falla"} style={punto(f.ok && !f.aviso ? C.ok : f.ok || f.aviso ? "#c26b04" : C.mal)} />
            <strong style={{ fontWeight: 600, minWidth: 170 }}>{f.titulo}</strong>
            <span style={{ color: C.suave, wordBreak: "break-word", flex: "1 1 220px" }}>{f.detalle}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function detalleApple({ proveedor, apple }) {
  if (proveedor === "walletwallet") return "Usando WalletWallet (plan B). Configura APPLE_* para firmar con tu cuenta.";
  if (!apple.ok) return apple.problemas.join(" · ");
  const base = `Firma propia · ${apple.passTypeId} · caduca ${apple.caduca}`;
  return apple.avisos.length ? `${base} · ${apple.avisos.join(" · ")}` : base;
}

const panel = { marginTop: 16, padding: "10px 14px", borderRadius: 12, border: "1px solid", background: C.panel };
const punto = (color) => ({ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0, alignSelf: "center" });
