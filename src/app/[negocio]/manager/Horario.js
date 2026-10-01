"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { FilaInterruptor } from "@/app/Interruptor";
import { DIAS, DIAS_CORTOS, ZONA_POR_DEFECTO, MAX_TRAMOS, aMinutos, aHora, fechaLocal } from "@/lib/horario";
import CalendarioCerrados from "./CalendarioCerrados";
import { C, campo, botonPrimario, RADIO } from "@/app/ui";

// ============================================================================
// CUÁNDO ABRE LA TIENDA
// ----------------------------------------------------------------------------
// Lo usan los avisos automáticos (solo salen con la tienda abierta, y la racha
// cuenta días de apertura), la tarjeta web ("Abierto hasta las 14:00") y el
// estado de la cabecera del pase de Wallet, que pone al día el reloj.
//
// Pensado para ponerlo en un minuto desde el móvil. Casi todas las tiendas son
// de uno de tres tipos, y eso se elige primero:
//   IGUAL     todos los días a la misma hora: un solo horario
//   SEMANA    uno de lunes a viernes y otro el fin de semana
//   DÍAS      cada día el suyo
// Los días que cierra se quitan tocando su letra, en cualquiera de los tres.
// Cada horario, uno o dos tramos: "+" parte el día en mañana y tarde. Los
// festivos van en un calendario aparte. Lo que se guarda es siempre lo mismo
// (siete días, cada uno con sus tramos o cerrado): el tipo se deduce al abrir.
//
// Debajo, si el pase lo dice: «● Abierto hasta las…» (tema.abierto). Es la
// misma pieza que se toca en la tarjeta (Editar tarjeta), puesta también aquí
// porque es donde se piensa en el horario. Se guarda al tocarla.
// ============================================================================

// Para una tienda que aún no lo ha puesto: un punto de partida, no un horario inventado.
const PARTIDA = {
  zona: ZONA_POR_DEFECTO,
  semana: [...Array(6).fill([{ abre: "09:00", cierra: "20:00" }]), null],
  cerrados: [],
};
const UN_TRAMO = [{ abre: "09:00", cierra: "20:00" }];

// Cortos: tienen que caber los tres en una fila en la columna del manager.
const MODOS = [["igual", "Todos igual", "Todos los días que abre, a la misma hora"], ["semana", "L–V y finde", "Un horario de lunes a viernes y otro el fin de semana"], ["dias", "Cada día", "Cada día con su horario"]];
const FINDE = [5, 6];
const copia = (tramos) => tramos.map((t) => ({ ...t }));
const tramoValido = (t) => aMinutos(t.abre) !== null && aMinutos(t.cierra) !== null && aMinutos(t.abre) < aMinutos(t.cierra);

/** Qué grupo de días comparte horario con el día `i` en ese modo (null: cada uno el suyo). */
const grupoDe = (modo, i) => (modo === "igual" ? "todos" : modo === "semana" ? (FINDE.includes(i) ? "finde" : "laborable") : null);

/** El tipo de horario que ya tiene: el más sencillo que lo describe tal cual. */
export function modoDe(semana) {
  const abiertos = semana.map((d, i) => (d ? i : null)).filter((i) => i !== null);
  const iguales = (lista) => lista.every((i) => JSON.stringify(semana[i]) === JSON.stringify(semana[lista[0]]));
  if (iguales(abiertos)) return "igual";
  if (iguales(abiertos.filter((i) => !FINDE.includes(i))) && iguales(abiertos.filter((i) => FINDE.includes(i)))) return "semana";
  return "dias";
}

/** Los horarios de cada grupo, sacados del primer día abierto de cada uno. */
function basesDe(semana) {
  const primero = (lista) => semana[lista.find((i) => semana[i])] || null;
  const todos = primero([0, 1, 2, 3, 4, 5, 6]) || UN_TRAMO;
  return { todos, laborable: primero([0, 1, 2, 3, 4]) || todos, finde: primero(FINDE) || todos };
}

