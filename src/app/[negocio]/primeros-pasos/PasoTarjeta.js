"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Escena from "@/app/home/tarjeta/Escena";
import Colores from "@/app/home/tarjeta/Colores";
import { Opcion, Segmentos, Grupo } from "@/app/home/tarjeta/controles";
import { PALETAS, ICONOS, FONDOS, MODOS } from "@/app/home/tarjeta/opciones";
import { LogoApple } from "@/app/LogoTienda";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { tiene } from "@/lib/planes";
import { Escenario, Panel, usePasos } from "./Marco";
import { armarTienda, clienteDeEjemplo } from "./tienda";
import {
  MAX_PREMIO, paletaDe, iconoDe, fondoDe, modoDe, tienePremioUnico, metasPosibles, sugerenciasDePremio,
  conCambio, negocioConCambios, abiertoEncendido, pideNombre, estadoParaEscena, cuerpoDeGuardar,
} from "./tarjeta";

// ============================================================================
// PASO 1: TU TARJETA
// ----------------------------------------------------------------------------
// Una pregunta por pantalla, como la demo de la web: color, icono, premio, cómo
// se ven los puntos y, al final, lo opcional. Elegir de un toque avanza solo (con
// una pausa para ver el cambio en la tarjeta); lo que se escribe o se desliza lleva
// su botón. La escena es SU tarjeta con lo tocado encima (tarjeta.js): solo se
// guarda lo tocado, y todo junto al final, no pantalla a pantalla.
// Con dos cartillas o de cupón no hay premio ni puntos que elegir aquí: se saltan.
// ============================================================================

const PAUSA_AL_ELEGIR = 280; // ms: lo justo para ver el cambio en la tarjeta antes de seguir

const TEXTOS = {
  color: ["Tu color", "Desliza y mira cómo queda tu tarjeta"],
  icono: ["Tu icono", "Es el dibujo de tus sellos"],
  premio: ["El premio", "Cuántos puntos pide y qué se lleva el cliente"],
  puntos: ["Cómo se ven los puntos", "Toca la que más te guste"],
  extras: ["Lo que puedes añadir", "Se encienden y se apagan cuando quieras"],
};

// Qué encuadra la cámara en cada pantalla.
const PARTES = { color: "todo", icono: "cabecera banda", premio: "banda campos", puntos: "banda", extras: "cabecera banda" };

// Tocar una parte de la tarjeta lleva a la pantalla que la cambia.
const PANTALLA_DE_PARTE = { cabecera: "icono", banda: "puntos", campos: "premio" };

const pantallasDe = (n) => ["color", "icono", ...(tienePremioUnico(n) ? ["premio", "puntos"] : []), "extras"];

