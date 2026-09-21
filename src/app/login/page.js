"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { destinoSeguro, negocioDeRuta } from "@/lib/acceso";
import { C, paginaCentrada, panel, campo, etiqueta, aviso } from "@/app/ui";

// PRIMERA PANTALLA de la app: usuario + contraseña, para todos los negocios.
//   nube / nube-caja · fade / fade-caja · forno / forno-caja
// El rol lo decide el usuario. Si el servidor tiene activo el modo pruebas,
// debajo se listan los accesos de ejemplo y se rellenan al tocarlos.
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
      // El admin de la plataforma no tiene tienda: su sitio es /admin.
      // `next` solo se respeta si es del mismo negocio (o no es de ninguno, como /w/...).
      const nextNegocio = negocioDeRuta(next);
      const suSitio = data.rol === "admin" ? "/admin" : `/${data.negocio}/${data.rol === "manager" ? "manager" : "caja"}`;
      const destino = next && (data.rol === "admin" || !nextNegocio || nextNegocio === data.negocio) ? next : suSitio;
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

  const listo = usuario && clave && !busy;

  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(400px, 94vw)" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 2px", letterSpacing: "-0.01em" }}>Sellos</h1>
          <p style={{ color: C.suave, fontSize: 14, margin: 0 }}>
            Tarjetas de fidelización para iPhone y Android. Entra con el usuario de tu negocio.
          </p>
        </div>

        <form onSubmit={entrar} style={{ ...panel, display: "flex", flexDirection: "column" }}>
          <label style={{ ...etiqueta, marginTop: 0 }} htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="nube"
            autoFocus
            style={campo}
          />

          <label style={etiqueta} htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            style={campo}
          />

          <button type="submit" disabled={!listo} style={{ ...entrarBtn, opacity: listo ? 1 : 0.45, cursor: listo ? "pointer" : "default" }}>
            {busy ? "Entrando…" : "Entrar"}
          </button>

          {error && <div role="alert" style={{ ...aviso(false), marginTop: 14 }}>{error}</div>}
        </form>

        {accesos.length > 0 && (
          <div style={{ ...panel, marginTop: 14, padding: 16, background: C.panelSuave }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Accesos de ejemplo</div>
            <p style={{ fontSize: 12, color: C.suave, margin: "0 0 10px" }}>
              Toca uno para rellenar el formulario. La contraseña es igual que el usuario.
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {accesos.map((a) => (
                <button key={a.usuario} type="button" onClick={() => usar(a)} style={fila}>
                  <span>{a.negocio}</span>
                  <span style={{ color: C.suave, fontSize: 12 }}>{a.rol}</span>
                  <code style={{ fontSize: 12, color: C.suave }}>{a.usuario} / {a.clave}</code>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.tenue, margin: "10px 0 0" }}>
              Solo mientras el servidor tenga USUARIOS_DEMO=1. Quítalo antes de abrir al público.
            </p>
          </div>
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

const entrarBtn = {
  marginTop: 20,
  padding: "0.7rem 1.2rem",
  borderRadius: 10,
  border: 0,
  background: "#1b1e23",
  color: "#fff",
  fontWeight: 600,
  fontSize: 15,
};

const fila = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 10,
  alignItems: "center",
  textAlign: "left",
  padding: "9px 11px",
  borderRadius: 9,
  border: `1px solid ${C.borde}`,
  background: "#fff",
  color: C.texto,
  fontSize: 13,
  cursor: "pointer",
};
