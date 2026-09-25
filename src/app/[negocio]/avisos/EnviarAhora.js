"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import Campana, { TODOS } from "./Campana";
import { C, panel, RADIO } from "@/app/ui";

// ============================================================================
// ENVIAR AHORA: primero a quién, luego qué
// ----------------------------------------------------------------------------
// A todos (la promo de la tienda) o a uno de los grupos del CRM. Un cliente
// puede estar en varios grupos a la vez, y está bien: estar a un sello del
// premio y llevar semanas sin venir es la misma persona muchas veces.
// ============================================================================

export default function EnviarAhora({ datos, flash, onEnviado }) {
  const { negocio: n } = datos;
  const [elegido, setElegido] = useState(TODOS);
  const destinos = [
    {
      key: TODOS, label: "Todos los clientes", icon: "clientes",
      descripcion: n.promo ? `Ahora mismo pone: «${n.promo}».` : "La promo de la tienda: la ven todas las tarjetas.",
      total: datos.total, contactables: datos.contactables,
    },
    // Un grupo vacío no se puede elegir: ni se enseña (en el móvil empujaría el mensaje hacia abajo).
    ...datos.grupos.filter((g) => g.total > 0),
  ];
  const destino = destinos.find((g) => g.key === elegido) || destinos[0];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div role="radiogroup" aria-label="A quién" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {destinos.map((g) => {
          const activo = g.key === destino.key;
          const hay = g.total > 0;
          return (
            <button
              key={g.key} type="button" role="radio" aria-checked={activo} disabled={!hay}
              onClick={() => setElegido(g.key)} style={tarjeta(activo, hay, n.tema.accent)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: n.tema.accent, display: "inline-flex" }}><Icono nombre={g.icon} tam={17} /></span>
                <strong style={{ fontSize: 13.5, fontWeight: 650, textAlign: "left" }}>{g.label}</strong>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 650 }}>{g.total}</span>
              </span>
              <span style={{ fontSize: 11.5, color: C.tenue, marginTop: 4 }}>
                {g.contactables} avisable{g.contactables === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      <section style={panel}>
        <Campana negocio={n} destino={destino} flash={flash} onEnviada={onEnviado} />
      </section>
    </div>
  );
}

const tarjeta = (activo, hay, accent) => ({
  display: "flex", flexDirection: "column", alignItems: "stretch", padding: "11px 13px", textAlign: "left",
  borderRadius: RADIO.fila, border: `1px solid ${activo ? accent : C.borde}`,
  background: activo ? `${accent}0f` : hay ? "#fff" : C.panelSuave,
  opacity: hay ? 1 : 0.55, cursor: hay ? "pointer" : "default", font: "inherit", color: C.texto,
});
