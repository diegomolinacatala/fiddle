"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Login por PIN. El mismo formulario sirve para caja y manager: el rol lo decide
// el PIN. Tras entrar, va a `next` (la ruta que pidió) o al home del rol.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "";
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo entrar");
        return;
      }
      const destino = next || (data.role === "manager" ? "/manager" : "/worker");
      router.push(destino);
      router.refresh();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={wrap}>
      <form onSubmit={entrar} style={card}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>🔒 Acceso</h1>
        <p style={{ opacity: 0.55, fontSize: 14, marginTop: 6 }}>
          Introduce el PIN de tu terminal.
        </p>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          autoFocus
          style={input}
        />

        <button type="submit" disabled={busy || !pin} style={btn}>
          {busy ? "Entrando…" : "Entrar"}
        </button>

        {error && (
          <div style={errBox}>{error}</div>
        )}
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const wrap = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0b0b0c",
  color: "#fff",
  padding: "1.5rem",
};
const card = {
  width: "min(360px, 92vw)",
  background: "#141416",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 16,
  padding: 24,
  display: "flex",
  flexDirection: "column",
};
const input = {
  marginTop: 10,
  width: "100%",
  boxSizing: "border-box",
  padding: "0.75rem 0.9rem",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "#0e0e10",
  color: "#fff",
  fontSize: 18,
  letterSpacing: 4,
  textAlign: "center",
};
const btn = {
  marginTop: 14,
  padding: "0.7rem 1.2rem",
  borderRadius: 999,
  border: 0,
  background: "#fff",
  color: "#000",
  fontWeight: 500,
  fontSize: 15,
  cursor: "pointer",
};
const errBox = {
  marginTop: 14,
  padding: "10px 14px",
  borderRadius: 12,
  fontSize: 14,
  background: "rgba(255,69,58,.15)",
  border: "1px solid rgba(255,69,58,.4)",
};
