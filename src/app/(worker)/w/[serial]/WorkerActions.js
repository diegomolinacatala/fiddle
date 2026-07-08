"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botones de acción del trabajador. Cada uno llama a /api/accion y refresca.
export default function WorkerActions({ serial, acciones }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  async function ejecutar(accion) {
    setBusy(accion);
    setToast(null);
    try {
      const res = await fetch("/api/accion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, accion }),
      });
      const data = await res.json();
      setToast({ ok: res.ok && data.ok !== false, msg: data.mensaje || data.error || "Hecho" });
      router.refresh(); // vuelve a leer el perfil desde el servidor
    } catch (e) {
      setToast({ ok: false, msg: String(e?.message || e) });
    } finally {
      setBusy(null);
    }
  }

  if (!acciones.length) {
    return (
      <p style={{ opacity: 0.5, fontSize: 14, marginTop: 18 }}>
        El manager no ha activado ninguna acción todavía.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {acciones.map((a) => (
          <button key={a.key} onClick={() => ejecutar(a.key)} disabled={busy !== null} style={btn(busy === a.key)}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span>{busy === a.key ? "…" : a.label}</span>
          </button>
        ))}
      </div>

      {toast && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 15,
            background: toast.ok ? "rgba(48,209,88,.15)" : "rgba(255,69,58,.15)",
            border: `1px solid ${toast.ok ? "rgba(48,209,88,.4)" : "rgba(255,69,58,.4)"}`,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const btn = (active) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "16px 10px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.16)",
  background: active ? "#2a2a2e" : "#fff",
  color: active ? "#fff" : "#000",
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
});
