"use client";

import { useState } from "react";
import { Clave, Coinciden, Ayuda, revisar, lista } from "@/app/ClaveElegida";
import { etiqueta, aviso, botonPrimario } from "@/app/ui";

// ============================================================================
// CAMBIAR MI CONTRASEÑA (Ajustes → «Tu acceso»)
// ----------------------------------------------------------------------------
// La actual y la nueva dos veces, como en la invitación. La guarda
// POST /api/accesos/manager, que vuelve a firmar esta sesión: aquí se sigue
// dentro, en los demás dispositivos habrá que volver a entrar.
// ============================================================================

export default function CambiarClave({ slug, usuario, accent, onHecho }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [nueva2, setNueva2] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Al volver a escribir se quita el aviso, que ya no cuenta lo que hay en los campos.
  const escribir = (set) => (v) => { set(v); setError(null); };

  async function guardar(e) {
    e.preventDefault();
    const problema =
      !actual ? "Escribe tu contraseña actual."
      : revisar(nueva, nueva2, usuario)
      || (nueva.trim() === actual.trim() ? "La nueva tiene que ser distinta de la actual." : null);
    if (problema) return setError(problema);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/accesos/manager?b=${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cambiar");
      onHecho();
    } catch (err) {
      setError(err.message);
      if (String(err.message).includes("actual")) setActual("");
    } finally {
      setBusy(false);
    }
  }

  const listo = Boolean(actual) && lista(nueva, nueva2) && !busy;

  return (
    <form onSubmit={guardar} style={{ maxWidth: 420 }}>
      {/* Para que el gestor de contraseñas la guarde con su usuario. */}
      <input type="text" name="username" autoComplete="username" value={usuario} readOnly hidden />
      <label style={{ ...etiqueta, marginTop: 0 }} htmlFor="clave-actual">Tu contraseña de ahora</label>
      <Clave id="clave-actual" valor={actual} onChange={escribir(setActual)} ver={ver} autoComplete="current-password" autoFocus />
      <label style={etiqueta} htmlFor="clave-nueva">La nueva</label>
      <Clave id="clave-nueva" valor={nueva} onChange={escribir(setNueva)} ver={ver} setVer={setVer} />
      <Ayuda valor={nueva} />
      <label style={etiqueta} htmlFor="clave-nueva-2">Repítela</label>
      <Clave id="clave-nueva-2" valor={nueva2} onChange={escribir(setNueva2)} ver={ver} />
      <Coinciden clave={nueva} repetida={nueva2} />
      {error && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
      <button type="submit" disabled={!listo} style={{ ...botonPrimario(accent), marginTop: 14, opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "default" }}>
        {busy ? "Guardando…" : "Guardar la nueva"}
      </button>
    </form>
  );
}
