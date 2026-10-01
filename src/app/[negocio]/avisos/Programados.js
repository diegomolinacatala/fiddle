"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icono from "@/app/Icono";
import PaseVista from "@/app/PaseVista";
import Regla from "./Regla";
import Limites from "./Limites";
import {
  VARIABLES, MAX_TEXTO, MAX_REGLAS, renderTexto, candidatos, elegibles, variablesDesconocidas, esProgramado, programadoNuevo,
} from "@/lib/automatizaciones";
import { DIAS, DIAS_CORTOS, relojLocal } from "@/lib/horario";
import { C, panel, campo, etiqueta, botonPrimario, botonSecundario, RADIO } from "@/app/ui";

// ============================================================================
// AVISOS PROGRAMADOS: "el sábado a las 10, a todos: «hoy, 2x1»"
// ----------------------------------------------------------------------------
// Lo que la tienda decide cuándo sale, no lo que salta solo por algo que hace
// el cliente (eso son los automáticos). Un día concreto o cada semana, a todos
// o a un grupo. Por dentro son reglas como las automáticas (mismo motor, misma
// hora de la tienda, mismo "solo con la tienda abierta"), con dos diferencias:
// salen cada vez que les toca y pueden saltarse la pausa entre avisos.
// Nunca el tope del día (Limites.js), que es lo que protege al cliente.
//
// `semilla`: un programado ya empezado, que llega por la URL desde Clientes
// ("los martes por la tarde están tranquilos → programar un aviso").
// ============================================================================

