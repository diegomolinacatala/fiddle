"use client";

import { useEffect, useState } from "react";
import ClaveNueva from "@/app/ClaveNueva";
import { C, h2, panel, botonPequeno } from "@/app/ui";

const ROTULO = { manager: "Dueño / manager", caja: "Móvil de la caja" };
const fecha = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

// Las contraseñas de una tienda, en su ficha del admin: cómo entra cada usuario
// hoy y un botón para darle una nueva (se enseña una vez).
export default function Accesos({ slug }) {
  const [estado, setEstado] = useState(null);
  const [nuevas, setNuevas] = useState([]);
  const [error, setError] = useState(null);

  const cargar = () => fetch(`/api/admin/accesos?slug=${slug}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudieron leer los accesos"))))
    .then(setEstado)
    .catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [slug]);

  async function generar(a) {
    const aviso = a.desde || a.respaldo ? `\n\nLa contraseña actual de ${a.usuario} dejará de funcionar.` : "";
    if (!window.confirm(`¿Generar una contraseña nueva para ${a.usuario}?${aviso}`)) return;
    setError(null);
    const r = await fetch("/api/admin/accesos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, rol: a.rol }),
    });
    const d = await r.json();
    if (!r.ok) return setError(d.error || "No se pudo generar");
    setNuevas((v) => [...v.filter((x) => x.usuario !== d.usuario), d]);
    cargar();
  }

  return (
    <section style={panel}>
      <h2 style={h2}>Accesos</h2>
      {error && <p style={{ color: C.mal, fontSize: 14 }}>{error}</p>}
      {!estado && !error && <p style={{ color: C.suave, fontSize: 14 }}>Cargando…</p>}
      {estado?.map((a) => (
        <div key={a.rol} style={fila}>
          <div>
            <div style={{ fontSize: 12, color: C.tenue }}>{ROTULO[a.rol]}</div>
            <strong style={{ fontSize: 14 }}>{a.usuario}</strong>
            <div style={{ fontSize: 13, color: a.desde || a.respaldo ? C.suave : C.mal }}>
              {a.desde
                ? `Contraseña propia desde el ${fecha(a.desde)}`
                : a.respaldo ? "Usa la contraseña de Vercel (antigua)" : "Sin contraseña: no puede entrar"}
            </div>
          </div>
          <button type="button" onClick={() => generar(a)} style={botonPequeno}>
            {a.desde || a.respaldo ? "Cambiar" : "Generar"}
          </button>
        </div>
      ))}
      {nuevas.length > 0 && <ClaveNueva accesos={nuevas} onCerrar={() => setNuevas([])} />}
    </section>
  );
}

const fila = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.borde}` };
