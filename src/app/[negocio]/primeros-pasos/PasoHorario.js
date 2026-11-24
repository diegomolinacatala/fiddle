"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Escena from "@/app/home/tarjeta/Escena";
import { Grupo, Opcion } from "@/app/home/tarjeta/controles";
import Icono from "@/app/Icono";
import { DIAS, DIAS_CORTOS, normalizarDia, normalizarHorario, relojLocal, resumenHorario, estadoParaPase } from "@/lib/horario";
import { Escenario, Panel, usePasos } from "./Marco";
import { armarTienda } from "./tienda";
import {
  TIPOS, TIPO_DE_PARTIDA, alternarDia, barrasDeDia, horarioDe, moverHora, puedeMover, rapidoDe, rapidoDeTipo, tramosValidos,
} from "./horarioRapido";

// ============================================================================
// PASO 3: «¿CUÁNDO ABRES?»
// ----------------------------------------------------------------------------
// Tres toques: el tipo de día, los días y, si hace falta, las horas. Un horario
// para todos los días abiertos; cada día distinto y los festivos se hacen luego
// en Tienda → Horario (aquí no cabe sin ser un formulario). La tarjeta enseña la
// línea «Abierto hasta…» con lo que se va eligiendo, y una tira de la semana
// dice de un vistazo cuándo está abierta. La lógica vive en horarioRapido.js.
// Con horario ya puesto se empieza por un resumen: lo normal es seguir.
// ============================================================================

const MINUTO_MS = 60_000;
const NOMBRE_DE_TRAMO = ["Mañana", "Tarde"];

/** Qué hora es «ahora»: nada hasta montar (el servidor no sabe la del navegador) y al día cada minuto. */
function useAhora() {
  const [ahora, setAhora] = useState(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), MINUTO_MS);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

