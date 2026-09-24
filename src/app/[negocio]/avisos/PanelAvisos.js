"use client";

import { useState } from "react";
import CabeceraGestion from "../CabeceraGestion";
import Automaticos from "./Automaticos";
import EnviarAhora from "./EnviarAhora";
import Enviados from "./Enviados";
import { C, pagina, solapa } from "@/app/ui";

// ============================================================================
// AVISOS — todo lo que se les dice a los clientes, en un solo sitio
// ----------------------------------------------------------------------------
//   AUTOMÁTICOS   las reglas que trabajan solas (lib/automatizaciones.js)
//   ENVIAR AHORA  un mensaje a mano: a todos (la promo) o a un grupo
//   ENVIADOS      lo que ya salió, a mano o solo, y quién volvió
//
// Antes la promo vivía en el manager y los grupos en el CRM: dos sitios para
// lo mismo. Llega con los datos cargados en el servidor (page.js); cada acción
// devuelve los datos frescos y se cambian de golpe.
// ============================================================================

const PESTANAS = [["automaticos", "Automáticos"], ["enviar", "Enviar ahora"], ["enviados", "Enviados"]];

export default function PanelAvisos({ slug, inicial }) {
  const [d, setD] = useState(inicial);
  const [pestana, setPestana] = useState("automaticos");
  const [msg, setMsg] = useState(null);

  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 4000); }

  async function recargar() {
    try {
      const r = await fetch(`/api/automatizaciones?b=${slug}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo cargar");
      setD(data);
    } catch (e) {
      flash(`No se pudo actualizar: ${e?.message || e}`);
    }
  }

  const accent = d.negocio.tema.accent;

  return (
    <main style={pagina}>
      <div style={{ width: "min(1100px, 96vw)" }}>
        <CabeceraGestion negocio={d.negocio} slug={slug} activa="avisos" />

        <div role="tablist" style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
          {PESTANAS.map(([id, texto]) => (
            <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} style={solapa(pestana === id, accent)}>
              {texto}
            </button>
          ))}
        </div>

        {pestana === "automaticos" && <Automaticos slug={slug} datos={d} onDatos={setD} flash={flash} />}
        {pestana === "enviar" && <EnviarAhora slug={slug} datos={d} flash={flash} onEnviado={recargar} />}
        {pestana === "enviados" && <Enviados datos={d} />}

        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)", zIndex: 60,
};
