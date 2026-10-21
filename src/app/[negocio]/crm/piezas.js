"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { C, panel, legible, tinte } from "@/app/ui";

// ============================================================================
// PIEZAS DEL PANEL — los trozos que se repiten en el CRM (y en Plantilla)
// ----------------------------------------------------------------------------
// Gráficos dibujados a mano, sin librerías: son unas barras y una rejilla, y
// una dependencia de 200 KB para esto no se paga sola. Los del Resumen están en
// graficas.js; aquí, lo que usan también Actividad y Plantilla.
//
// Todo lo que se pinta sale de lib/crm.js. Ninguna pieza hace cuentas por su
// cuenta: si una cifra sale mal, el sitio donde arreglarla es siempre el mismo,
// y la pantalla y la API nunca pueden discrepar.
//
// NADA SOLO AL PASAR EL RATÓN. El dueño mira esto en el móvil, donde no hay
// ratón: lo que antes iba en un `title` (qué es este 45 %, cuántas visitas tiene
// esta barra) va escrito, o sale en la línea de lectura al tocar (`Lectura`).
// ============================================================================

/** Números como se escriben aquí: «1.234», «4,5». */
export const numero = (x, decimales = 1) => (x ?? 0).toLocaleString("es-ES", { maximumFractionDigits: decimales });

/** «1 visita», «3 visitas». */
export const contar = (n, [uno, varios], decimales = 0) => `${numero(n, decimales)} ${n === 1 ? uno : varios}`;

/**
 * Cifra grande con su etiqueta y, si lo hay, el cambio contra el periodo
 * anterior (`cambio()` de lib/crm.js): en % con base suficiente, en unidades si
 * no. `pie` puede ser una línea o varias.
 */
export function Cifra({ label, valor, pie, cambio, accent, titulo }) {
  const lineas = [pie].flat().filter(Boolean);
  return (
    <div title={titulo} style={{ ...panel, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 8px", marginTop: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 650, color: accent ? legible(accent) : C.texto, lineHeight: 1, letterSpacing: "-0.01em" }}>{valor}</span>
        {cambio && <Cambio {...cambio} />}
      </div>
      {lineas.map((l, i) => (
        <div key={i} style={{ fontSize: 12.5, color: i ? C.tenue : C.suave, marginTop: i ? 2 : 6, lineHeight: 1.35 }}>{l}</div>
      ))}
    </div>
  );
}

/** La flechita: ▲ verde si sube, ▼ roja si baja, con el número (nunca solo el color). */
function Cambio({ pct, unidades }) {
  const n = pct ?? unidades;
  if (!n) return <span style={{ fontSize: 12.5, fontWeight: 600, color: C.tenue }}>igual</span>;
  const sube = n > 0;
  return (
    <span style={{ fontSize: 12.5, fontWeight: 650, color: sube ? C.ok : C.mal, whiteSpace: "nowrap" }}>
      {pct !== undefined ? `${sube ? "▲" : "▼"} ${Math.abs(n)}%` : `${sube ? "+" : "−"}${Math.abs(n)}`}
    </span>
  );
}

/**
 * Un bloque del Resumen: la pregunta pequeña, la respuesta grande (el titular,
 * una frase con su cifra) y debajo la gráfica que lo demuestra. Así la gráfica
 * no necesita explicación: ya se ha dicho qué hay que ver en ella.
 */
export function Tarjeta({ id, pregunta, titular, detalle, children, pie }) {
  return (
    <section aria-labelledby={id} style={{ ...panel, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <h2 id={id} style={{ fontSize: 13, fontWeight: 600, color: C.suave, margin: 0 }}>{pregunta}</h2>
      {titular && <p style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.35, margin: "6px 0 0", letterSpacing: "-0.005em" }}>{titular}</p>}
      {detalle && <p style={{ fontSize: 13.5, color: C.suave, lineHeight: 1.45, margin: "4px 0 0" }}>{detalle}</p>}
      <div style={{ marginTop: 16, flex: 1 }}>{children}</div>
      {pie}
    </section>
  );
}

/**
 * La línea de encima de una gráfica que dice el dato que se toca o se señala
 * (con el ratón, el dedo o las flechas del teclado). Sin nada señalado dice el
 * de partida: nunca está vacía, y no salta de alto al cambiar.
 */
export function Lectura({ children }) {
  return (
    <p aria-live="polite" style={{ fontSize: 13, color: C.suave, margin: "0 0 10px", minHeight: "1.4em", lineHeight: 1.4, fontVariantNumeric: "tabular-nums" }}>
      {children}
    </p>
  );
}

/**
 * Qué dato de una gráfica se está señalando. Con el puntero (ratón o dedo) se
 * elige por la posición en horizontal, sin tener que acertar en una barra de
 * 6 px; con el teclado, las flechas. Al salir el ratón vuelve al de partida.
 * `aIndice(x)` pasa de 0..1 (la fracción del ancho) al índice.
 */
export function usePuntero(cuantos, aIndice = (x) => Math.floor(x * cuantos)) {
  const [i, setI] = useState(null);
  const desde = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    setI(Math.max(0, Math.min(cuantos - 1, aIndice((e.clientX - r.left) / r.width))));
  };
  return {
    i,
    props: {
      tabIndex: 0,
      className: "grafica", // con Tab se ve el anillo de siempre (el :focus-visible del layout)
      onPointerMove: desde,
      onPointerDown: desde,
      onPointerLeave: (e) => { if (e.pointerType === "mouse") setI(null); },
      onBlur: () => setI(null),
      onKeyDown: (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const paso = e.key === "ArrowLeft" ? -1 : 1;
        setI((x) => Math.max(0, Math.min(cuantos - 1, (x ?? (paso > 0 ? -1 : cuantos)) + paso)));
      },
      style: { touchAction: "pan-y" },
    },
  };
}

/** Cuadraditos (o rayas) de color con su nombre, debajo de un gráfico. */
export function Leyenda({ colores }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 10, fontSize: 12.5, color: C.suave }}>
      {colores.map(([color, texto]) => (
        <span key={texto} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block", flexShrink: 0 }} />
          {texto}
        </span>
      ))}
    </div>
  );
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_PLURAL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados", "Domingos"];
const franja = (h) => `de ${h} a ${h + 1}`;

