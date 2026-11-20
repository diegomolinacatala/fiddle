"use client";

import { useEffect, useState } from "react";
import { IDS_PLAN, PLANES_DE_PARTIDA, PLAN_POR_DEFECTO, FUNCIONES } from "@/lib/planes";
import { C, panel, h2, campo, etiqueta } from "@/app/ui";

// ============================================================================
// EL PLAN DE UNA TIENDA (lib/planes.js)
// ----------------------------------------------------------------------------
// Se elige aquí y se guarda al momento (PUT /api/admin/negocios con solo `plan`).
// Lo que lleva cada plan no se cambia aquí: es de todas las tiendas, en /admin →
// Planes. Cambiar de plan pone al día sus tarjetas en silencio (la promo, el
// «Abierto hasta…» y el aviso al pasar cerca van según el plan) y no borra nada.
// ============================================================================

export default function PlanTienda({ n, accent, flash, onCambio }) {
  const [guardando, setGuardando] = useState(false);
  const actual = n.plan || null;
  const funciones = n.funciones || {};
  // Cuántos esperan tarjeta en su lista (solo se pregunta si tiene límite).
  const [espera, setEspera] = useState(null);
  useEffect(() => {
    if (!n.cupo) { setEspera(null); return undefined; }
    let vivo = true;
    fetch(`/api/admin/espera?slug=${encodeURIComponent(n.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setEspera(d); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [n.slug, n.cupo]);

  async function elegir(plan) {
    if (plan === actual) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/negocios", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: n.slug, plan }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo guardar");
      onCambio(d);
      const mandados = d.espera?.mandados || 0;
      flash(mandados > 0
        ? `Plan ${PLANES_DE_PARTIDA[plan].nombre}. Se ha escrito a ${mandados} de la lista de espera`
        : `Plan ${PLANES_DE_PARTIDA[plan].nombre}: sus tarjetas se ponen al día en silencio`);
      setEspera((e) => (e ? { ...e, esperan: d.espera?.esperan ?? e.esperan } : e));
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  const cupo = n.cupo;
  const lleva = FUNCIONES.filter((f) => funciones[f.id] !== false).map((f) => f.nombre);
  return (
    <section style={panel}>
      <h2 style={h2}>Plan</h2>
      <label style={{ ...etiqueta, marginTop: 0 }} htmlFor="plan-tienda">Su plan</label>
      <select id="plan-tienda" value={actual || ""} onChange={(e) => elegir(e.target.value)} disabled={guardando} aria-busy={guardando || undefined} style={campo}>
        {/* Sin plan guardado cuenta como Pro: que se vea, y que se pueda fijar. */}
        {!actual && <option value="">Sin elegir (cuenta como {PLANES_DE_PARTIDA[PLAN_POR_DEFECTO].nombre})</option>}
        {IDS_PLAN.map((id) => <option key={id} value={id}>{PLANES_DE_PARTIDA[id].nombre}</option>)}
      </select>
      <p style={texto}>
        {cupo
          ? <>Tarjetas: <strong style={{ color: n.clientes >= cupo.max ? C.mal : C.texto }}>{n.clientes} de {cupo.max}</strong> (se dan hasta {cupo.max + cupo.margen}).</>
          : "Tarjetas sin límite."}
        {" "}{lleva.length ? <>Lleva: {lleva.join(", ")}.</> : "Solo la tarjeta y la caja."}
      </p>
      {espera && espera.esperan > 0 && (
        <p style={texto}>
          En la lista de espera: <strong style={{ color: C.texto }}>{espera.esperan}</strong>.
          {espera.hayCorreo
            ? " Se les escribe solos en cuanto haya sitio."
            : <span style={{ color: C.mal }}> No hay proveedor de correo (RESEND_API_KEY y CORREO_DESDE): no se les puede escribir.</span>}
        </p>
      )}
      <p style={{ ...texto, color: C.tenue }}>
        Lo que lleva cada plan se cambia en <a href="/admin#planes" style={{ color: accent }}>Plataforma → Planes</a>, para todas las tiendas.
      </p>
    </section>
  );
}

const texto = { fontSize: 13, color: C.suave, margin: "10px 0 0", lineHeight: 1.45 };
