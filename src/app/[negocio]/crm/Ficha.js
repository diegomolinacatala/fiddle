"use client";

import { useEffect, useState } from "react";
import { haceTexto, cadenciaTexto } from "@/lib/crm";
import { Chip } from "./piezas";
import Icono from "@/app/Icono";
import { FilaInterruptor } from "@/app/Interruptor";
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
  promos_no: "campanaNo",
  promos_si: "campana",
};

const fecha = (iso) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Ficha({ serial, accent, estados, onCerrar, flash }) {
  const [datos, setDatos] = useState(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState(null);
  const [promos, setPromos] = useState(true);
  const [borrando, setBorrando] = useState(false);
  const [codigoBorrar, setCodigoBorrar] = useState("");

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError(null);
    fetch(`/api/crm/cliente/${serial}`)
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error)))))
      .then((d) => { if (vigente) { setDatos(d); setNota(d.cliente.nota || ""); setPromos(!d.cliente.promos_no); } })
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

  // Lo que el cliente dice en el mostrador: "no me mandéis promos". Lo mismo
  // que puede tocar él desde su tarjeta; queda en su historia quién lo cambió.
  async function cambiarPromos() {
    const quiere = !promos;
    setPromos(quiere);
    const r = await fetch(`/api/crm/cliente/${serial}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promos: quiere }),
    }).catch(() => null);
    if (!r?.ok) {
      setPromos(!quiere);
      return flash("No se pudo cambiar");
    }
    flash(quiere ? "Vuelve a recibir promos" : "Ya no le llegarán promos");
  }

  async function borrar() {
    const r = await fetch(`/api/crm/cliente/${serial}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigoBorrar }),
    }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) return flash(d?.error || "No se pudo borrar");
    flash("Tarjeta borrada");
    onCerrar();
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

            <FilaInterruptor
              on={promos} onClick={cambiarPromos} accent={accent} icono={promos ? "campana" : "campanaNo"}
              titulo="Recibe promos"
              texto={promos
                ? "La promo, las campañas y los avisos automáticos. Los sellos le llegan siempre."
                : "Ni la promo, ni campañas, ni avisos automáticos. Los sellos le siguen llegando."}
              style={{ marginBottom: 14 }}
            />

            <label style={etiqueta}>Nota de la tienda (no sale en el pase)</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="El del perro · siempre a primera hora"
              style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
            />
            {/* Una intolerancia es un dato de salud (art. 9): no se apunta aquí. */}
            <p style={{ fontSize: 12, color: C.tenue, margin: "6px 0 0" }}>
              Nada de salud ni alergias. El cliente puede pedir leer esto.
            </p>
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

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <a href={`/p/${serial}`} style={{ ...botonPequeno, textDecoration: "none" }}>Ver su pase</a>
              <a href={`/w/${serial}`} style={{ ...botonPequeno, textDecoration: "none" }}>Abrir en caja</a>
              {/* Lo que pide el art. 15: todo lo que guardamos de él, historial incluido. */}
              <a href={`/api/crm/cliente/${serial}/datos`} download style={{ ...botonPequeno, textDecoration: "none" }}>Descargar sus datos</a>
            </div>

            {/* Borrar: solo si el cliente lo pide, y confirmando con su código. */}
            <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.borde}` }}>
              {!borrando ? (
                <button type="button" onClick={() => setBorrando(true)} style={{ ...botonPequeno, color: C.mal }}>Borrar a este cliente</button>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <p style={{ fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                    Si el cliente lo pide: se borran su tarjeta, su nombre, su nota y su historia. Su tarjeta
                    deja de valer en el teléfono. <strong>No se puede deshacer.</strong>
                  </p>
                  <label style={{ ...etiqueta, margin: 0 }} htmlFor="codigo-borrar">Escribe su código ({datos.cliente.codigo}) para confirmar</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input id="codigo-borrar" value={codigoBorrar} onChange={(e) => setCodigoBorrar(e.target.value.toUpperCase().slice(0, 3))}
                      autoComplete="off" style={{ ...campo, width: 90, textTransform: "uppercase", letterSpacing: 2 }} />
                    <button type="button" onClick={borrar} disabled={codigoBorrar !== datos.cliente.codigo}
                      style={{ ...botonPequeno, background: C.mal, color: "#fff", borderColor: C.mal, opacity: codigoBorrar === datos.cliente.codigo ? 1 : 0.5 }}>
                      Borrar para siempre
                    </button>
                    <button type="button" onClick={() => { setBorrando(false); setCodigoBorrar(""); }} style={botonPequeno}>Cancelar</button>
                  </div>
                </div>
              )}
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
  position: "absolute", top: 6, right: 6, border: 0, background: "transparent",
  fontSize: 18, color: C.suave, cursor: "pointer", lineHeight: 1,
  // 40 px: con el dedo, la X de 18 no se acierta a la primera.
  width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 10,
};
const linea = {
  display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start",
  padding: "8px 0", borderBottom: `1px solid ${C.borde}`,
};
const recuadro = { fontSize: 13, padding: "10px 12px", borderRadius: 10, border: "1px solid", margin: "0 0 4px" };
