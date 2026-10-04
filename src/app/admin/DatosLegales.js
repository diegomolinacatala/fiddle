"use client";

import { useState } from "react";
import { C, panel, campo, etiqueta, h2, botonPrimario } from "@/app/ui";
import { legalCompleto } from "@/lib/legal";

// Quién es la tienda ante la ley (art. 13.1.a): lo que pide el aviso de
// privacidad de sus clientes y el contrato de encargado. Lo rellena el admin con
// el contrato firmado delante, no la tienda. El email vale para dos cosas: que
// el cliente ejerza sus derechos y avisar a la tienda de una brecha.
export default function DatosLegales({ slug, legal, accent, onGuardado, flash }) {
  const [d, setD] = useState({ razonSocial: "", nif: "", direccion: "", email: "", ...(legal || {}) });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));

  async function guardar() {
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/negocios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, legal: d }),
      });
      const datos = await r.json();
      if (!r.ok) return flash(datos.error || "No se pudo guardar");
      setD({ razonSocial: "", nif: "", direccion: "", email: "", ...(datos.legal || {}) });
      onGuardado(datos.legal);
      flash("Datos legales guardados");
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section style={panel}>
      <h2 style={h2}>Datos legales</h2>
      <p style={{ fontSize: 13, color: legalCompleto(legal) ? C.suave : C.mal, margin: "0 0 4px", lineHeight: 1.4 }}>
        {legalCompleto(legal)
          ? <>Salen en su <a href={`/privacidad?b=${slug}`} target="_blank" rel="noopener" style={{ color: "inherit" }}>aviso de privacidad</a>.</>
          : "Faltan: sin razón social, NIF y email, el aviso de privacidad de sus clientes solo dice el nombre de la tienda."}
      </p>
      <label style={etiqueta}>Razón social</label>
      <input value={d.razonSocial || ""} onChange={set("razonSocial")} placeholder="Delicatessen Ejemplo, S.L." style={campo} />
      <label style={etiqueta}>NIF</label>
      <input value={d.nif || ""} onChange={set("nif")} placeholder="B12345678" style={campo} />
      <label style={etiqueta}>Dirección</label>
      <input value={d.direccion || ""} onChange={set("direccion")} placeholder="Calle Mayor 1, 28001 Madrid" style={campo} />
      <label style={etiqueta}>Email (derechos de sus clientes y avisos de brecha)</label>
      <input type="email" value={d.email || ""} onChange={set("email")} placeholder="privacidad@tienda.es" style={campo} />
      <button type="button" onClick={guardar} disabled={guardando} style={{ ...botonPrimario(accent), marginTop: 14 }}>
        {guardando ? "Guardando…" : "Guardar datos legales"}
      </button>
    </section>
  );
}