export default function PasoTarjeta() {
  const { n, qr, quieto, seguir, guardar, setSub, setAtras } = usePasos();
  const [cambios, setCambios] = useState({});
  const [i, setI] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [ahora, setAhora] = useState(null); // la hora la sabe el navegador, no el servidor
  const escena = useRef(null);
  const espera = useRef(0);

  const ids = useMemo(() => pantallasDe(n), [n]);
  const id = ids[Math.min(i, ids.length - 1)];

  useEffect(() => { setAhora(Date.now()); }, []);
  useEffect(() => () => clearTimeout(espera.current), []);
  useEffect(() => { setSub(i, ids.length); }, [i, ids.length, setSub]);
  useEffect(() => {
    setAtras(() => {
      clearTimeout(espera.current);
      if (i === 0) return false;
      setI(i - 1);
      return true;
    });
    return () => setAtras(null);
  }, [i, setAtras]);

  const cambiar = useCallback((clave, valor) => setCambios((c) => conCambio(c, clave, valor)), []);
  const avanzar = useCallback(() => setI((a) => Math.min(a + 1, ids.length - 1)), [ids.length]);
  const elegir = useCallback((clave, valor) => {
    cambiar(clave, valor);
    escena.current?.latido();
    clearTimeout(espera.current);
    espera.current = setTimeout(avanzar, quieto ? 0 : PAUSA_AL_ELEGIR);
  }, [cambiar, avanzar, quieto]);

  // ---- la escena: su tarjeta con lo tocado encima
  const previo = useMemo(() => negocioConCambios(n, cambios), [n, cambios]);
  const puedeAbierto = tiene(n, "abierto");
  const estado = useMemo(
    () => estadoParaEscena(n, { encendido: puedeAbierto && abiertoEncendido(n, cambios), ejemplo: id === "extras", ahora }),
    [n, cambios, puedeAbierto, id, ahora],
  );
  const armar = useMemo(() => armarTienda(previo, { estado }), [previo, estado]);
  // La llave de la escena: lo que funde una capa en otra. El premio se escribe letra a letra y
  // el pedir nombre no se ve: ninguno hace capa nueva (el premio se pone al día en todas).
  const eleccion = useMemo(() => {
    const { premio: _premio, pedirNombre: _pedir, ...visible } = cambios;
    return { ...visible, linea: Boolean(estado) };
  }, [cambios, estado]);

  const alTocarParte = (parte) => {
    const destino = ids.indexOf(PANTALLA_DE_PARTE[parte]);
    if (destino < 0) return;
    clearTimeout(espera.current);
    setI(destino);
  };

  const enviar = async () => {
    const cuerpo = cuerpoDeGuardar(n, cambios);
    if (!cuerpo) { seguir(); return; }
    setOcupado(true);
    setError(null);
    try {
      await guardar(cuerpo);
      seguir();
    } catch (e) {
      setError(e.message);
      setOcupado(false);
    }
  };

  const principal = {
    color: { texto: "Seguir", onClick: avanzar },
    premio: { texto: "Seguir", onClick: avanzar },
    extras: { texto: "Guardar mi tarjeta", onClick: enviar, ocupado },
  }[id] ?? null;
  const [titulo, pistaDeSiempre] = TEXTOS[id];
  // Con dos cartillas cada una lleva su dibujo en los sellos: aquí solo cambia el de arriba.
  const pista = id === "icono" && !tienePremioUnico(n) ? "El dibujo de arriba de tu tarjeta" : pistaDeSiempre;

  return (
    <>
      <Escenario etiqueta="Vista previa de tu tarjeta">
        <Escena ref={escena} eleccion={eleccion} armar={armar} qr={qr.src} parte={PARTES[id]} alTocarParte={alTocarParte} aria-hidden="true" />
      </Escenario>
      <Panel llave={id} titulo={titulo} pista={pista} principal={principal} error={error}>
        {id === "color" && <PantallaColor n={n} cambios={cambios} cambiar={cambiar} quieto={quieto} />}
        {id === "icono" && <PantallaIcono n={n} previo={previo} cambios={cambios} elegir={elegir} />}
        {id === "premio" && <PantallaPremio n={n} cambios={cambios} cambiar={cambiar} />}
        {id === "puntos" && <PantallaPuntos n={n} previo={previo} cambios={cambios} elegir={elegir} />}
        {id === "extras" && <PantallaExtras n={n} cambios={cambios} cambiar={cambiar} puedeAbierto={puedeAbierto} />}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Las pantallas
// ---------------------------------------------------------------------------

function PantallaColor({ n, cambios, cambiar, quieto }) {
  const actual = paletaDe(n.tema);
  const propio = !cambios.paleta && !actual;
  const montada = useRef(0);
  useEffect(() => { montada.current = Date.now(); }, []);

  // Con un color propio ningún bloque es el suyo: al montar, la fila se coloca en el
  // primero y avisaría de un cambio que nadie ha hecho. Esos primeros instantes no cuentan.
  const alCambiar = (paleta) => {
    if (propio && Date.now() - montada.current < 450) return;
    cambiar("paleta", paleta);
  };

  return (
    <>
      <Colores valor={cambios.paleta ?? actual ?? PALETAS[0].id} alCambiar={alCambiar} quieto={quieto} />
      {propio && <p className="pp-tarjeta-aviso">Ahora usas un color propio. Si eliges uno de aquí, lo cambiarás.</p>}
      {n.tema?.banda !== "foto" && (
        <Grupo titulo="Fondo de la banda">
          <Segmentos opciones={FONDOS} valor={cambios.fondo ?? fondoDe(n.tema)} alCambiar={(f) => cambiar("fondo", f)} />
        </Grupo>
      )}
    </>
  );
}

function PantallaIcono({ n, previo, cambios, elegir }) {
  const actual = iconoDe(n.tema);
  const elegido = cambios.icono ?? actual;
  const fondo = previo.tema.cardBg;
  // Sin logo en el tema: el mosaico enseña el dibujo, no la imagen propia de la tienda.
  const dibujo = (marca) => ({ ...previo.tema, marca, logoImagen: null });
  return (
    <div className="prob-rejilla prob-iconos" role="radiogroup" aria-label="Icono">
      {!actual && (
        <Opcion activa={!cambios.icono} alElegir={() => elegir("icono", undefined)} etiqueta="El tuyo">
          <span className="prob-icono" style={{ background: fondo }}>
            <LogoApple tema={{ ...previo.tema, marca: n.tema.marca, logoImagen: n.tema.logoImagen }} tam={34} />
          </span>
        </Opcion>
      )}
      {ICONOS.map((ic) => (
        <Opcion key={ic.id} activa={elegido === ic.id} alElegir={() => elegir("icono", ic.id)} etiqueta={ic.nombre}>
          <span className="prob-icono" style={{ background: fondo }}>
            <LogoApple tema={dibujo(ic.id)} tam={34} />
          </span>
        </Opcion>
      ))}
    </div>
  );
}

function PantallaPremio({ n, cambios, cambiar }) {
  const premio = cambios.premio ?? n.premio ?? "";
  const metas = metasPosibles(n).map((m) => ({ id: m, nombre: String(m) }));
  const ideas = useMemo(sugerenciasDePremio, []);
  const igual = (a, b) => a.trim().toLowerCase() === b.toLowerCase();
  return (
    <>
      <Grupo titulo="Puntos para el premio">
        <Segmentos opciones={metas} valor={cambios.meta ?? n.meta} alCambiar={(m) => cambiar("meta", m)} />
      </Grupo>
      <div className="pp-tarjeta-campo">
        <label htmlFor="pp-tarjeta-premio" className="exp-etiqueta">Qué se lleva</label>
        <div className="prob-nombre">
          <input
            id="pp-tarjeta-premio" value={premio} maxLength={MAX_PREMIO} autoComplete="off" enterKeyHint="done"
            onChange={(ev) => cambiar("premio", ev.target.value.slice(0, MAX_PREMIO))}
          />
          <span className="prob-cuenta" aria-hidden="true">{premio.length}/{MAX_PREMIO}</span>
        </div>
      </div>
      <div className="pp-tarjeta-chips" role="group" aria-label="Ideas de premio">
        {ideas.map((idea) => (
          <button key={idea} type="button" className="pp-tarjeta-chip" aria-pressed={igual(premio, idea)} onClick={() => cambiar("premio", idea)}>
            {idea}
          </button>
        ))}
      </div>
    </>
  );
}

function PantallaPuntos({ n, previo, cambios, elegir }) {
  // Cada forma, con la banda de verdad de ESTA tienda (sus colores, su icono, su meta).
  const bandas = useMemo(() => Object.fromEntries(MODOS.map((m) => [
    m.id, comoDataUri(stripDelPase(negocioConCambios(n, { ...cambios, modo: m.id }), clienteDeEjemplo(previo)).svg),
  ])), [n, cambios, previo]);
  const elegido = cambios.modo ?? modoDe(n.tema);
  return (
    <div className="prob-rejilla prob-modos" role="radiogroup" aria-label="Cómo se cuentan los puntos">
      {MODOS.map((m) => (
        <Opcion key={m.id} activa={elegido === m.id} alElegir={() => elegir("modo", m.id)} etiqueta={m.nombre}>
          <img src={bandas[m.id]} alt="" className="prob-modo-banda" style={{ background: previo.tema.cardBg }} />
        </Opcion>
      ))}
    </div>
  );
}

function PantallaExtras({ n, cambios, cambiar, puedeAbierto }) {
  return (
    <>
      <div className="pp-tarjeta-filas">
        {puedeAbierto && (
          <Fila
            id="pp-tarjeta-abierto" titulo="«Abierto hasta…» en la tarjeta" activa={abiertoEncendido(n, cambios)}
            texto={n.horario ? "La tarjeta dice si estás abierto y hasta qué hora." : "Sale en cuanto pongas tu horario, dos pasos más allá."}
            alCambiar={(v) => cambiar("abierto", v)}
          />
        )}
        <Fila
          id="pp-tarjeta-nombre" titulo="Pedir el nombre al escanear" activa={pideNombre(n, cambios)}
          texto="Antes de darle la tarjeta, el cliente dice cómo se llama."
          alCambiar={(v) => cambiar("pedirNombre", v)}
        />
      </div>
      <p className="pp-tarjeta-nota">Tu logo, una foto de fondo o un segundo premio los añades luego en Tienda, Editar tarjeta.</p>
    </>
  );
}

// Un interruptor, nunca una casilla: una casilla vacía no se lee como «apagado».
function Fila({ id, titulo, texto, activa, alCambiar }) {
  return (
    <button
      type="button" role="switch" aria-checked={activa} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}
      className="pp-tarjeta-fila" onClick={() => alCambiar(!activa)}
    >
      <span className="pp-tarjeta-fila-texto">
        <strong id={`${id}-t`}>{titulo}</strong>
        <span id={`${id}-d`}>{texto}</span>
      </span>
      <span className="pp-tarjeta-pista" aria-hidden="true"><i /></span>
    </button>
  );
}
