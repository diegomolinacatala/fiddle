"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { destinoSeguro, negocioDeRuta } from "@/lib/acceso";

// Login único para todos los negocios: usuario + contraseña.
//   nube / nube-caja · fade / fade-caja · forno / forno-caja
// El rol lo decide el usuario. Si el servidor tiene activo el modo pruebas,
// abajo se listan los accesos (y se rellenan al tocarlos).
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = destinoSeguro(params.get("next"));

  const [usuario, setUsuario] = useState(params.get("b") || "");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [accesos, setAccesos] = useState([]);

  useEffect(() => {
    fetch("/api/login")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAccesos(d?.accesos ?? []))
      .catch(() => {});
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo entrar");
        setClave("");
        return;
      }
      // `next` solo se respeta si es del mismo negocio (o no es de ninguno, como /w/...).
      const nextNegocio = negocioDeRuta(next);
      const destino = next && (!nextNegocio || nextNegocio === data.negocio) ? next : `/${data.negocio}/${data.rol === "manager" ? "manager" : "caja"}`;
      router.push(destino);
      router.refresh();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  function usar(acceso) {
    setUsuario(acceso.usuario);
    setClave(acceso.clave);
    setError(null);
  }

  return (
    <main style={wrap}>
      <div style={{ width: "min(380px, 92vw)" }}>
        <form onSubmit={entrar} style={card}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>🔒 Acceso</h1>
          <p style={{ opacity: 0.55, fontSize: 14, marginTop: 6, marginBottom: 4 }}>
            Entra con el usuario de tu negocio.
          </p>

          <label style={lbl} htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="nube"
            autoFocus
            style={input}
          />

          <label style={lbl} htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            style={input}
          />

          <button type="submit" disabled={busy || !usuario || !clave} style={{ ...btn, opacity: busy || !usuario || !clave ? 0.5 : 1 }}>
            {busy ? "Entrando…" : "Entrar"}
          </button>

          {error && <div role="alert" style={errBox}>{error}</div>}
        </form>

        {accesos.length > 0 && (
          <details style={ayuda}>
            <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.8 }}>
              Accesos de prueba (toca uno para rellenarlo)
            </summary>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {accesos.map((a) => (
                <button key={a.usuario} type="button" onClick={() => usar(a)} style={fila}>
                  <span>{a.emoji} {a.negocio}</span>
                  <span style={{ opacity: 0.55 }}>{a.rol === "manager" ? "manager" : "caja"}</span>
                  <code style={{ fontSize: 12 }}>{a.usuario} / {a.clave}</code>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, opacity: 0.45, marginBottom: 0 }}>
              Solo mientras el servidor tenga USUARIOS_DEMO=1. Quítalo antes de abrir al público.
            </p>
          </details>
        )}
      </div>
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

const wrap = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0c", color: "#fff", padding: "1.5rem" };
const card = { background: "#141416", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column" };
const lbl = { fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 4px" };
const input = { width: "100%", boxSizing: "border-box", padding: "0.7rem 0.9rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.18)", background: "#0e0e10", color: "#fff", fontSize: 16 };
const btn = { marginTop: 18, padding: "0.7rem 1.2rem", borderRadius: 999, border: 0, background: "#fff", color: "#000", fontWeight: 600, fontSize: 15, cursor: "pointer" };
const errBox = { marginTop: 14, padding: "10px 14px", borderRadius: 12, fontSize: 14, background: "rgba(255,69,58,.15)", border: "1px solid rgba(255,69,58,.4)" };
const ayuda = { marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "#101012", border: "1px dashed rgba(255,255,255,.18)" };
const fila = {
  display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", textAlign: "left",
  padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "#16161a",
  color: "#fff", fontSize: 13, cursor: "pointer",
};