export default function PasoHorario() {
  const { n, qr, seguir, guardar, setSub, setAtras } = usePasos();
  const inicial = useMemo(() => rapidoDe(n.horario), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tuvoHorario] = useState(() => Boolean(n.horario));
  const [editando, setEditando] = useState(!tuvoHorario);
  const [rapido, setRapido] = useState(() => inicial ?? rapidoDeTipo(TIPO_DE_PARTIDA));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const ahora = useAhora();

  // Con resumen hay dos pantallas: la flecha de atrás del marco vuelve de las horas al resumen.
  useEffect(() => {
    if (!tuvoHorario) return undefined;
    setSub(editando ? 1 : 0, 1);
    setAtras(editando ? () => { setEditando(false); setError(null); return true; } : null);
    return () => setAtras(null);
  }, [tuvoHorario, editando, setSub, setAtras]);

  const extras = useMemo(() => ({ zona: n.horario?.zona, cerrados: n.horario?.cerrados }), [n.horario]);
  const horario = useMemo(
    () => (editando ? horarioDe(rapido, extras) : normalizarHorario(n.horario)),
    [editando, rapido, extras, n.horario],
  );
  const estado = useMemo(() => (ahora && horario ? estadoParaPase(horario, ahora) : null), [ahora, horario]);
  const armar = useCallback((e, o) => armarTienda(n, { estado: e.estado })(e, o), [n]);
  const hoy = ahora && horario ? relojLocal(ahora, horario.zona).dia : null;

  const guardarYSeguir = async () => {
    setOcupado(true);
    setError(null);
    try {
      await guardar({ horario: horarioDe(rapido, extras) });
      seguir();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Escenario etiqueta="Tu tarjeta y tu semana" className="pp-escena-horario">
        <Escena eleccion={{ estado }} armar={armar} qr={qr.src} aria-hidden="true" />
        <Tira horario={horario} hoy={hoy} />
      </Escenario>
      {editando ? (
        <Panel
          llave="editor" titulo="¿Cuándo abres?" error={error}
          principal={{ texto: "Guardar horario", onClick: guardarYSeguir, ocupado, deshabilitado: !tramosValidos(rapido.tramos) }}
          className="pp-hor"
        >
          <ElegirTipo rapido={rapido} alElegir={(tipo) => setRapido((r) => rapidoDeTipo(tipo, r.dias))} />
          <Grupo titulo="Días">
            <ElegirDias dias={rapido.dias} alAlternar={(i) => setRapido((r) => ({ ...r, dias: alternarDia(r.dias, i) }))} />
          </Grupo>
          <Grupo titulo="Horas">
            <ElegirHoras tramos={rapido.tramos} alMover={(i, campo, sentido) => setRapido((r) => ({ ...r, tramos: moverHora(r.tramos, i, campo, sentido) }))} />
          </Grupo>
          <p className="pp-hor-nota">Cada día distinto y los festivos, en Tienda, Horario.</p>
        </Panel>
      ) : (
        <Panel llave="resumen" titulo="Tu horario" ahoraNo={false} className="pp-hor">
          <div className="pp-hor-resumen">
            <span className="pp-hor-resumen-et"><Icono nombre="reloj" tam={16} /> Ya tienes horario</span>
            <p className="pp-hor-resumen-texto">{resumenHorario(n.horario)}</p>
            <button type="button" className="pp-hor-sec" onClick={() => setEditando(true)}>Cambiarlo</button>
          </div>
          {!inicial && <p className="pp-hor-nota">Tiene días con horas distintas: si lo cambias aquí, todos quedan iguales.</p>}
        </Panel>
      )}
    </>
  );
}

// ------------------------------------------------------------------ tipos

function ElegirTipo({ rapido, alElegir }) {
  return (
    <div className="prob-rejilla pp-hor-tipos" role="radiogroup" aria-label="Cómo es tu día">
      {TIPOS.map((t) => (
        <Opcion key={t.id} activa={rapido.tipo === t.id} alElegir={() => alElegir(t.id)} etiqueta={t.nombre}>
          <span className="pp-mini" aria-hidden="true">
            {barrasDeDia(t.tramos).map((b, i) => (
              <i key={i} style={{ left: `${b.desde * 100}%`, width: `${b.largo * 100}%` }} />
            ))}
          </span>
        </Opcion>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- días

function ElegirDias({ dias, alAlternar }) {
  return (
    <div className="pp-hor-dias">
      {DIAS_CORTOS.map((letra, i) => (
        <button
          key={letra + i} type="button" className="pp-hor-dia" aria-pressed={dias.includes(i)} aria-label={DIAS[i]}
          onClick={() => alAlternar(i)}
        >
          {letra}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ horas

function ElegirHoras({ tramos, alMover }) {
  return (
    <div className="pp-hor-horas">
      {tramos.map((t, i) => (
        <div key={i} className="pp-hor-tramo">
          {tramos.length > 1 && <h3 className="pp-hor-tramo-nombre">{NOMBRE_DE_TRAMO[i]}</h3>}
          <FilaHora tramos={tramos} i={i} campo="abre" etiqueta="Abre" alMover={alMover} />
          <FilaHora tramos={tramos} i={i} campo="cierra" etiqueta="Cierra" alMover={alMover} />
        </div>
      ))}
    </div>
  );
}

function FilaHora({ tramos, i, campo, etiqueta, alMover }) {
  const id = useId();
  const sufijo = tramos.length > 1 ? ` (${NOMBRE_DE_TRAMO[i].toLowerCase()})` : "";
  const accion = campo === "abre" ? "Abrir" : "Cerrar";
  return (
    <div className="pp-hora-fila" role="group" aria-labelledby={id}>
      <span id={id} className="pp-hora-et">{etiqueta}</span>
      <button
        type="button" className="pp-hora-boton" aria-label={`${accion} media hora antes${sufijo}`}
        disabled={!puedeMover(tramos, i, campo, -1)} onClick={() => alMover(i, campo, -1)}
      >
        <Icono nombre="menos" tam={18} />
      </button>
      <output className="pp-hora-valor" aria-live="polite">{tramos[i][campo]}</output>
      <button
        type="button" className="pp-hora-boton" aria-label={`${accion} media hora después${sufijo}`}
        disabled={!puedeMover(tramos, i, campo, 1)} onClick={() => alMover(i, campo, 1)}
      >
        <Icono nombre="mas" tam={18} />
      </button>
    </div>
  );
}

// ------------------------------------------------------- la tira semanal

const MARCAS_DEL_EJE = [["6", 0], ["12", 1 / 3], ["18", 2 / 3], ["24", 1]];
const OCULTA = "translateX(0%) scaleX(0)";

/**
 * Siete filas con las horas abiertas como barras sobre un eje de 6:00 a 24:00. La
 * barra mide siempre lo que la fila y se coloca con translateX + scaleX: al cambiar
 * crece o se encoge sin animar el ancho. Hasta montar están a cero y entran creciendo.
 */
function Tira({ horario, hoy }) {
  const [montada, setMontada] = useState(false);
  useEffect(() => { setMontada(true); }, []);
  const filas = DIAS_CORTOS.map((letra, i) => {
    const barras = barrasDeDia(normalizarDia(horario?.semana?.[i]));
    return { letra, barras: [0, 1].map((j) => barras[j] ?? null) };
  });
  return (
    <div className="pp-tira" role="img" aria-label={`Tu semana: ${resumenHorario(horario)}`}>
      <div className="pp-tira-filas" aria-hidden="true">
        {filas.map((f, i) => (
          <div key={f.letra + i} className={`pp-tira-fila${hoy === i ? " hoy" : ""}`}>
            <span className="pp-tira-dia">{f.letra}</span>
            <span className="pp-tira-pista">
              {f.barras.map((b, j) => (
                <i key={j} style={{ transform: montada && b ? `translateX(${b.desde * 100}%) scaleX(${b.largo})` : OCULTA }} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="pp-tira-eje" aria-hidden="true">
        <span />
        <span className="pp-tira-marcas">
          {MARCAS_DEL_EJE.map(([t, f]) => <em key={t} style={{ left: `${f * 100}%` }}>{t}</em>)}
        </span>
      </div>
    </div>
  );
}
