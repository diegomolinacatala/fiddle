"use client";

import { useState } from "react";
import { FilaInterruptor } from "@/app/Interruptor";
import { C, panel, h2 } from "@/app/ui";

// Los avisos AUTOMÁTICOS y PROGRAMADOS de una tienda: solo el admin los
// enciende. Apagados, sus pestañas no salen en Avisos y el reloj no manda nada
// de ellos (lib/motorAvisos.js), ni siquiera las reglas que la tienda dejó
// encendidas. No se borra nada: al volver a encenderlos, están como estaban.
export default function AvisosAvanzados({ slug, on, accent, flash, onCambio }) {
  const [guardando, setGuardando] = useState(false);

  async function alternar() {
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/negocios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, avisosAvanzados: !on }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo guardar");
      onCambio(d.avisosAvanzados);
      flash(d.avisosAvanzados ? "Automáticos y programados, encendidos" : "Automáticos y programados, apagados");
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section style={panel}>
      <h2 style={h2}>Avisos automáticos y programados</h2>
      <FilaInterruptor
        on={on} onClick={alternar} disabled={guardando} accent={accent} icono="megafono"
        titulo={on ? "Encendidos para esta tienda" : "Apagados para esta tienda"}
        texto={on
          ? "Salen sus pestañas en Avisos y el reloj manda lo que la tienda tenga encendido."
          : "Sin pestañas y sin envíos: ni las reglas que dejó encendidas. Sus reglas se guardan tal cual."}
      />
      <p style={{ fontSize: 12.5, color: C.tenue, margin: "10px 0 0", lineHeight: 1.4 }}>
        «Enviar» (ahora o a una hora de hoy o de mañana) funciona siempre.
      </p>
    </section>
  );
}
