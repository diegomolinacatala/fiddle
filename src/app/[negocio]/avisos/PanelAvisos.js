"use client";

import { useEffect, useState } from "react";
import Automaticos from "./Automaticos";
import Enviar from "./Enviar";
import Enviados from "./Enviados";
import Programados from "./Programados";
import Solapas from "../Solapas";
import { pestanasDe, primeraDe } from "./pestanas";
import { C } from "@/app/ui";

// ============================================================================
// AVISOS — todo lo que se les dice a los clientes, en un solo sitio
// ----------------------------------------------------------------------------
//   AUTOMÁTICOS   las reglas que trabajan solas (lib/automatizaciones.js)
//   PROGRAMADOS   lo que la tienda decide cuándo sale: un día o cada semana
//   ENVIAR        un mensaje a mano, ahora o a una hora de hoy o de mañana
//   ENVIADOS      lo que ya salió, a mano o solo, y quién volvió
//
// AUTOMÁTICOS y PROGRAMADOS solo salen si el admin los ha encendido para la
// tienda (`avisosAvanzados`). Apagados, tampoco se mandan (lib/motorAvisos.js):
// esconder la pestaña no bastaría.
//
// Antes la promo vivía en el manager y los grupos en el CRM: dos sitios para
// lo mismo. Llega con los datos cargados en el servidor (page.js); cada acción
// devuelve los datos frescos y se cambian de golpe.
// ============================================================================


// Se puede llegar con algo ya empezado desde Clientes:
//   ?grupo=<clave>        Enviar, con ese destino elegido (un grupo, "todos" o "momento")
//     &texto=  &dia=<0-6>  &hora=<HH:MM>  &por=<la frase de «lo que dicen los números»>
//   ?programar=<base64>   un aviso programado a medias (solo con los programados encendidos)
function deLaUrl() {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  let programar = null;
  try {
    const crudo = q.get("programar");
    if (crudo) programar = JSON.parse(decodeURIComponent(escape(atob(crudo.replace(/-/g, "+").replace(/_/g, "/")))));
  } catch {
    programar = null;
  }
  const dia = Number(q.get("dia"));
  return {
    grupo: q.get("grupo"),
    texto: q.get("texto")?.slice(0, 200) || null,
    dia: q.get("dia") !== null && Number.isInteger(dia) && dia >= 0 && dia <= 6 ? dia : null,
    hora: /^\d{2}:\d{2}$/.test(q.get("hora") || "") ? q.get("hora") : null,
    por: q.get("por")?.slice(0, 200) || null,
    programar,
  };
}

export default function PanelAvisos({ slug, inicial }) {
  const [d, setD] = useState(inicial);
  const avanzados = d.negocio.avisosAvanzados === true;
  const pestanas = pestanasDe(avanzados);
  const [pestana, setPestana] = useState(primeraDe(avanzados));
  const [msg, setMsg] = useState(null);
  const [llegada, setLlegada] = useState({});

  // Lo que viene en la URL se lee al montar (en el servidor no hay URL que leer).
  useEffect(() => {
    const u = deLaUrl();
    if (u.programar && avanzados) setPestana("programados");
    else if (u.grupo) setPestana("enviar");
    setLlegada(u);
  }, []);

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
    <>

        <Solapas pestanas={pestanas} activa={pestana} accent={accent} onCambiar={setPestana} />

        {avanzados && pestana === "automaticos" && <Automaticos slug={slug} datos={d} onDatos={setD} flash={flash} />}
        {avanzados && pestana === "programados" && <Programados slug={slug} datos={d} onDatos={setD} flash={flash} semilla={llegada.programar} />}
        {pestana === "enviar" && <Enviar datos={d} flash={flash} onDatos={setD} onEnviado={recargar} llegada={llegada} />}
        {pestana === "enviados" && <Enviados datos={d} />}

        {msg && <div role="status" style={toast}>{msg}</div>}
    </>
  );
}

const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: C.toastFondo, color: C.toastTexto, padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)", zIndex: 60,
};