/**
 * Parte un tramo en mañana y tarde. Si cubre la hora de comer (14–17), se corta
 * ahí, que es lo normal; si no, la tarde empieza una hora después de cerrar.
 */
function partir(t) {
  const abre = aMinutos(t.abre);
  const cierra = aMinutos(t.cierra);
  if (abre < 14 * 60 && cierra > 17 * 60) return [{ abre: t.abre, cierra: "14:00" }, { abre: "17:00", cierra: t.cierra }];
  const tarde = Math.min(cierra + 60, 22 * 60);
  return [t, { abre: aHora(tarde), cierra: aHora(Math.min(tarde + 3 * 60, 23 * 60 + 55)) }];
}

/**
 * @param {{slug:string, inicial:object|null, accent:string, flash:Function, onGuardado:Function,
 *   enPase:boolean, onEnPase:(on:boolean)=>void, reloj:boolean}} props
 *   `enPase`: si el pase dice «Abierto hasta…» (tema.abierto). `reloj`: si el reloj de los avisos anda.
 */
export default function Horario({ slug, inicial, accent, flash, onGuardado, enPase, onEnPase, reloj }) {
  const [h, setH] = useState(inicial || PARTIDA);
  const [modo, setModo] = useState(() => modoDe((inicial || PARTIDA).semana));
  const [bases, setBases] = useState(() => basesDe((inicial || PARTIDA).semana));
  const [guardando, setGuardando] = useState(false);
  const [calendario, setCalendario] = useState(false);

  const hoy = fechaLocal(Date.now(), h.zona);
  const cambiado = !inicial || JSON.stringify(h) !== JSON.stringify(inicial);
  const roto = h.semana.some((dia) => dia?.some((t) => !tramoValido(t)));
  const setSemana = (f) => setH((p) => ({ ...p, semana: f(p.semana) }));

  function cambiarModo(m) {
    const b = basesDe(h.semana);
    setBases(b);
    setModo(m);
    // Al pasar a uno más sencillo, los días abiertos toman el horario de su grupo.
    if (m !== "dias") setSemana((s) => s.map((d, i) => (d ? copia(b[grupoDe(m, i)]) : null)));
  }

  /** Cambia el horario de un grupo (o de un día suelto, en "cada día"). */
  function cambiarTramos(clave, tramos) {
    if (typeof clave === "number") return setSemana((s) => s.map((d, i) => (i === clave ? tramos : d)));
    setBases((b) => ({ ...b, [clave]: tramos }));
    setSemana((s) => s.map((d, i) => (d && grupoDe(modo, i) === clave ? copia(tramos) : d)));
  }

  function alternarDia(i) {
    const abre = h.semana[i];
    if (abre && h.semana.filter(Boolean).length === 1) return flash("Algún día tiene que abrir. Si cierras por vacaciones, usa «Festivos y vacaciones».");
    const grupo = grupoDe(modo, i);
    setSemana((s) => s.map((d, j) => (j !== i ? d : abre ? null : copia(grupo ? bases[grupo] : bases.todos))));
  }

  const alternarCerrado = (fecha) =>
    setH((p) => ({
      ...p,
      cerrados: p.cerrados.includes(fecha) ? p.cerrados.filter((f) => f !== fecha) : [...p.cerrados, fecha].sort(),
    }));

  async function guardar() {
    setGuardando(true);
    try {
      // Los días cerrados que ya pasaron no sirven de nada: fuera.
      const horario = { ...h, cerrados: h.cerrados.filter((f) => f >= hoy) };
      const r = await fetch(`/api/negocio?b=${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horario }),
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || "No se pudo guardar el horario");
      setH(data.horario);
      onGuardado(data);
      flash("Horario guardado");
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  // Las filas de horas que se enseñan: una por grupo con algún día abierto, o una por día.
  const abiertos = (lista) => lista.filter((i) => h.semana[i]);
  const filas = modo === "igual"
    ? [{ clave: "todos", nombre: "Los días que abre", dias: abiertos([0, 1, 2, 3, 4, 5, 6]) }]
    : modo === "semana"
      ? [
          { clave: "laborable", nombre: "Lunes a viernes", dias: abiertos([0, 1, 2, 3, 4]) },
          { clave: "finde", nombre: "Fin de semana", dias: abiertos(FINDE) },
        ]
      : abiertos([0, 1, 2, 3, 4, 5, 6]).map((i) => ({ clave: i, nombre: DIAS[i], dias: [i] }));
  const proximos = h.cerrados.filter((f) => f >= hoy).length;

  return (
    <div>
      <div role="radiogroup" aria-label="Tipo de horario" style={segmentos}>
        {MODOS.map(([id, texto, ayuda]) => (
          <button key={id} type="button" role="radio" aria-checked={modo === id} title={ayuda} onClick={() => cambiarModo(id)} style={segmento(modo === id, accent)}>
            {texto}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.tenue, marginTop: 5 }}>{MODOS.find((m) => m[0] === modo)[2]}.</div>

      <div style={{ fontSize: 13, color: C.suave, margin: "14px 0 6px" }}>Qué días abre</div>
      <div role="group" aria-label="Qué días abre" style={{ display: "flex", gap: 5 }}>
        {DIAS_CORTOS.map((letra, i) => (
          <button key={letra} type="button" aria-pressed={Boolean(h.semana[i])} onClick={() => alternarDia(i)}
            aria-label={`${DIAS[i]}: ${h.semana[i] ? "abre" : "cerrado"}`} style={chipDia(Boolean(h.semana[i]), accent)}>
            {letra}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {filas.map((f) => {
          const tramos = typeof f.clave === "number" ? h.semana[f.clave] : f.dias.length ? h.semana[f.dias[0]] : null;
          return (
            <div key={f.clave}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.nombre.charAt(0).toUpperCase() + f.nombre.slice(1)}</div>
              {tramos
                ? <Tramos nombre={f.nombre} tramos={tramos} onCambio={(t) => cambiarTramos(f.clave, t)} />
                : <div style={{ fontSize: 13, color: C.tenue }}>Cerrado</div>}
            </div>
          );
        })}
      </div>
      {roto && <p role="alert" style={{ fontSize: 13, color: C.mal, margin: "8px 0 0" }}>Hay un tramo que cierra antes de abrir.</p>}

      <button
        type="button" onClick={() => setCalendario((v) => !v)} aria-expanded={calendario} aria-controls="horario-calendario"
        style={plegable}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
          Festivos y vacaciones
          <span style={{ fontWeight: 400, color: proximos ? C.mal : C.tenue, marginLeft: 6 }}>
            {proximos ? `· ${proximos} ${proximos === 1 ? "día cerrado" : "días cerrados"}` : "· ninguno"}
          </span>
        </span>
        <span aria-hidden style={{ display: "inline-flex", color: C.suave, transform: `rotate(${calendario ? 90 : -90}deg)`, transition: "transform .15s" }}>
          <Icono nombre="volver" tam={18} />
        </span>
      </button>
      {calendario && (
        <div id="horario-calendario" style={{ marginTop: 8 }}>
          <p style={{ color: C.suave, fontSize: 13, margin: "0 0 8px" }}>Toca un día para cerrarlo; otra vez, para abrirlo.</p>
          <CalendarioCerrados horario={h} hoy={hoy} accent={accent} onAlternar={alternarCerrado} />
        </div>
      )}

      <button
        type="button" onClick={guardar} disabled={guardando || !cambiado || roto}
        style={{ ...botonPrimario(accent), marginTop: 14, opacity: guardando || !cambiado || roto ? 0.45 : 1 }}
      >
        {guardando ? "Guardando…" : "Guardar horario"}
      </button>

      {inicial && (
        <FilaInterruptor
          on={enPase} onClick={() => onEnPase(!enPase)} accent={accent} style={{ marginTop: 16 }}
          titulo="«● Abierto hasta las…» en la tarjeta"
          texto={!enPase
            ? "Apagado: la tarjeta no dice si estás abierto."
            : reloj
              ? "En el iPhone, sobre los sellos; en Android, en los detalles y en la tarjeta web."
              : "En la tarjeta web ya sale. En Wallet, cuando el reloj de los avisos esté en marcha."}
        />
      )}
    </div>
  );
}

/** Uno o dos tramos de un día (o de un grupo de días), con "+ tarde" y "quitar tarde". */
function Tramos({ nombre, tramos, onCambio }) {
  const cambiar = (k, campoTramo, valor) => onCambio(tramos.map((t, j) => (j === k ? { ...t, [campoTramo]: valor } : t)));
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {tramos.map((t, k) => {
        const parte = tramos.length > 1 ? (k === 0 ? "mañana" : "tarde") : null;
        const de = parte ? `${nombre} por la ${parte}` : nombre;
        const estilo = tramoValido(t) ? hora : { ...hora, borderColor: C.mal, color: C.mal };
        return (
          <div key={k} style={fila}>
            <input type="time" aria-label={`${de}: hora de abrir`} value={t.abre} step={300} onChange={(e) => cambiar(k, "abre", e.target.value)} style={estilo} />
            <span style={{ color: C.tenue }}>–</span>
            <input type="time" aria-label={`${de}: hora de cerrar`} value={t.cierra} step={300} onChange={(e) => cambiar(k, "cierra", e.target.value)} style={estilo} />
            {k === 0 && tramos.length < MAX_TRAMOS && (
              <button type="button" onClick={() => onCambio(partir(t))} title="Partir en mañana y tarde" aria-label={`${nombre}: añadir horario de tarde`} style={iconoBoton}>
                <Icono nombre="mas" tam={16} />
              </button>
            )}
            {k === 1 && (
              <button type="button" onClick={() => onCambio([tramos[0]])} title="Quitar la tarde" aria-label={`${nombre}: quitar el horario de tarde`} style={iconoBoton}>
                <Icono nombre="cerrar" tam={14} />
              </button>
            )}
            {k === 0 && tramos.length >= MAX_TRAMOS && <span style={{ width: 30, flexShrink: 0 }} />}
          </div>
        );
      })}
      {tramos.length < MAX_TRAMOS && <span style={{ fontSize: 11.5, color: C.tenue }}>+ parte el día en mañana y tarde</span>}
    </div>
  );
}

const segmentos = { display: "flex", gap: 3, padding: 3, background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: RADIO.boton };
const segmento = (on, accent) => ({
  flex: "1 1 0", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "7px 4px",
  borderRadius: 8, border: 0, cursor: "pointer", fontSize: 12.5, fontWeight: on ? 650 : 500,
  background: on ? accent : "transparent", color: on ? "#fff" : C.suave,
});
// Los siete en una fila, repartiéndose el ancho: en la columna estrecha el domingo se iba solo abajo.
const chipDia = (on, accent) => ({
  flex: "1 1 0", minWidth: 0, maxWidth: 40, height: 34, padding: 0, borderRadius: RADIO.boton, fontWeight: 600, fontSize: 13, cursor: "pointer",
  border: `1px solid ${on ? accent : C.borde}`, background: on ? `${accent}14` : C.panelSuave,
  color: on ? accent : C.tenue, textDecoration: on ? "none" : "line-through",
});
const plegable = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", marginTop: 16, padding: "10px 12px", textAlign: "left",
  cursor: "pointer", fontFamily: "inherit", color: C.texto, border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, background: "#fff",
};
const fila = { display: "flex", alignItems: "center", gap: 5, minHeight: 38 };
// Las dos horas se reparten lo que quede de fila: en la columna estrecha del
// manager, con ancho fijo, el cierre se salía y la página entera hacía scroll.
const hora = { ...campo, width: "auto", flex: "1 1 0", minWidth: 0, padding: "0.45rem 0.3rem", fontSize: 14 };
const iconoBoton = {
  width: 30, height: 30, flexShrink: 0, display: "grid", placeItems: "center", padding: 0, cursor: "pointer",
  border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, background: "#fff", color: C.suave,
};
