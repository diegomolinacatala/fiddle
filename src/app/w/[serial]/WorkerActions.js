"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icono from "@/app/Icono";
import { C, aviso } from "@/app/ui";

// Botones de acción del trabajador. Cada uno llama a /api/accion y refresca.
// Vibra al terminar (en Android): la caja va rápida y no siempre mira la pantalla.
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
      const ok = res.ok && data.ok !== false;
      setToast({ ok, msg: data.mensaje || data.error || "Hecho", detalle: ok ? resumenAviso(data.aviso) : null });
      navigator.vibrate?.(ok ? 50 : [80, 60, 80]);
      router.refresh();
    } catch (e) {
      setToast({ ok: false, msg: "Sin conexión. No se ha guardado: vuelve a intentarlo." });
    } finally {
      setBusy(null);
    }
  }

  if (!acciones.length) {
    return <p style={{ color: C.suave, fontSize: 14, marginTop: 18 }}>El manager no ha activado ninguna acción.</p>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: acciones.length > 1 ? "1fr 1fr" : "1fr", gap: 10 }}>
        {acciones.map((a) => (
          <button key={a.key} onClick={() => ejecutar(a.key)} disabled={busy !== null} style={btn(busy === a.key, accent, a.correccion)}>
            <Icono nombre={a.icon} tam={24} grosor={2.2} />
            <span>{busy === a.key ? "Guardando…" : a.label}</span>
          </button>
        ))}
      </div>
      {toast && (
        <div role="status" style={{ ...aviso(toast.ok), marginTop: 12 }}>
          {toast.msg}
          {toast.detalle && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{toast.detalle}</div>}
        </div>
      )}
    </div>
  );
}

// "Le ha llegado al iPhone" / "…al Android": que la caja sepa que el cliente se ha enterado.
function resumenAviso(a) {
  if (!a) return null;
  const donde = [
    a.avisados > 0 && "iPhone",
    (a.web > 0 || a.google > 0) && "Android",
  ].filter(Boolean);
  return donde.length ? `Aviso enviado a su ${donde.join(" y su ")}.` : null;
}

const btn = (activo, accent, correccion) => ({
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
  minHeight: 76, padding: "14px 10px", borderRadius: 14,
  border: correccion ? `1.5px solid ${accent}` : 0,
  background: correccion ? "#fff" : accent, color: correccion ? accent : "#fff", opacity: activo ? 0.6 : 1,
  fontWeight: 650, fontSize: 15, cursor: "pointer",
});
