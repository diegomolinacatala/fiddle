"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C, aviso } from "@/app/ui";

// Botones de acción del trabajador. Cada uno llama a /api/accion y refresca.
export default function WorkerActions({ serial, acciones, accent = C.texto }) {
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
      router.refresh();
    } catch (e) {
      setToast({ ok: false, msg: String(e?.message || e) });
    } finally {
      setBusy(null);
    }
  }

  if (!acciones.length) {
    return <p style={{ color: C.suave, fontSize: 14, marginTop: 18 }}>El manager no ha activado ninguna acción.</p>;
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: acciones.length > 1 ? "1fr 1fr" : "1fr", gap: 10 }}>
        {acciones.map((a) => (
          <button key={a.key} onClick={() => ejecutar(a.key)} disabled={busy !== null} style={btn(busy === a.key, accent)}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span>{busy === a.key ? "…" : a.label}</span>
          </button>
        ))}
      </div>
      {toast && <div style={{ ...aviso(toast.ok), marginTop: 14 }}>{toast.msg}</div>}
    </div>
  );
}

const btn = (activo, accent) => ({
  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  padding: "16px 10px", borderRadius: 12, border: 0,
  background: accent, color: "#fff", opacity: activo ? 0.6 : 1,
  fontWeight: 600, fontSize: 14, cursor: "pointer",
});
