"use client";

import { useState } from "react";
import LogoFiddle from "@/app/LogoFiddle";
import CampoCodigo from "@/app/CampoCodigo";
import { Clave, Coinciden, Ayuda, revisar, lista } from "@/app/ClaveElegida";
import { C, paginaCentrada, panel, campo, etiqueta, aviso } from "@/app/ui";

// ============================================================================
// RECUPERAR LA CONTRASEÑA — el dueño entra con su correo
// ----------------------------------------------------------------------------
// Dos pasos en la misma pantalla: el correo (le llega un código de 6 cifras) y,
// con el código, la contraseña nueva. Entra directo al terminar. El servidor
// contesta igual exista o no la cuenta (app/api/recuperar/route.js), así que aquí
// tampoco se promete nada: «si ese correo entra en una cafetería…». La de la caja
// no se recupera aquí: la cambia el dueño en Ajustes.
// ============================================================================

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [reto, setReto] = useState(null); // el código ya se mandó
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const escribir = (set) => (v) => { set(v); setError(null); };

  async function llamar(cuerpo) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // Si el código caducó o se agotó, solo sirve pedir otro: se vuelve al correo.
        if (d.campo === "email" || d.codigoCorreo === "caducado" || d.codigoCorreo === "agotado") setReto(null);
        const texto = r.status >= 500 && !d.campo ? "No se pudo completar. Prueba otra vez en un momento." : d.error || "No se pudo completar";
        setError(texto);
        setBusy(false);
        return null;
      }
      return d;
    } catch {
      setError("Sin conexión. Prueba otra vez.");
      setBusy(false);
      return null;
    }
  }

  async function mandarCodigo(e) {
    e?.preventDefault();
    if (!email.trim()) return setError("Escribe tu correo.");
    const d = await llamar({ email: email.trim() });
    if (!d) return;
    setReto(d.reto);
    setEmail(d.email || email.trim());
    setCodigo("");
    setBusy(false);
  }

  async function guardar(e) {
    e.preventDefault();
    const problema = revisar(clave, clave2, email);
    if (problema) return setError(problema);
    const d = await llamar({ reto, codigo: codigo.trim(), clave });
    if (!d) return;
    window.location.assign(d.destino);
  }

  function cambiarCorreo() {
    setReto(null);
    setCodigo("");
    setError(null);
  }

  const listo = codigo.trim().length >= 6 && lista(clave, clave2) && !busy;

  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(400px, 100%)" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 10px", fontSize: "inherit" }}>
            <LogoFiddle tam={36} />
          </h1>
          <p style={{ color: C.suave, fontSize: 14, margin: 0 }}>¿Has olvidado tu contraseña?</p>
        </div>

        {!reto ? (
          <form onSubmit={mandarCodigo} style={{ ...panel, display: "flex", flexDirection: "column" }}>
            <p style={texto}>Pon el correo con el que entras y te mandamos un código para elegir una contraseña nueva.</p>
            <label style={etiqueta} htmlFor="correo">Tu correo</label>
            <input
              id="correo" type="email" name="email" value={email} onChange={(e) => escribir(setEmail)(e.target.value)}
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus style={campo}
            />
            {error && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
            <button type="submit" disabled={!email.trim() || busy} aria-busy={busy || undefined} style={principal(Boolean(email.trim()) && !busy)}>
              {busy ? "Mandando…" : "Mandarme el código"}
            </button>
          </form>
        ) : (
          <form onSubmit={guardar} style={{ ...panel, display: "flex", flexDirection: "column" }}>
            <p style={texto}>
              Si ese correo entra en una cafetería, te hemos mandado un código a{" "}
              <strong style={{ color: C.texto, wordBreak: "break-all" }}>{email}</strong>. Mira también en spam.
            </p>
            <label style={etiqueta} htmlFor="codigo">Código</label>
            <CampoCodigo id="codigo" valor={codigo} onChange={escribir(setCodigo)} autoFocus />
            {/* Para que el gestor de contraseñas la guarde con su correo. */}
            <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
            <label style={etiqueta} htmlFor="clave-nueva">Tu contraseña nueva</label>
            <Clave id="clave-nueva" valor={clave} onChange={escribir(setClave)} ver={ver} setVer={setVer} />
            <Ayuda valor={clave} />
            <label style={etiqueta} htmlFor="clave-nueva-2">Repítela</label>
            <Clave id="clave-nueva-2" valor={clave2} onChange={escribir(setClave2)} ver={ver} />
            <Coinciden clave={clave} repetida={clave2} />
            {error && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
            <button type="submit" disabled={!listo} aria-busy={busy || undefined} style={principal(listo)}>
              {busy ? "Guardando…" : "Guardar y entrar"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
              <button type="button" onClick={cambiarCorreo} style={enlacePequeno}>Cambiar el correo</button>
              <button type="button" onClick={mandarCodigo} disabled={busy} style={enlacePequeno}>Mandar otro código</button>
            </div>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: C.suave, margin: "18px 0 0" }}>
          <a href="/login" style={{ color: C.texto, fontWeight: 600 }}>Volver a entrar</a>
        </p>
        <p style={{ textAlign: "center", fontSize: 12, color: C.tenue, margin: "10px 0 0", lineHeight: 1.45 }}>
          La contraseña de la caja no se cambia aquí: la cambia el dueño desde Ajustes.
        </p>
      </div>
    </main>
  );
}

const texto = { color: C.suave, fontSize: 14, lineHeight: 1.5, margin: "0 0 4px" };
const principal = (listo) => ({
  marginTop: 20, padding: "0.7rem 1.2rem", borderRadius: 10, border: 0,
  background: C.toastFondo, color: C.toastTexto, fontWeight: 600, fontSize: 15,
  opacity: listo ? 1 : 0.45, cursor: listo ? "pointer" : "default",
});
const enlacePequeno = {
  border: 0, background: "none", padding: "6px 0", color: C.suave, fontSize: 13, fontWeight: 600,
  textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer",
};
