"use client";

import { useEffect, useState } from "react";
import { haceTexto, cadenciaTexto } from "@/lib/crm";
import { Chip } from "./piezas";
import Icono from "@/app/Icono";
import { C, campo, etiqueta, botonPequeno, chipCodigo } from "@/app/ui";

// ============================================================================
// FICHA DE UN CLIENTE — todo lo que sabemos de él
// ----------------------------------------------------------------------------
// Se abre encima de la tabla. Arriba, quién es y a qué ritmo viene; debajo, su
// historia entera, evento a evento: cuándo se dio de alta, cuándo metió el pase
// en el teléfono, cada sello, cada premio y cada aviso que le mandamos.
// ============================================================================

// Cómo se lee cada tipo de evento. Los de la caja ya traen su texto montado;
// estos son los que pasan solos y merecen destacarse.
const ICONO = {
  alta: "estrella",
  instalado: "movil",
  desinstalado: "papelera",
  campana: "megafono",
  sellar: "mas",
  restar: "menos",
  canjear: "regalo",
  guardar: "cartera",
  usarGuardado: "regalo",
  fusion: "movil",
  confirmar: "check",
};

const fecha = (iso) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Ficha({ serial, accent, estados, onCerrar, flash }) {
  const [datos, setDatos] = useState(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError(null);
    fetch(`/api/crm/cliente/${serial}`)
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error)))))
      .then((d) => { if (vigente) { setDatos(d); setNota(d.cliente.nota || ""); } })
      .catch((e) => { if (vigente) setError(String(e.message || e)); });
    return () => { vigente = false; };
  }, [serial]);

  async function guardarNota() {
    const r = await fetch(`/api/crm/cliente/${serial}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota }),
    });
    flash(r.ok ? "Nota guardada" : "No se pudo guardar la nota");
  }

  return (
    <div style={fondo} onClick={onCerrar}>
      <aside style={cajon} onClick={(e) => e.stopPropagation()}>
        <button onClick={onCerrar} style={cerrar} aria-label="Cerrar"><Icono nombre="cerrar" tam={18} /></button>

        {error && <p style={{ color: C.mal }}>{error}</p>}
        {!datos && !error && <p style={{ color: C.suave }}>Cargando…</p>}

        {datos && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ ...chipCodigo(accent), fontSize: 16, padding: "3px 9px" }}>{datos.cliente.codigo}</span>
              <strong style={{ fontSize: 18 }}>{datos.cliente.nombre || "Sin nombre"}</strong>
              <Chip estado={datos.perfil.estado} estados={estados} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, margin: "16px 0" }}>
              <Dato label="Visitas" valor={datos.perfil.visitas} />
              <Dato label="Ritmo" valor={cadenciaTexto(datos.perfil.cadencia)} />
              <Dato label="Última" valor={haceTexto(datos.perfil.diasSinVenir)} />
              <Dato label="Cliente desde" valor={haceTexto(datos.perfil.diasDesdeAlta)} />
              <Dato label="Tarjeta" valor={datos.saldo} />
            </div>

            <p style={{ fontSize: 13, color: C.suave, margin: "0 0 14px" }}>
              {datos.perfil.contactable
                ? "Tiene la tarjeta en el teléfono (Wallet o avisos de Android): le llegan los avisos."
                : datos.cliente.desinstalado
                  ? "Quitó la tarjeta del teléfono: ya no le llega nada."
                  : "Nunca guardó la tarjeta en el teléfono: no le llegan avisos."}
              {datos.cliente.origen && ` · Llegó por ${datos.cliente.origen === "tap" ? "el tag NFC" : "el mostrador"}.`}
            </p>

            {datos.cliente.mensaje && (
              <p style={{ ...recuadro, borderColor: `${accent}55`, background: `${accent}10` }}>
                <strong>Mensaje puesto ahora en su pase:</strong><br />{datos.cliente.mensaje}
              </p>
            )}

            <label style={etiqueta}>Nota de la tienda (no sale en el pase)</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Sin lactosa · el del perro · siempre a primera hora"
              style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
            />
            <button onClick={guardarNota} style={{ ...botonPequeno, marginTop: 8 }}>Guardar nota</button>

            <label style={etiqueta}>Su historia ({datos.eventos.length})</label>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {datos.eventos.map((e, i) => (
                <li key={i} style={linea}>
                  <span style={{ color: C.suave, paddingTop: 2 }}>{ICONO[e.tipo] ? <Icono nombre={ICONO[e.tipo]} tam={16} /> : <span style={{ display: "block", width: 16, textAlign: "center" }}>·</span>}</span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{e.mensaje}</div>
                    <div style={{ fontSize: 11, color: C.tenue }}>
                      {fecha(e.ts)}{e.actor ? ` · ${e.actor}` : ""}
                    </div>
                  </span>
                </li>
              ))}
              {!datos.eventos.length && <li style={{ color: C.suave, fontSize: 14 }}>Todavía no ha pasado nada.</li>}
            </ol>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <a href={`/p/${serial}`} style={{ ...botonPequeno, textDecoration: "none" }}>Ver su pase</a>
              <a href={`/w/${serial}`} style={{ ...botonPequeno, textDecoration: "none" }}>Abrir en caja</a>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Dato({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{valor}</div>
    </div>
  );
}

const fondo = {
  position: "fixed", inset: 0, background: "rgba(16,20,28,.35)",
  display: "flex", justifyContent: "flex-end", zIndex: 50,
};
const cajon = {
  background: C.panel, width: "min(460px, 94vw)", height: "100%", overflowY: "auto",
  padding: "22px 22px 40px", position: "relative", boxShadow: "-8px 0 30px rgba(16,20,28,.18)",
};
const cerrar = {
  position: "absolute", top: 14, right: 14, border: 0, background: "transparent",
  fontSize: 18, color: C.suave, cursor: "pointer", lineHeight: 1,
};
const linea = {
  display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start",
  padding: "8px 0", borderBottom: `1px solid ${C.borde}`,
};
const recuadro = { fontSize: 13, padding: "10px 12px", borderRadius: 10, border: "1px solid", margin: "0 0 4px" };
