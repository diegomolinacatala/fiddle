"use client";

import { useEffect, useState } from "react";

// Panel "¿está todo conectado?" del manager: proveedor de Wallet, base de datos,
// login seguro. Lee /api/estado (nunca expone secretos, solo si existen).
export default function EstadoIntegracion({ accent }) {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    fetch("/api/estado").then((r) => (r.ok ? r.json() : null)).then(setEstado).catch(() => {});
  }, []);

  if (!estado) return null;

  const filas = [
    {
      ok: estado.proveedor === "apple",
      aviso: estado.proveedor === "walletwallet",
      titulo: "Apple Wallet",
      detalle:
        estado.proveedor === "apple"
          ? `Firma propia · ${estado.apple.passTypeId}`
          : estado.proveedor === "walletwallet"
            ? "Usando WalletWallet (plan B). Configura APPLE_* para firmar con tu cuenta."
            : `Modo demo. Faltan: ${estado.apple.faltan.join(", ")}`,
    },
    {
      ok: estado.httpsPublico,
      titulo: "URL pública HTTPS",
      detalle: estado.httpsPublico
        ? estado.appUrl
        : `${estado.appUrl} — Apple solo actualiza pases contra HTTPS. Pon APP_URL del deploy.`,
    },
    { ok: estado.supabase, titulo: "Base de datos", detalle: estado.supabase ? "Supabase" : "Ficheros locales (no válido en Vercel)" },
    { ok: estado.authSecret, titulo: "Login seguro", detalle: estado.authSecret ? "AUTH_SECRET configurado" : "Secreto de demo: configura AUTH_SECRET" },
    { ok: estado.google, aviso: !estado.google, titulo: "Google Wallet", detalle: estado.google ? "Activo" : "Opcional · sin configurar" },
  ];

  return (
    <details style={{ ...panel, borderColor: filas.every((f) => f.ok || f.aviso) ? "rgba(48,209,88,.35)" : `${accent}66` }}>
      <summary style={{ cursor: "pointer", fontSize: 14 }}>
        Estado de la integración · {filas.filter((f) => f.ok).length}/{filas.length} listo
      </summary>
      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {filas.map((f) => (
          <div key={f.titulo} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline" }}>
            <span aria-hidden>{f.ok ? "🟢" : f.aviso ? "🟡" : "🔴"}</span>
            <strong style={{ fontWeight: 500, minWidth: 130 }}>{f.titulo}</strong>
            <span style={{ opacity: 0.65, wordBreak: "break-word" }}>{f.detalle}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

const panel = { marginTop: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid", background: "#111113" };
