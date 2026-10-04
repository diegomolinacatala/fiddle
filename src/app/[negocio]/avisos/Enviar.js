"use client";

import { useEffect, useState } from "react";
import Icono from "@/app/Icono";
import Campana from "./Campana";
import { TODOS, MOMENTO, DESTINOS_ESPECIALES, infoDestino } from "@/lib/envios";
import { C, panel, RADIO } from "@/app/ui";

// ============================================================================
// ENVIAR: primero a quién, luego qué y cuándo (ahora o a una hora)
// ----------------------------------------------------------------------------
// A todos (la promo de la tienda), a todos solo ese día, o a uno de los grupos
// del CRM. Un cliente puede estar en varios grupos a la vez, y está bien: estar
// a un sello del premio y llevar semanas sin venir es la misma persona muchas
// veces.
//
// Se puede llegar con algo ya empezado (de Clientes, «lo que dicen los
// números»): `llegada` = { grupo, texto, dia, hora, por }. Si el grupo que trae
// hoy está vacío, sale igual (apagado y diciendo por qué) en vez de cambiarlo
// por otro a escondidas.
// ============================================================================

export default function Enviar({ datos, flash, onDatos, onEnviado, llegada = {} }) {
  const { negocio: n } = datos;
  const [elegido, setElegido] = useState(llegada.grupo || TODOS);
  useEffect(() => { if (llegada.grupo) setElegido(llegada.grupo); }, [llegada.grupo]);

  const especiales = [TODOS, MOMENTO].map((key) => ({
    key, ...DESTINOS_ESPECIALES[key],
    descripcion: key === TODOS && n.promo ? `Ahora mismo pone: «${n.promo}».` : DESTINOS_ESPECIALES[key].descripcion,
    total: datos.total, contactables: datos.contactables,
  }));
  // Un grupo vacío no se ofrece (en el móvil empujaría el mensaje hacia abajo)…
  // salvo que sea el que se ha pedido: entonces se ve, vacío, y se dice por qué.
  const grupos = datos.grupos.filter((g) => g.total > 0 || g.key === llegada.grupo);
  const destinos = [...especiales, ...grupos];
  const destino = destinos.find((g) => g.key === elegido) || destinos[0];
  const desconocido = llegada.grupo && !infoDestino(llegada.grupo);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {llegada.por && (
        <div style={nota}>
          <Icono nombre="diana" tam={16} />
          <span>De <strong>lo que dicen los números</strong>: {llegada.por}</span>
        </div>
      )}
      {desconocido && <div style={{ ...nota, color: C.mal }}>Ese grupo ya no existe. Elige a quién mandarlo.</div>}

      <div role="radiogroup" aria-label="A quién" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: 10 }}>
        {destinos.map((g) => {
          const activo = g.key === destino.key;
          const hay = g.total > 0;
          return (
            <button
              key={g.key} type="button" role="radio" aria-checked={activo} disabled={!hay && !activo}
              onClick={() => setElegido(g.key)} style={tarjeta(activo, hay, n.tema.accent)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: n.tema.accent, display: "inline-flex" }}><Icono nombre={g.icon} tam={17} /></span>
                <strong style={{ fontSize: 13.5, fontWeight: 650, textAlign: "left" }}>{g.label}</strong>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 650 }}>{g.total}</span>
              </span>
              <span style={{ fontSize: 11.5, color: C.tenue, marginTop: 4 }}>
                {hay ? `${g.contactables} avisable${g.contactables === 1 ? "" : "s"}` : "ahora mismo, nadie"}
              </span>
            </button>
          );
        })}
      </div>

      <section style={panel}>
        <Campana
          negocio={n} destino={destino} flash={flash} onEnviada={onEnviado} onDatos={onDatos}
          pendientes={datos.pendientes || []} reloj={datos.reloj} grupos={destinos}
          semilla={llegada.grupo === destino.key ? llegada : null}
        />
      </section>
    </div>
  );
}

const nota = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.suave, background: C.panelSuave,
  border: `1px solid ${C.borde}`, borderRadius: RADIO.fila, padding: "10px 13px",
};

const tarjeta = (activo, hay, accent) => ({
  display: "flex", flexDirection: "column", alignItems: "stretch", padding: "11px 13px", textAlign: "left",
  borderRadius: RADIO.fila, border: `1px solid ${activo ? accent : C.borde}`,
  background: activo ? `${accent}0f` : hay ? "#fff" : C.panelSuave,
  opacity: hay || activo ? 1 : 0.55, cursor: hay ? "pointer" : "default", font: "inherit", color: C.texto,
});