export default function Programados({ slug, datos, onDatos, flash, semilla = null }) {
  const { negocio: n, contextos } = datos;
  const reglas = n.automatizaciones;
  const programados = reglas.filter(esProgramado);
  const [abierta, setAbierta] = useState(null);
  const [nueva, setNueva] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const envios = useMemo(() => ({ porRegla: new Map(datos.envios.porRegla), ultimo: new Map(datos.envios.ultimo), veces: new Map(datos.envios.veces || []) }), [datos.envios]);
  const topes = { pausaDias: n.pausaAvisos, inicioHoy: datos.inicioHoy, limiteDia: n.limiteAvisosDia };
  const sembrado = useRef(false);

  useEffect(() => {
    if (semilla && !sembrado.current) {
      sembrado.current = true;
      setNueva(programadoNuevo(reglas, semilla));
    }
  }, [semilla, reglas]);

  async function guardarCambios(cambios) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/automatizaciones?b=${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
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
  const guardarLista = (lista) => guardarCambios({ automatizaciones: lista });

  const acciones = {
    editar: (id) => { setNueva(null); setAbierta(id); },
    cancelar: () => { setAbierta(null); setNueva(null); },
    async alternar(regla) {
      const ok = await guardarLista(reglas.map((r) => (r.id === regla.id ? { ...r, activa: !r.activa } : r)));
      if (ok) flash(regla.activa ? `«${regla.nombre}» apagado` : `«${regla.nombre}» encendido`);
    },
    async guardar(regla) {
      const existe = reglas.some((r) => r.id === regla.id);
      const lista = existe ? reglas.map((r) => (r.id === regla.id ? regla : r)) : [...reglas, regla];
      if (await guardarLista(lista)) {
        flash(existe ? "Guardado" : `«${regla.nombre}» programado`);
        acciones.cancelar();
      }
    },
    async borrar(regla) {
      if (!window.confirm(`¿Borrar «${regla.nombre}»?\n\nDeja de salir. Lo ya enviado sigue en Enviados.`)) return;
      if (await guardarLista(reglas.filter((r) => r.id !== regla.id))) { flash(`«${regla.nombre}» borrado`); acciones.cancelar(); }
    },
    async enviar(regla, cuantos) {
      if (!window.confirm(`¿Enviar «${regla.nombre}» ahora a ${cuantos} ${cuantos === 1 ? "cliente" : "clientes"}?\n\nNo espera a su hora.`)) return;
      setOcupado(true);
      try {
        const r = await fetch(`/api/automatizaciones?b=${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regla: regla.id }) });
        const data = await r.json();
        if (!r.ok) return flash(data.error || "No se pudo enviar");
        onDatos(data.datos);
        flash(data.envio?.destinatarios ? `Enviado a ${data.envio.destinatarios}` : "Ahora mismo no le toca a nadie");
      } catch {
        flash("Sin conexión: no se ha enviado");
      } finally {
        setOcupado(false);
      }
    },
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ ...panel, margin: 0, fontSize: 13.5, color: C.suave, padding: "12px 14px" }}>
        Un mensaje que sale <strong style={{ color: C.texto }}>cuando tú digas</strong>: un día concreto o cada semana, a todos o a
        un grupo. Sale solo con la tienda abierta y con los avisos automáticos encendidos (pestaña Automáticos)
        {!n.avisosActivos && <strong style={{ color: C.mal }}> — ahora están apagados: no saldrá ninguno solo</strong>}.
      </p>

      {programados.map((r) => (
        <Regla key={r.id} regla={r} negocio={n} grupos={datos.catalogoGrupos} contextos={contextos} envios={envios}
          topes={topes} abierta={abierta === r.id} nueva={false} ocupado={ocupado} acciones={acciones} Formulario={EditorProgramado} />
      ))}
      {nueva && (
        <Regla regla={nueva} negocio={n} grupos={datos.catalogoGrupos} contextos={contextos} envios={envios}
          topes={topes} abierta nueva ocupado={ocupado} acciones={acciones} Formulario={EditorProgramado} />
      )}
      {!programados.length && !nueva && (
        <p style={{ ...panel, color: C.suave, fontSize: 14, margin: 0 }}>No hay ninguno programado.</p>
      )}
      {!nueva && reglas.length < MAX_REGLAS && (
        <button type="button" onClick={() => { setAbierta(null); setNueva(programadoNuevo(reglas)); }}
          style={{ ...botonSecundario, display: "inline-flex", alignItems: "center", gap: 8, justifySelf: "start" }}>
          <Icono nombre="mas" tam={18} /> Programar un aviso
        </button>
      )}

      <Limites negocio={n} ocupado={ocupado} guardar={guardarCambios} flash={flash}>
        <li>Un programado le llega a cada uno <strong style={{ color: C.texto }}>una vez por envío</strong>: si es «cada sábado», cada sábado.</li>
      </Limites>
    </div>
  );
}

/** El formulario de un programado: qué, a quién, cuándo. */
function EditorProgramado({ inicial, negocio, grupos, contextos, envios, topes, nueva, ocupado, acciones }) {
  const [r, setR] = useState(inicial);
  const texto = useRef(null);
  const accent = negocio.tema.accent;
  const set = (k, v) => setR((p) => ({ ...p, [k]: v }));
  const hoy = relojLocal(Date.now(), negocio.horario?.zona).fecha;
  const unDia = Boolean(r.fecha);

  const abiertos = negocio.horario ? negocio.horario.semana.map((t, i) => (t ? i : null)).filter((i) => i !== null) : [0, 1, 2, 3, 4, 5, 6];
  const marcados = r.dias.length ? r.dias : abiertos;
  function alternarDia(i) {
    const lista = marcados.includes(i) ? marcados.filter((x) => x !== i) : [...marcados, i].sort((a, b) => a - b);
    if (!lista.length) return;
    set("dias", abiertos.every((x) => lista.includes(x)) && lista.length === abiertos.length ? [] : lista);
  }
  function meterVariable(clave) {
    const el = texto.current;
    const trozo = `{${clave}}`;
    const desde = el?.selectionStart ?? r.texto.length;
    const hasta = el?.selectionEnd ?? r.texto.length;
    set("texto", (r.texto.slice(0, desde) + trozo + r.texto.slice(hasta)).slice(0, MAX_TEXTO));
    requestAnimationFrame(() => el?.focus());
  }

  const encajan = candidatos(r, contextos);
  const llegan = elegibles(r, contextos, envios, { ahora: Date.now(), ...topes });
  const muestra = llegan[0] || encajan[0] || null;
  const vars = muestra ? muestra.vars : { premio: negocio.premio, faltan: "1 sello", dias: "21", racha: "4", nombre: "", tienda: negocio.nombre };
  const malas = variablesDesconocidas(r.texto);
  const pasado = unDia && r.fecha < hoy;
  const cambiada = nueva || JSON.stringify(r) !== JSON.stringify(inicial);
  const valida = r.texto.trim() && !malas.length && r.hora && !pasado;
  const diaCerrado = unDia && negocio.horario && !negocio.horario.semana[(new Date(`${r.fecha}T12:00:00Z`).getUTCDay() + 6) % 7];

  const clienteVista = {
    serial: "ejemplo-0000-0000-0000-000000000000", codigo: "ABC", nombre: null,
    ...(muestra?.saldo || { sellos: Math.max(1, Math.round((negocio.cartillas?.[0]?.meta ?? negocio.meta ?? 1) * 0.6)), sellos2: negocio.cartillas ? 2 : 0, premios: 0 }),
    mensaje: renderTexto(r.texto, vars) || null,
  };

  return (
    <article style={{ ...panel, borderColor: accent, boxShadow: `0 0 0 3px ${accent}1a` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(290px, 100%), 1fr))", gap: 22, alignItems: "start" }}>
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }} htmlFor={`pn-${r.id}`}>Nombre</label>
          <input id={`pn-${r.id}`} value={r.nombre} maxLength={40} onChange={(e) => set("nombre", e.target.value)} style={campo} />

          <label style={etiqueta}>A quién</label>
          <Segmentos accent={accent} valor={r.disparo} opciones={[["todos", "A todos"], ["grupo", "A un grupo"]]}
            onChange={(v) => setR((p) => ({ ...p, disparo: v, valor: v === "grupo" ? "habituales" : null }))} />
          {r.disparo === "grupo" && (
            <select aria-label="Grupo" value={r.valor} onChange={(e) => set("valor", e.target.value)} style={{ ...campo, marginTop: 8 }}>
              {grupos.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          )}

          <label style={etiqueta}>Cuándo</label>
          <Segmentos accent={accent} valor={unDia ? "dia" : "semana"} opciones={[["dia", "Un día"], ["semana", "Cada semana"]]}
            onChange={(v) => setR((p) => (v === "dia" ? { ...p, fecha: p.fecha || hoy } : (({ fecha, ...resto }) => { void fecha; return resto; })(p)))} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {unDia && (
              <input type="date" min={hoy} value={r.fecha} onChange={(e) => set("fecha", e.target.value)} style={{ ...campo, width: 160 }} aria-label="Día" />
            )}
            <span style={{ fontSize: 14 }}>a las</span>
            <input type="time" step={300} value={r.hora} onChange={(e) => set("hora", e.target.value)} style={{ ...campo, width: 118 }} aria-label="Hora" />
          </div>
          {!unDia && (
            <div role="group" aria-label="Qué días" style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {DIAS_CORTOS.map((letra, i) => {
                const abre = abiertos.includes(i);
                const on = abre && marcados.includes(i);
                return (
                  <button key={letra} type="button" disabled={!abre} aria-pressed={on} onClick={() => alternarDia(i)}
                    aria-label={abre ? DIAS[i] : `${DIAS[i]}: cerrado`} style={chipDia(on, abre, accent)}>{letra}</button>
                );
              })}
            </div>
          )}
          {pasado && <p style={{ ...ayuda, color: C.mal }}>Ese día ya ha pasado.</p>}
          {diaCerrado && <p style={{ ...ayuda, color: C.mal }}>Ese día la tienda cierra: no saldría.</p>}
          <p style={ayuda}>Solo con la tienda abierta: si a esa hora aún no ha abierto, sale al abrir.</p>

          <label style={etiqueta} htmlFor={`pt-${r.id}`}>Lo que le llega</label>
          <textarea id={`pt-${r.id}`} ref={texto} rows={3} value={r.texto} maxLength={MAX_TEXTO}
            onChange={(e) => set("texto", e.target.value)} style={{ ...campo, resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ fontSize: 12, color: r.texto.length > MAX_TEXTO - 20 ? C.mal : C.tenue, marginTop: 4 }}>{r.texto.length}/{MAX_TEXTO}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {VARIABLES.map((v) => (
              <button key={v.clave} type="button" onClick={() => meterVariable(v.clave)} title={v.ayuda} style={chipVariable}>{`{${v.clave}}`}</button>
            ))}
          </div>
          {malas.length > 0 && <p style={{ ...ayuda, color: C.mal }}>No existe {`{${malas[0]}}`}. Usa las de arriba.</p>}

          <label style={opcionCheck}>
            <input type="checkbox" checked={r.caduca} onChange={(e) => set("caduca", e.target.checked)} style={{ marginTop: 3 }} />
            <span>Quitarlo de la tarjeta al cerrar ese día <span style={{ color: C.tenue }}>(lo normal en una promo de un día)</span></span>
          </label>
          <label style={opcionCheck}>
            <input type="checkbox" checked={Boolean(r.ignorarPausa)} onChange={(e) => set("ignorarPausa", e.target.checked)} style={{ marginTop: 3 }} />
            <span>Aunque haya recibido otro aviso hace poco <span style={{ color: C.tenue }}>(el máximo del día se respeta igual)</span></span>
          </label>
        </div>

        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>Cómo lo verá</label>
          <PaseVista negocio={negocio} cliente={clienteVista} qrTexto={`/w/${clienteVista.serial}`} />
          <div style={{ ...cuenta, borderColor: `${accent}40` }}>
            <strong style={{ fontSize: 22, fontWeight: 650 }}>{llegan.length}</strong>
            <span style={{ fontSize: 13, color: C.suave }}>
              {llegan.length === 1 ? "le llegaría" : "les llegaría"} si saliera ahora.
              {encajan.length > llegan.length && ` De ${encajan.length}: al resto no se le puede avisar (sin la tarjeta en el teléfono), ya recibió uno hace poco o llegó a su máximo de hoy.`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${C.borde}`, paddingTop: 14 }}>
        <button type="button" disabled={ocupado || !valida || !cambiada} onClick={() => acciones.guardar(r)}
          style={{ ...botonPrimario(accent), opacity: ocupado || !valida || !cambiada ? 0.45 : 1 }}>
          {nueva ? "Programar" : "Guardar"}
        </button>
        <button type="button" onClick={acciones.cancelar} style={botonSecundario} disabled={ocupado}>Cancelar</button>
        {!nueva && (
          <button type="button" disabled={ocupado || cambiada || !llegan.length} onClick={() => acciones.enviar(r, llegan.length)}
            style={{ ...botonSecundario, opacity: ocupado || cambiada || !llegan.length ? 0.5 : 1 }}>
            Enviar ahora{llegan.length ? ` a ${llegan.length}` : ""}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {!nueva && (
          <button type="button" onClick={() => acciones.borrar(r)} disabled={ocupado} style={{ ...botonSecundario, color: C.mal, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Icono nombre="papelera" tam={16} /> Borrar
          </button>
        )}
      </div>
    </article>
  );
}

function Segmentos({ valor, opciones, onChange, accent }) {
  return (
    <div role="radiogroup" style={{ display: "flex", gap: 4, padding: 3, background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 10, maxWidth: 320 }}>
      {opciones.map(([id, t]) => (
        <button key={id} type="button" role="radio" aria-checked={id === valor} onClick={() => onChange(id)} style={{
          flex: 1, padding: "7px 8px", borderRadius: 8, border: 0, cursor: "pointer", fontSize: 13, fontWeight: id === valor ? 650 : 500,
          background: id === valor ? accent : "transparent", color: id === valor ? "#fff" : C.suave,
        }}>{t}</button>
      ))}
    </div>
  );
}

const ayuda = { fontSize: 12.5, color: C.tenue, margin: "6px 0 0", lineHeight: 1.45 };
const opcionCheck = { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, marginTop: 12, cursor: "pointer" };
const cuenta = { display: "flex", alignItems: "baseline", gap: 10, marginTop: 14, padding: "12px 14px", border: "1px solid", borderRadius: RADIO.fila };
const chipVariable = {
  padding: "4px 8px", borderRadius: 7, border: `1px solid ${C.borde}`, background: C.panelSuave, color: C.texto,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, cursor: "pointer",
};
const chipDia = (on, abre, accent) => ({
  width: 36, height: 34, borderRadius: RADIO.boton, fontWeight: 600, fontSize: 13,
  border: `1px solid ${on ? accent : C.borde}`, background: on ? `${accent}14` : abre ? "#fff" : C.panelSuave,
  color: on ? accent : abre ? C.texto : C.tenue, cursor: abre ? "pointer" : "not-allowed",
  textDecoration: abre ? "none" : "line-through",
});
