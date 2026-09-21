"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C, campo, botonSecundario } from "@/app/ui";

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
      setToast(res.ok ? "Nombre guardado" : data.error || "Error");
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
          style={campo}
        />
        <button type="submit" disabled={busy} style={botonSecundario}>
          {busy ? "…" : "Guardar"}
        </button>
      </div>
      {toast && <div style={{ marginTop: 8, fontSize: 13, color: C.suave }}>{toast}</div>}
    </form>
  );
}

const cap = { fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 };
