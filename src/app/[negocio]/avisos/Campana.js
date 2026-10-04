"use client";

import Icono from "@/app/Icono";
import { useEffect, useMemo, useState } from "react";
import PaseVista from "@/app/PaseVista";
import {
  TODOS, MOMENTO, MAX_TEXTO, esPromo, horasParaEnviar, horaSugerida, cuandoEnvioTexto, infoDestino,
} from "@/lib/envios";
import { RELOJ_VIVO_MIN } from "@/lib/automatizaciones";
import { DIAS, horaCorta } from "@/lib/horario";
import { C, campo, etiqueta, h2, botonPrimario, botonSecundario, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// MANDAR UN MENSAJE, AHORA O A UNA HORA
// ----------------------------------------------------------------------------
// Tres cosas que para el dueño son lo mismo ("decirles algo") y por dentro no:
//   TODOS    la PROMO de la tienda: sale en todas las tarjetas, también en las
//            que se emitan mañana, hasta que se quite.
//   MOMENTO  un MENSAJE a todos que se quita solo al cerrar ese día.
//   GRUPO    un MENSAJE (PARA TI) en el pase de cada uno de ese grupo: va donde los «Faltan» y se
//            va solo cuando el cliente vuelve.
// Por eso están en la misma pantalla con una frase que dice cuál es cuál.
//
// «Enviar a las…» ofrece solo hoy (hasta el último cierre) y mañana por la
// mañana (lib/envios.js), y lo manda el reloj de los avisos: sin reloj, no se
// ofrece. A quién se calcula al mandarlo, no al programarlo.
//
// La vista previa usa PaseVista, o sea las MISMAS funciones que arman el
// .pkpass: lo que se ve aquí es lo que va a aparecer en el teléfono.
// ============================================================================

export default function Campana({ negocio, destino, onEnviada, onDatos, flash, pendientes, reloj, grupos, semilla = null }) {
  const esTodos = esPromo(destino.key);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hora, setHora] = useState("");
  const max = esTodos ? MAX_TEXTO.todos : MAX_TEXTO.mensaje;

  // Al cambiar de destino, su idea de partida: un punto de partida para no mirar
  // un campo vacío, no una plantilla. Para todos, la promo que ya esté puesta. Si
  // se llegó con un texto (de Clientes), ese.
  useEffect(() => {
    const deSemilla = semilla?.grupo === destino.key && semilla.texto;
    setTexto(deSemilla || (esTodos ? negocio.promo || "" : destino.idea?.replace("{premio}", negocio.premio) || ""));
  }, [destino.key, esTodos, destino.idea, negocio.promo, negocio.premio, semilla]);

  // Las horas se piden al montar y cada minuto: la de hace un rato puede haber pasado.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const horas = useMemo(() => horasParaEnviar(negocio.horario, ahora), [negocio.horario, ahora]);
  const sugerida = useMemo(
    () => (semilla?.grupo === destino.key && (semilla.dia !== null || semilla.hora) ? horaSugerida(negocio.horario, semilla, ahora) : null),
    [semilla, destino.key, negocio.horario, ahora],
  );
  useEffect(() => { if (sugerida?.cuando) setHora(sugerida.cuando); }, [sugerida?.cuando]);
  // Si la elegida ya pasó, se suelta.
  const todasLasHoras = [...horas.hoy, ...horas.manana];
  const horaVale = todasLasHoras.some((h) => h.cuando === hora);

  const relojVivo = Boolean(reloj?.ultimo) && ahora - Date.parse(reloj.ultimo) <= RELOJ_VIVO_MIN * 60_000;
  const sePuedeProgramar = relojVivo && todasLasHoras.length > 0;

  const clienteVista = {
    serial: "ejemplo-0000-0000-0000-000000000000",
    codigo: "ABC",
    nombre: "Cliente",
    sellos: Math.max(1, Math.round((negocio.meta || 1) * 0.6)),
    premios: 0,
    mensaje: esTodos ? null : texto.trim() || null,
  };
  const negocioVista = esTodos ? { ...negocio, promo: texto.trim() || null } : negocio;

  async function enviar(cuerpo) {
    setEnviando(true);
    try {
      const r = await fetch(esTodos ? "/api/promo" : "/api/crm/campana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esTodos ? { b: negocio.slug, texto: cuerpo } : { b: negocio.slug, grupo: destino.key, texto: cuerpo }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo enviar");
      flash(resumen(d, cuerpo, esTodos));
      onEnviada();
    } catch {
      flash("Sin conexión: no se ha enviado");
    } finally {
      setEnviando(false);
    }
  }

  async function programar() {
    setEnviando(true);
    try {
      const r = await fetch("/api/envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b: negocio.slug, destino: destino.key, texto: texto.trim(), cuando: hora }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo programar");
      onDatos((p) => ({ ...p, pendientes: d.pendientes }));
      flash(`Programado para ${cuandoEnvioTexto(hora, negocio.horario)}`);
      setHora("");
    } catch {
      flash("Sin conexión: no se ha programado");
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id) {
    try {
      const r = await fetch("/api/envios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b: negocio.slug, id }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo cancelar");
      onDatos((p) => ({ ...p, pendientes: d.pendientes }));
      flash("Envío cancelado");
    } catch {
      flash("Sin conexión: no se ha cancelado");
    }
  }

  const sinNadie = destino.contactables === 0;
  const bloqueado = enviando || sinNadie || !texto.trim();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 20, alignItems: "start" }}>
      <div>
        <h2 style={{ ...h2, display: "flex", alignItems: "center", gap: 8 }}><Icono nombre={destino.icon} tam={18} /> {destino.label}</h2>
        <p style={{ fontSize: 13, color: C.suave, margin: "0 0 4px" }}>{destino.descripcion}</p>
        <p style={{ fontSize: 13, margin: "0 0 14px" }}>
          <strong>{destino.total}</strong> cliente{destino.total === 1 ? "" : "s"} ·{" "}
          <strong style={{ color: destino.contactables ? C.ok : C.mal }}>{destino.contactables}</strong> con la tarjeta en el teléfono y promos
          {destino.total !== destino.contactables && (
            <span style={{ color: C.tenue }}> · a {destino.total - destino.contactables} no se les puede avisar (sin tarjeta en el teléfono o no quieren promos)</span>
          )}
        </p>

        <label style={{ ...etiqueta, marginTop: 0 }} htmlFor="texto-campana">Lo que leerán en el pase</label>
        <textarea
          id="texto-campana" value={texto} rows={3} placeholder={esTodos ? "Hoy 2x1 en cafés…" : ""}
          onChange={(e) => setTexto(e.target.value.slice(0, max))}
          style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 12, color: texto.length > max - 20 ? C.mal : C.tenue, marginTop: 4 }}>
          {texto.length}/{max} · una línea corta se lee de un vistazo en la pantalla de bloqueo
        </div>

        {/* AHORA */}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={() => enviar(texto.trim())} disabled={bloqueado} style={{ ...botonPrimario(negocio.tema.accent), opacity: bloqueado ? 0.45 : 1, cursor: bloqueado ? "default" : "pointer" }}>
            {enviando ? "Enviando…" : esTodos ? "Poner ahora en todas" : `Enviar ahora a ${destino.contactables}`}
          </button>
          {(!esTodos || negocio.promo) && (
            <button onClick={() => enviar("")} disabled={enviando} style={botonSecundario} title="Deja el pase como estaba">
              {esTodos ? "Quitar la promo" : "Quitar el mensaje"}
            </button>
          )}
        </div>

        {/* A UNA HORA */}
        <div style={cajaHora}>
          <label style={{ ...etiqueta, marginTop: 0 }} htmlFor="hora-envio">O a una hora</label>
          {sePuedeProgramar ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select id="hora-envio" value={horaVale ? hora : ""} onChange={(e) => setHora(e.target.value)} style={{ ...campo, width: "auto", minWidth: 150, flex: "0 1 auto" }}>
                <option value="">Elige la hora…</option>
                {horas.hoy.length > 0 && (
                  <optgroup label="Hoy">
                    {horas.hoy.map((h) => <option key={h.cuando} value={h.cuando}>Hoy, {horaCorta(h.hora)}</option>)}
                  </optgroup>
                )}
                {horas.manana.length > 0 && (
                  <optgroup label="Mañana">
                    {horas.manana.map((h) => <option key={h.cuando} value={h.cuando}>Mañana, {horaCorta(h.hora)}</option>)}
                  </optgroup>
                )}
              </select>
              <button onClick={programar} disabled={bloqueado || !horaVale} style={{ ...botonSecundario, opacity: bloqueado || !horaVale ? 0.45 : 1 }}>
                {horaVale ? `Enviar ${cuandoEnvioTexto(hora, negocio.horario)}` : "Enviar a las…"}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: C.tenue, margin: 0 }}>{porQueNoSePuede(negocio, horas, relojVivo)}</p>
          )}
          {sugerida && !sugerida.cuando && sugerida.dia !== null && (
            <p style={{ fontSize: 12.5, color: C.suave, margin: "8px 0 0" }}>
              Lo suyo es mandarlo un {DIAS[sugerida.dia]}{sugerida.hora ? ` hacia las ${horaCorta(sugerida.hora)}` : ""}. Solo se puede
              programar para hoy o mañana: vuelve ese día, o mándalo ya.
            </p>
          )}
          {sePuedeProgramar && (
            <p style={{ fontSize: 12, color: C.tenue, margin: "8px 0 0" }}>
              Hoy, hasta que cierres; mañana, de la apertura al primer cierre. Sale en el cuarto de hora elegido. A quién se mira al enviarlo.
            </p>
          )}
        </div>

        <p style={{ fontSize: 12.5, color: C.tenue, marginTop: 12 }}>
          {esTodos
            ? "Se queda en todas las tarjetas, también en las nuevas, hasta que la quites."
            : destino.key === MOMENTO
              ? "Se borra solo de todas las tarjetas cuando cierres ese día."
              : "Se queda en la tarjeta de cada uno hasta que vuelva a la tienda; entonces se borra solo."}
        </p>
        {sinNadie && (
          <p style={{ fontSize: 13, color: C.mal, marginTop: 8 }}>
            {destino.total === 0
              ? "Ahora mismo no hay nadie en este grupo."
              : `Nadie ${esTodos ? "" : "de este grupo "}tiene la tarjeta en el teléfono (Wallet o avisos de Android), así que no hay a dónde mandarlo.`}
          </p>
        )}

        {pendientes.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...etiqueta, marginTop: 0 }}>Esperando su hora</div>
            <div style={{ display: "grid", gap: 6 }}>
              {pendientes.map((p) => (
                <div key={p.id} style={filaPendiente}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {cuandoEnvioTexto(p.cuando, negocio.horario, ahora)} · {(grupos.find((g) => g.key === p.destino) || infoDestino(p.destino))?.label || p.destino}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.suave, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>«{p.texto}»</div>
                  </div>
                  <button type="button" onClick={() => cancelar(p.id)} style={botonPequeno}>Cancelar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label style={{ ...etiqueta, marginTop: 0 }}>Cómo lo verán</label>
        <PaseVista
          negocio={negocioVista}
          cliente={clienteVista}
          qrTexto={`/w/${clienteVista.serial}`}
          pie={esTodos
            ? "La promo va siempre a la derecha. Si alguien tiene un PARA TI, ese va a la izquierda, en lugar de lo que le falta."
            : "PARA TI va donde pone lo que le falta (los círculos lo siguen contando); la promo sigue a la derecha. Vuelve a salir lo que falta en su siguiente visita."}
        />
      </div>
    </div>
  );
}

function porQueNoSePuede(negocio, horas, relojVivo) {
  if (!negocio.horario) return "Para enviar a una hora hace falta el horario de la tienda (pestaña Tienda → Horario).";
  if (!relojVivo) return "El reloj de los avisos no está en marcha, así que lo programado no saldría. De momento, solo «Enviar ahora».";
  if (horas.motivo === "cerrada") return "Hoy ya has cerrado y mañana no abres: no hay hora a la que programarlo.";
  return "No hay horas libres para programar.";
}

/** Cuántos teléfonos sonaron, por canal: iPhone (Wallet) y Android (avisos + Google Wallet). */
function resumen(d, cuerpo, esTodos) {
  if (!cuerpo) return esTodos ? "Promo quitada de todas las tarjetas" : `Mensaje quitado de ${d.quitado} ${d.quitado === 1 ? "tarjeta" : "tarjetas"}`;
  const android = (d.web || 0) + (d.google || 0);
  const iphone = esTodos ? d.enviadas : d.avisados;
  const sonaron = [d.proveedor === "apple" && `${iphone} iPhone`, android && `${android} Android`].filter(Boolean);
  const base = esTodos ? `Promo puesta en ${d.total} tarjetas` : `Enviado a ${d.destinatarios}`;
  return `${base}${sonaron.length ? ` · avisados: ${sonaron.join(", ")}` : ""}`;
}

const cajaHora = {
  marginTop: 14, padding: "12px 13px", borderRadius: RADIO.fila, border: `1px solid ${C.borde}`, background: C.panelSuave,
};
const filaPendiente = {
  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: RADIO.fila, border: `1px solid ${C.borde}`, background: "#fff",
};

export { TODOS };
