"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Editor del nombre del cliente (personalización del pase). El trabajador lo
// rellena en caja; al guardar, el pase se reconstruye y se empuja.
export default function SetNombre({ serial, nombre }) {
  const router = useRouter();
  const [valor, setValor] = useState(nombre || "");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/cliente/${serial}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: valor }),
      });
      const data = await res.json();
      setToast(res.ok ? "Nombre guardado ✔" : data.error || "Error");
      router.refresh();
    } catch (err) {
      setToast(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={guardar} style={{ marginTop: 18 }}>
      <div style={cap}>Nombre del cliente (opcional)</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="p. ej. Marta"
          maxLength={48}
          style={input}
        />
        <button type="submit" disabled={busy} style={btn}>
          {busy ? "…" : "Guardar"}
        </button>
      </div>
      {toast && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>{toast}</div>}
    </form>
  );
}

const cap = {
  fontSize: 12,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
};
const input = {
  flex: 1,
  padding: "0.6rem 0.8rem",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "#141416",
  color: "#fff",
  fontSize: 15,
};
const btn = {
  padding: "0.6rem 1rem",
  borderRadius: 12,
  border: 0,
  background: "#fff",
  color: "#000",
  fontWeight: 500,
  cursor: "pointer",
};
