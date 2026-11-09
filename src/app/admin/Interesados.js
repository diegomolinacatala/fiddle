"use client";

import { useEffect, useState } from "react";
import CaraDelPase from "@/app/CaraDelPase";
import { confirmar } from "@/app/Dialogo";
import { tarjetaDe } from "@/app/home/tarjeta/opciones";
import { C, panel, botonSecundario } from "@/app/ui";

// ============================================================================
// PLATAFORMA → INTERESADOS
// ----------------------------------------------------------------------------
// Quien terminó «Diseña tu tarjeta» y dejó un email o un teléfono: con quién hablar
// y la tarjeta que diseñó, pintada con las funciones de verdad. Sin verificar: lo
// escribió esa persona. Es lo que ve el admin; no llega a ninguna tienda.
// ============================================================================

const fecha = (iso) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Interesados({ accent, flash }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/interesados").then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudieron cargar");
      setLista(d);
    }).catch((e) => setError(String(e?.message || e)));
  }, []);

  async function borrar(i) {
    const si = await confirmar({ titulo: "Borrar este interesado", texto: `Se borra ${i.contacto} y su tarjeta. No se puede deshacer.`, si: "Borrar", peligro: true, accent });
    if (!si) return;
    const r = await fetch(`/api/admin/interesados?id=${encodeURIComponent(i.id)}`, { method: "DELETE" });
    if (!r.ok) return flash("No se pudo borrar");
    setLista((l) => l.filter((x) => x.id !== i.id));
    flash("Borrado");
  }

  if (error) return <p style={{ color: C.mal }}>{error}</p>;
  if (!lista) return <p style={{ color: C.suave }}>Cargando…</p>;
  if (!lista.length) return <p style={{ color: C.suave }}>Aún no ha dejado nadie su contacto en «Diseña tu tarjeta».</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {lista.map((i) => {
        const { negocio, cliente } = tarjetaDe(i.eleccion);
        return (
          <div key={i.id} style={{ ...panel, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ width: 360, zoom: 0.42, flexShrink: 0 }} aria-hidden="true">
              <CaraDelPase cliente={cliente} negocio={negocio} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <a href={i.tipo === "email" ? `mailto:${i.contacto}` : `tel:${i.contacto.replace(/[^\d+]/g, "")}`} style={{ fontWeight: 650, overflowWrap: "anywhere" }}>
                {i.contacto}
              </a>
              <div style={{ fontSize: 13, color: C.suave, marginTop: 2 }}>
                {i.eleccion.nombre?.trim() || "Sin nombre de tienda"} · {i.eleccion.cartillas === 2 ? "dos premios" : "un premio"}
              </div>
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>{fecha(i.creado)}</div>
            </div>
            <button type="button" onClick={() => borrar(i)} style={{ ...botonSecundario, color: C.mal }}>Borrar</button>
          </div>
        );
      })}
    </div>
  );
}
