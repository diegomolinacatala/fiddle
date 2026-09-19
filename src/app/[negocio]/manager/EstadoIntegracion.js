"use client";

import { useEffect, useState } from "react";
import { C } from "@/app/ui";

// Panel "¿está todo conectado?" del manager. Lee /api/estado, que comprueba de
// verdad certificado de Apple y Supabase, y dice qué tocar si algo falla.
export default function EstadoIntegracion({ accent }) {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    fetch("/api/estado").then((r) => (r.ok ? r.json() : null)).then(setEstado).catch(() => {});
  }, []);

  if (!estado) return null;

  const { apple } = estado;
  const filas = [
    {
      ok: estado.proveedor === "apple" && apple.ok,
      aviso: estado.proveedor === "walletwallet" || (apple.ok && apple.avisos.length > 0),
      titulo: "Apple Wallet",
      detalle: detalleApple(estado),
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
    { ok: estado.google, aviso: !estado.google, titulo: "Google Wallet", detalle: estado.google ? "Activo" : "Opcional · sin configurar" },
  ];
  const todoBien = filas.every((f) => f.ok || f.aviso);

  return (
    <details open={!todoBien} style={{ ...panel, borderColor: todoBien ? "#bfe5cd" : `${accent}66` }}>
      <summary style={{ cursor: "pointer", fontSize: 14 }}>
        Estado de la integración · {filas.filter((f) => f.ok).length}/{filas.length} listo
      </summary>
      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {filas.map((f) => (
          <div key={f.titulo} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline" }}>
            <span aria-hidden>{f.ok && !f.aviso ? "🟢" : f.ok || f.aviso ? "🟡" : "🔴"}</span>
            <strong style={{ fontWeight: 500, minWidth: 130 }}>{f.titulo}</strong>
            <span style={{ color: C.suave, wordBreak: "break-word" }}>{f.detalle}</span>
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
