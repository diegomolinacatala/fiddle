"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icono from "@/app/Icono";
import Regla from "./Regla";
import { LISTA_DISPAROS, MAX_REGLAS, MAX_PAUSA, reglaNueva } from "@/lib/automatizaciones";
import { resumenHorario } from "@/lib/horario";
import { C, panel, campo, h2, botonSecundario, botonPequeno, aviso, RADIO } from "@/app/ui";

// ============================================================================
// LOS AVISOS AUTOMÁTICOS DE LA TIENDA
// ----------------------------------------------------------------------------
// Arriba, si el reloj anda y cuándo abre la tienda (las dos cosas de las que
// depende que salgan). Luego la lista de reglas: encender, apagar y editar sin
// salir de la tarjeta. Abajo, añadir una y la pausa entre avisos.
//
// Cada cambio guarda la lista entera (PUT /api/automatizaciones) y la pantalla
// se queda con lo que devuelve el servidor: lo que se ve es lo guardado.
// ============================================================================

const RELOJ_VIVO_MIN = 40; // pasa cada 15 min: con 40 sin latido, algo va mal

export default function Automaticos({ slug, datos, onDatos, flash }) {
  const { negocio: n, contextos } = datos;
  const reglas = n.automatizaciones;
  const [abierta, setAbierta] = useState(null);     // id de la regla que se edita
  const [nueva, setNueva] = useState(null);         // regla sin guardar todavía
  const [eligiendo, setEligiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pausa, setPausa] = useState(n.pausaAvisos);

  // El historial viaja como listas (JSON); aquí se vuelve a Map, como en el servidor.
  const envios = useMemo(() => ({ porRegla: new Map(datos.envios.porRegla), ultimo: new Map(datos.envios.ultimo) }), [datos.envios]);

  async function guardarLista(lista, pausaAvisos = n.pausaAvisos) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/automatizaciones?b=${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automatizaciones: lista, pausaAvisos }),
      });
      const data = await r.json();
      if (!r.ok) { flash(data.error || "No se pudo guardar"); return false; }
      onDatos(data);
      return true;
    } catch {
      flash("Sin conexión: no se ha guardado");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const acciones = {
    editar: (id) => { setNueva(null); setEligiendo(false); setAbierta(id); },
    cancelar: () => { setAbierta(null); setNueva(null); },
    async alternar(regla) {
      const ok = await guardarLista(reglas.map((r) => (r.id === regla.id ? { ...r, activa: !r.activa } : r)));
      if (ok) flash(regla.activa ? `«${regla.nombre}» apagado` : `«${regla.nombre}» encendido`);
    },
    async guardar(regla) {
      const existe = reglas.some((r) => r.id === regla.id);
      const lista = existe ? reglas.map((r) => (r.id === regla.id ? regla : r)) : [...reglas, regla];
      if (await guardarLista(lista)) {
        flash(existe ? "Guardado" : `«${regla.nombre}» creado y encendido`);
        acciones.cancelar();
      }
    },
    async borrar(regla) {
      if (!window.confirm(`¿Borrar «${regla.nombre}»?\n\nDeja de salir. Lo ya enviado sigue en Enviados.`)) return;
      if (await guardarLista(reglas.filter((r) => r.id !== regla.id))) {
        flash(`«${regla.nombre}» borrado`);
        acciones.cancelar();
      }
    },
    async enviar(regla, cuantos) {
      if (!window.confirm(`¿Enviar «${regla.nombre}» ahora a ${cuantos} ${cuantos === 1 ? "cliente" : "clientes"}?\n\nNo espera a su hora. A quien ya se lo dijimos no se le repite.`)) return;
      setOcupado(true);
      try {
        const r = await fetch(`/api/automatizaciones?b=${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regla: regla.id }),
        });
        const data = await r.json();
        if (!r.ok) return flash(data.error || "No se pudo enviar");
        onDatos(data.datos);
        flash(resumenEnvio(data.envio));
      } catch {
        flash("Sin conexión: no se ha enviado");
      } finally {
        setOcupado(false);
      }
    },
  };

  function empezar(disparo) {
    setEligiendo(false);
    setAbierta(null);
    setNueva(reglaNueva(disparo, reglas));
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <EstadoReloj ultimo={datos.reloj.ultimo} />

      <p style={{ ...lineaHorario }}>
        <Icono nombre="reloj" tam={16} />
        {n.horario ? (
          <span>Solo salen con la tienda abierta: <strong style={{ color: C.texto, fontWeight: 600 }}>{resumenHorario(n.horario)}</strong>.</span>
        ) : (
          <span><strong style={{ color: C.texto, fontWeight: 600 }}>Sin horario no sale ninguno solo.</strong> Pon cuándo abre la tienda; mientras, «Enviar ahora» sí funciona.</span>
        )}
        <Link href={`/${slug}/manager#horario`} style={{ marginLeft: "auto", color: n.tema.accent, fontWeight: 600, whiteSpace: "nowrap" }}>
          {n.horario ? "Cambiar horario" : "Poner horario"}
        </Link>
      </p>

      {reglas.map((r) => (
        <Regla
          key={r.id} regla={r} negocio={n} grupos={datos.catalogoGrupos} contextos={contextos} envios={envios}
          pausa={n.pausaAvisos} abierta={abierta === r.id} nueva={false} ocupado={ocupado} acciones={acciones}
        />
      ))}
      {nueva && (
        <Regla
          regla={nueva} negocio={n} grupos={datos.catalogoGrupos} contextos={contextos} envios={envios}
          pausa={n.pausaAvisos} abierta nueva ocupado={ocupado} acciones={acciones}
        />
      )}
      {!reglas.length && !nueva && (
        <p style={{ ...panel, color: C.suave, fontSize: 14, margin: 0 }}>No hay ningún aviso automático. Añade uno: el primero ya trae un texto de partida.</p>
      )}

      {!nueva && reglas.length < MAX_REGLAS && (
        eligiendo ? (
          <section style={panel}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ ...h2, margin: 0 }}>¿A quién quieres avisar?</h2>
              <button type="button" onClick={() => setEligiendo(false)} style={{ ...botonPequeno, marginLeft: "auto" }}>Cancelar</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
              {LISTA_DISPAROS.map((d) => (
                <button key={d.key} type="button" onClick={() => empezar(d.key)} style={opcionDisparo}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 650, fontSize: 14 }}>
                    <span style={{ color: n.tema.accent, display: "inline-flex" }}><Icono nombre={d.icon} tam={18} /></span>
                    {d.label}
                  </span>
                  <span style={{ fontSize: 12.5, color: C.suave, marginTop: 4, textAlign: "left" }}>{d.descripcion}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <button type="button" onClick={() => { setAbierta(null); setEligiendo(true); }} style={{ ...botonSecundario, display: "inline-flex", alignItems: "center", gap: 8, justifySelf: "start" }}>
            <Icono nombre="mas" tam={18} /> Añadir un aviso automático
          </button>
        )
      )}

      <section style={{ ...panel, background: C.panelSuave }}>
        <h2 style={h2}>Para no cansar a nadie</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.suave, lineHeight: 1.6 }}>
          <li>Cada aviso le llega a la misma persona <strong style={{ color: C.texto }}>una sola vez</strong>, hasta que vuelve a pasar por caja.</li>
          <li>Si alguien encaja en varios a la vez, le llega el que está más arriba en la lista.</li>
          <li>Solo les llega a quienes tienen la tarjeta en el teléfono.</li>
        </ul>
        <form
          onSubmit={async (e) => { e.preventDefault(); if (await guardarLista(reglas, pausa)) flash("Pausa guardada"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14, fontSize: 14 }}
        >
          <label htmlFor="pausa">Como mucho un aviso a la misma persona cada</label>
          <input
            id="pausa" type="number" min={0} max={MAX_PAUSA} value={pausa}
            onChange={(e) => setPausa(e.target.value === "" ? "" : Number(e.target.value))} style={{ ...campo, width: 70 }}
          />
          <span>días (también cuentan los que mandes a mano).</span>
          {Number(pausa) !== n.pausaAvisos && pausa !== "" && (
            <button type="submit" disabled={ocupado} style={botonPequeno}>Guardar</button>
          )}
        </form>
      </section>
    </div>
  );
}

function EstadoReloj({ ultimo }) {
  const minutos = ultimo ? Math.round((Date.now() - Date.parse(ultimo)) / 60000) : null;
  if (minutos !== null && minutos <= RELOJ_VIVO_MIN) {
    return (
      <p style={{ ...lineaHorario, color: C.ok, background: C.okFondo, borderColor: "#bfe5cd" }}>
        <Icono nombre="check" tam={16} />
        Funcionando: se revisan solos cada 15 minutos. Último repaso {minutos < 1 ? "hace un momento" : `hace ${minutos} min`}.
      </p>
    );
  }
  return (
    <div style={{ ...aviso(false), display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icono nombre="alerta" tam={18} style={{ marginTop: 1 }} />
      <span>
        {minutos === null
          ? "Todavía no están saliendo: falta conectar el reloj que los revisa cada 15 minutos. Es un paso de una sola vez que hace fiddle. Mientras, puedes prepararlos y mandar cualquiera con «Enviar ahora»."
          : `El reloj no pasa desde hace ${minutos < 120 ? `${minutos} minutos` : `${Math.round(minutos / 60)} horas`}: los avisos automáticos están parados. Avisa a fiddle.`}
      </span>
    </div>
  );
}

/** "Enviado a 4 · avisados: 3 iPhone, 1 Android". */
function resumenEnvio(e) {
  if (!e) return "Enviado";
  if (e.error) return `No se pudo enviar: ${e.error}`;
  if (!e.destinatarios) return "Ahora mismo no le toca a nadie (o ya se lo dijimos)";
  const android = (e.web || 0) + (e.google || 0);
  const sonaron = [e.avisados && `${e.avisados} iPhone`, android && `${android} Android`].filter(Boolean);
  return `Enviado a ${e.destinatarios}${sonaron.length ? ` · avisados: ${sonaron.join(", ")}` : ""}`;
}

const lineaHorario = {
  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: 0, fontSize: 13.5, color: C.suave,
  padding: "10px 13px", border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, background: "#fff",
};
const opcionDisparo = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "12px 14px", borderRadius: RADIO.fila,
  border: `1px solid ${C.borde}`, background: "#fff", cursor: "pointer", font: "inherit", color: C.texto,
};