/**
 * Cuándo viene la gente: día de la semana × hora, del color de la tienda más
 * intenso cuanto más gente (un solo tono: más oscuro = más). Las horas son las
 * que abre la tienda (`horas`, del horario) más cualquiera con algo; un día que
 * cierra lo dice en su fila en vez de enseñar siete casillas vacías.
 *
 * Los valores pueden ser medias (el Resumen: lo de un día normal) o cuentas
 * (Plantilla): `unidad` y `media` dicen cómo leerlos. Arriba, la lectura: la
 * casilla que se toca o, si no, la más fuerte.
 */
export function Rejilla({ rejilla, accent, horas: abiertas = null, cerrados = [], abierta = null, unidad = ["visita", "visitas"], media = false }) {
  const [sel, setSel] = useState(null);
  const max = Math.max(0, ...rejilla.flat());
  const conAlgo = Array.from({ length: 24 }, (_, h) => h).filter((h) => rejilla.some((fila) => fila[h] > 0));
  if (!conAlgo.length) return <p style={{ color: C.suave, fontSize: 13, margin: 0 }}>Todavía no hay visitas que situar en el reloj.</p>;

  const desde = Math.min(...conAlgo, ...(abiertas ? [abiertas[0]] : []));
  const hasta = Math.max(...conAlgo, ...(abiertas ? [abiertas[1] - 1] : []));
  const rango = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

  let pico = [0, desde];
  rejilla.forEach((fila, d) => rango.forEach((h) => { if (fila[h] > rejilla[pico[0]][pico[1]]) pico = [d, h]; }));
  const valor = (n) => (media ? `${contar(n, unidad, 1)} de media` : contar(n, unidad));
  const [d, h] = sel || pico;
  const lectura = sel
    ? `${DIAS_PLURAL[d]} ${franja(h)}: ${abierta && !abierta[d][h] && !(rejilla[d][h] > 0) ? "cerrado" : valor(rejilla[d][h])}`
    : `La hora punta: ${DIAS_PLURAL[d].toLowerCase()} ${franja(h)}, ${valor(rejilla[d][h])}`;

  // Cinco escalones del color de la tienda: se distinguen a simple vista y la
  // leyenda los puede enseñar (un degradado continuo no se lee).
  // Una hora abierta sin nadie lleva su casilla (perfilada: «no vino nadie»);
  // una hora cerrada, nada.
  const escalon = (n) => (n <= 0 ? 0 : Math.min(5, Math.ceil((n / (max || 1)) * 5)));
  const color = legible(accent); // de noche, aclarado: si no, «más» se pierde en el fondo
  const fondo = (n) => (n <= 0 ? C.panelSuave : tinte(color, [0, 18, 34, 52, 72, 92][escalon(n)]));
  const cerrada = (dia, hora) => abierta && !abierta[dia][hora] && !(rejilla[dia][hora] > 0);
  const mover = (dd, dh) => {
    const [y, x] = sel || pico;
    setSel([Math.max(0, Math.min(6, y + dd)), Math.max(desde, Math.min(hasta, x + dh))]);
  };

  const columnas = `22px repeat(${rango.length}, minmax(0, 1fr))`;
  return (
    <div>
      <Lectura>{lectura}</Lectura>
      <div
        role="grid"
        aria-label="Visitas por día de la semana y hora"
        tabIndex={0}
        className="grafica"
        onKeyDown={(e) => {
          const flechas = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
          if (!flechas[e.key]) return;
          e.preventDefault();
          mover(...flechas[e.key]);
        }}
        onBlur={() => setSel(null)}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setSel(null); }}
        style={{ display: "grid", gridTemplateColumns: columnas, gap: 2, touchAction: "pan-y" }}
      >
        {rejilla.map((fila, dia) => (
          <div key={dia} role="row" style={{ display: "contents" }}>
            <span role="rowheader" aria-label={DIAS_PLURAL[dia]} style={etiquetaDia}>{DIAS[dia]}</span>
            {cerrados.includes(dia) && !fila.some((n) => n > 0) ? (
              <span style={{ gridColumn: `2 / span ${rango.length}`, fontSize: 11.5, color: C.tenue, alignSelf: "center", paddingLeft: 4 }}>cerrado</span>
            ) : rango.map((hora) => {
              const marcada = sel && sel[0] === dia && sel[1] === hora;
              const fuera = cerrada(dia, hora);
              return (
                <span
                  key={hora}
                  role="gridcell"
                  aria-label={`${DIAS_PLURAL[dia]} ${franja(hora)}: ${fuera ? "cerrado" : valor(fila[hora])}`}
                  onPointerEnter={() => setSel(fuera ? null : [dia, hora])}
                  onPointerDown={() => setSel(fuera ? null : [dia, hora])}
                  style={{
                    height: 20, borderRadius: 4, boxSizing: "border-box",
                    background: fuera ? "transparent" : fondo(fila[hora]),
                    border: !fuera && !(fila[hora] > 0) ? `1px solid ${C.borde}` : "none",
                    boxShadow: marcada ? `0 0 0 2px ${C.texto}` : "none",
                  }}
                />
              );
            })}
          </div>
        ))}
        <span />
        {rango.map((hora) => (
          <span key={hora} style={{ fontSize: 10.5, color: C.tenue, textAlign: "center", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
            {hora % 2 === 0 ? hora : ""}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: C.suave }}>
        <span>Menos</span>
        {[1, 2, 3, 4, 5].map((e) => <span key={e} style={{ width: 14, height: 10, borderRadius: 3, background: tinte(color, [0, 18, 34, 52, 72, 92][e]) }} />)}
        <span>Más</span>
      </div>
    </div>
  );
}

const etiquetaDia = { fontSize: 11, color: C.tenue, fontWeight: 650, alignSelf: "center" };

/** Etiqueta de estado para las filas de la tabla. */
export function Chip({ estado, estados }) {
  const e = estados.find((x) => x.key === estado);
  if (!e) return null;
  return (
    <span
      title={e.descripcion}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 7,
        background: `${e.color}18`, color: legible(e.color), fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <Icono nombre={e.icon} tam={13} grosor={2.2} /> {e.label}
    </span>
  );
}
