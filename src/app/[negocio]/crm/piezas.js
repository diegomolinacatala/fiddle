"use client";

import Icono from "@/app/Icono";
import { C, panel, legible, tinte } from "@/app/ui";
import { textoFalta } from "@/lib/observaciones";

// ============================================================================
// PIEZAS DEL PANEL — los trozos que se repiten en el CRM
// ----------------------------------------------------------------------------
// Gráficos dibujados a mano con SVG, sin librerías: son cuatro barras y una
// rejilla, y una dependencia de 200 KB para esto no se paga sola.
//
// Todo lo que se pinta aquí sale de lib/crm.js. Ninguna pieza hace cuentas por
// su cuenta: si una cifra sale mal, el sitio donde arreglarla es siempre el
// mismo, y la pantalla y la API nunca pueden discrepar.
// ============================================================================

/**
 * Cifra grande con su etiqueta y, si lo hay, el cambio contra el mes anterior
 * (`cambio()` de lib/crm.js): en % con base suficiente, en unidades si no.
 */
export function Cifra({ label, valor, pie, cambio, accent, titulo }) {
  return (
    <div title={titulo} style={{ ...panel, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 650, color: accent ? legible(accent) : C.texto, lineHeight: 1 }}>{valor}</span>
        {cambio && <Cambio {...cambio} />}
      </div>
      {pie && <div style={{ fontSize: 12, color: C.suave, marginTop: 5 }}>{pie}</div>}
    </div>
  );
}

function Cambio({ pct, unidades }) {
  const n = pct ?? unidades;
  if (!n) return <span style={{ fontSize: 12, fontWeight: 600, color: C.tenue }}>igual</span>;
  const sube = n > 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: sube ? C.ok : C.mal }}>
      {pct !== undefined ? `${sube ? "▲" : "▼"} ${Math.abs(n)}%` : `${sube ? "+" : "−"}${Math.abs(n)}`}
    </span>
  );
}

/**
 * Visitas por día. Barras simples; el eje no lleva números porque la altura ya
 * se compara sola y lo que importa es la forma: si sube, si cae, si hay un día
 * muerto. El detalle exacto va en el `title` de cada barra. Un día que la
 * tienda cerró (`cerrado`, del horario) lleva una raya gris en la base: un cero
 * de un domingo cerrado no es un domingo malo.
 */
export function Barras({ serie, accent, alto = 110 }) {
  const max = Math.max(1, ...serie.map((d) => d.n));
  const ancho = 100 / Math.max(serie.length, 1);
  const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const hayCerrados = serie.some((d) => d.cerrado && !d.n);

  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: alto, display: "block" }}>
        {serie.map((d, i) => (d.cerrado && !d.n ? (
          <rect key={d.dia} x={i * ancho + ancho * 0.15} y={38.6} width={ancho * 0.7} height={1.4} style={{ fill: C.bordeFuerte }}>
            <title>{`${dia(d.dia)}: cerrado`}</title>
          </rect>
        ) : (
          <rect
            key={d.dia}
            x={i * ancho + ancho * 0.15}
            y={40 - (d.n / max) * 38}
            width={ancho * 0.7}
            height={Math.max(d.n ? 0.8 : 0, (d.n / max) * 38)}
            fill={accent}
            opacity={d.n ? 0.85 : 0}
            rx={0.4}
          >
            <title>{`${dia(d.dia)}: ${d.n} visita${d.n === 1 ? "" : "s"}`}</title>
          </rect>
        )))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.tenue, marginTop: 4 }}>
        <span>{serie.length ? dia(serie[0].dia) : ""}</span>
        <span>máx. {max}/día</span>
        <span>{serie.length ? dia(serie.at(-1).dia) : ""}</span>
      </div>
      {hayCerrados && <Leyenda colores={[[C.bordeFuerte, "Cerrado"]]} />}
    </div>
  );
}

/** Cuadraditos de color con su nombre, debajo de un gráfico. */
function Leyenda({ colores }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8, fontSize: 12, color: C.suave }}>
      {colores.map(([color, texto]) => (
        <span key={texto} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: color, display: "inline-block" }} />
          {texto}
        </span>
      ))}
    </div>
  );
}

/**
 * El camino de la tarjeta (`embudo()` de lib/crm.js): una barra por escalón,
 * medida contra el primero, y qué parte del escalón de arriba llega. El nombre
 * va encima de la barra, no al lado: en el móvil, al lado, la barra no medía nada.
 */
export function Embudo({ pasos, accent }) {
  const primero = pasos[0]?.n || 0;
  if (!primero) return <p style={{ color: C.suave, fontSize: 13, margin: 0 }}>Todavía no se ha sacado ninguna tarjeta.</p>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {pasos.map((p, i) => (
        <div key={p.key} title={i ? `${p.n} de los ${pasos[i - 1].n} del paso anterior (${p.paso}%)` : `${p.n} tarjetas en total`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 13 }}>
            <span style={{ color: C.suave }}>{p.label}</span>
            <span style={{ whiteSpace: "nowrap" }}>
              <strong style={{ fontWeight: 650 }}>{p.n}</strong>
              {p.paso !== null && <span style={{ color: C.tenue, fontSize: 12 }}> {p.paso}%</span>}
            </span>
          </div>
          <div style={{ height: 10, background: C.borde, borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
            <div style={{ width: `${(p.n / primero) * 100}%`, minWidth: p.n ? 3 : 0, height: "100%", background: accent, opacity: 0.85 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dónde se queda una cartilla (`repartoCartillas()` de lib/crm.js): una columna
 * por número de sellos; abajo, en naranja, los que se están alejando; encima, en
 * verde, los que siguen viniendo (los colores del reparto por estado).
 */
export function Cartilla({ c, conNombre }) {
  const max = Math.max(1, ...c.filas.map((f) => f.siguen + f.alejan));
  const hay = c.filas.some((f) => f.siguen + f.alejan);
  // Como mucho unas ocho etiquetas, y ninguna pegada a «llena».
  const salto = Math.ceil(c.meta / 8);
  const etiqueta = (s) => (s === c.meta ? "llena" : salto > 1 && (s % salto || s > c.meta - salto) ? "" : s);
  return (
    <div style={{ minWidth: 0 }}>
      {conNombre && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{c.nombre}</div>}
      {!hay ? (
        <p style={{ color: C.suave, fontSize: 13, margin: 0 }}>Aún nadie tiene sellos en esta cartilla.</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
            {c.filas.map((f) => (
              <div key={f.sellos}
                title={`${f.sellos === c.meta ? "Llena" : `${f.sellos} sello${f.sellos === 1 ? "" : "s"}`}: ${f.siguen} siguen viniendo, ${f.alejan} se están alejando`}
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ height: `${(f.siguen / max) * 100}%`, background: C.ok, borderRadius: f.alejan ? "3px 3px 0 0" : 3 }} />
                <div style={{ height: `${(f.alejan / max) * 100}%`, background: C.ojo, borderRadius: f.siguen ? "0 0 3px 3px" : 3 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 4, fontSize: 11, color: C.tenue }}>
            {c.filas.map((f) => (
              <span key={f.sellos} style={{ flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap" }}>
                {etiqueta(f.sellos)}
              </span>
            ))}
          </div>
        </>
      )}
      {c.alejanMediana !== null && (
        <p style={{ fontSize: 13, margin: "10px 0 0" }}>
          La mitad de los que se están alejando se quedó en {c.alejanMediana} sello{c.alejanMediana === 1 ? "" : "s"} o menos, de {c.meta}.
        </p>
      )}
      {c.enCero > 0 && (
        <p style={{ fontSize: 12, color: C.tenue, margin: "6px 0 0" }}>
          Aparte, {c.enCero} con la cartilla a cero: empiezan o acaban de canjear.
        </p>
      )}
    </div>
  );
}

export const LeyendaCartilla = () => <Leyenda colores={[[C.ok, "Siguen viniendo"], [C.ojo, "Se están alejando"]]} />;

/** En vez de un gráfico que aún no dice nada: qué le falta. */
export function AunNo({ children }) {
  return (
    <div>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Aún no hay datos suficientes</p>
      <p style={{ fontSize: 13, color: C.suave, margin: 0 }}>{children}</p>
    </div>
  );
}

/**
 * De dónde salen los activos de hoy (`puenteActivos()` de lib/crm.js): los dos
 * totales desde cero, en el color de la tienda, y entre medias cada cambio
 * flotando donde lo deja el anterior: en verde lo que suma, en naranja lo que
 * resta (los colores de la cartilla). En horizontal y con el nombre encima, como
 * el camino de la tarjeta: cinco columnas con su nombre debajo no caben en un móvil.
 */
export function Puente({ p, accent }) {
  const max = Math.max(1, ...p.pasos.map((x) => x.hasta));
  const color = (x) => (x.signo > 0 ? C.ok : x.signo < 0 ? C.ojo : accent);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {p.pasos.map((x) => (
        <div key={x.key} title={x.descripcion}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 13 }}>
            <span style={{ color: x.signo ? C.suave : C.texto, fontWeight: x.signo ? 400 : 600 }}>{x.label}</span>
            <strong style={{ fontWeight: 650, whiteSpace: "nowrap" }}>{x.signo > 0 ? "+" : x.signo < 0 ? "−" : ""}{x.n}</strong>
          </div>
          <div style={{ position: "relative", height: 10, background: C.panelSuave, borderRadius: 4, marginTop: 4 }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, borderRadius: 4,
              left: `${(x.desde / max) * 100}%`, width: `${((x.hasta - x.desde) / max) * 100}%`, minWidth: x.n ? 3 : 0,
              background: color(x), opacity: x.signo ? 1 : 0.85,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// El brillo de un #rrggbb (0 a 255), con los pesos de tintaClara (app/ui.js).
const brillo = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(String(hex).slice(i, i + 2), 16));
  return [r, g, b].some(Number.isNaN) ? 80 : 0.299 * r + 0.587 * g + 0.114 * b;
};

/**
 * Cohortes a la misma edad (`cohortes()` de lib/crm.js): una fila por semana (o
 * mes) de alta y una columna por semana desde el alta, con la cifra dentro y el
 * color de la tienda más intenso cuanto más vinieron. Lo que aún no ha vivido
 * toda la fila va vacío: la escalera de la derecha es el tiempo, no clientes
 * que se fueron.
 *
 * La cifra va en blanco solo cuando el fondo es oscuro de día; de noche el fondo
 * siempre lo es y el texto de la app ya es claro.
 */
export function Triangulo({ co, accent }) {
  const fuerza = (pct) => 8 + 0.92 * pct; // % del color: un 0 se ve, pero apenas
  const oscuro = (pct) => (fuerza(pct) / 100) * brillo(accent) + (1 - fuerza(pct) / 100) * 255 < 120;
  const esteAno = new Date().getFullYear();
  const nombre = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    if (co.unidad === "semana") return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return d.toLocaleDateString("es-ES", d.getFullYear() === esteAno ? { month: "long" } : { month: "short", year: "numeric" });
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={cabecera} />
            <th colSpan={co.semanas} style={{ ...cabecera, textAlign: "left", paddingLeft: 2 }}>Semana desde el alta</th>
          </tr>
          <tr>
            <th style={cabecera} />
            {Array.from({ length: co.semanas }, (_, i) => <th key={i} style={cabecera}>{i + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {co.filas.map((f) => (
            <tr key={f.desde}>
              <td style={{ paddingRight: 8, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, textTransform: co.unidad === "mes" ? "capitalize" : "none" }}>{nombre(f.desde)}</div>
                <div style={{ fontSize: 11, color: C.tenue }}>{f.altas} alta{f.altas === 1 ? "" : "s"}</div>
              </td>
              {f.celdas.map((c, i) => (c ? (
                <td key={i} title={`Semana ${i + 1}: vinieron ${c.n} de ${f.altas}`} style={{
                  ...celda, background: tinte(accent, fuerza(c.pct)), color: oscuro(c.pct) ? "#fff" : C.texto,
                }}>
                  {c.pct}
                </td>
              ) : <td key={i} style={celda} />))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cabecera = { fontSize: 11, fontWeight: 600, color: C.tenue, textAlign: "center", padding: "0 0 2px", whiteSpace: "nowrap" };
const celda = { minWidth: 34, height: 30, borderRadius: 5, textAlign: "center", verticalAlign: "middle", fontWeight: 600, fontVariantNumeric: "tabular-nums" };

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Cuándo viene la gente: día de la semana × hora, en intensidad de color.
 * Solo se pintan las horas con actividad (un café no abre a las 4 de la mañana
 * y 24 columnas de nada solo aplastan las que importan).
 */
export function Rejilla({ rejilla, accent }) {
  const max = Math.max(1, ...rejilla.flat());
  const horas = Array.from({ length: 24 }, (_, h) => h).filter((h) => rejilla.some((fila) => fila[h] > 0));
  if (!horas.length) return <p style={{ color: C.suave, fontSize: 13 }}>Todavía no hay visitas que situar en el reloj.</p>;

  const desde = Math.min(...horas);
  const hasta = Math.max(...horas);
  const rango = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderSpacing: 2, borderCollapse: "separate" }}>
        <tbody>
          {rejilla.map((fila, d) => (
            <tr key={d}>
              <td style={{ fontSize: 11, color: C.tenue, paddingRight: 4, fontWeight: 600 }}>{DIAS[d]}</td>
              {rango.map((h) => (
                <td
                  key={h}
                  title={`${DIAS[d]} ${String(h).padStart(2, "0")}:00 · ${fila[h]} visita${fila[h] === 1 ? "" : "s"}`}
                  style={{
                    width: 15, height: 15, borderRadius: 3,
                    background: fila[h] ? accent : C.borde,
                    opacity: fila[h] ? 0.25 + 0.75 * (fila[h] / max) : 0.5,
                  }}
                />
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {rango.map((h) => (
              <td key={h} style={{ fontSize: 9, color: C.tenue, textAlign: "center" }}>
                {h % 3 === 0 ? h : ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * En vez de la rejilla mientras no hay con qué (lib/observaciones.js, `suficiencia`):
 * la semana, con los días que ya se han visto llenos y los que faltan vacíos. Así
 * se ve que se va llenando, no un "vuelve más tarde".
 */
export function FaltanDatos({ s, accent }) {
  const estado = (x) => (!x.abre ? "cerrado" : x.listo ? "listo" : x.fechas ? "a medias" : "sin ver");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {s.dias.map((x) => (
          <span key={x.d} title={`${DIAS[x.d]}: ${estado(x)}`} style={{
            width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 650,
            background: !x.abre ? "transparent" : x.listo || x.fechas ? accent : C.borde,
            opacity: x.abre && !x.listo && x.fechas ? 0.4 : 1,
            color: x.abre && (x.listo || x.fechas) ? "#fff" : C.tenue,
            border: x.abre ? "none" : `1px dashed ${C.bordeFuerte}`,
          }}>
            {DIAS[x.d]}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "12px 0 4px" }}>Aún no hay datos suficientes</p>
      <p style={{ fontSize: 13, color: C.suave, margin: 0 }}>
        {textoFalta(s)} Con una semana suelta, un día raro parecería la costumbre de la tienda.
      </p>
    </div>
  );
}

/** Reparto por estado, en una sola barra apilada. Al lado, la leyenda con cifras. */
export function Reparto({ porEstado, estados, total }) {
  if (!total) return null;
  const trozos = estados.filter((e) => porEstado[e.key] > 0);
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: C.borde }}>
        {trozos.map((e) => (
          <div
            key={e.key}
            title={`${e.label}: ${porEstado[e.key]}`}
            style={{ width: `${(porEstado[e.key] / total) * 100}%`, background: e.color }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12 }}>
        {estados.map((e) => (
          <span key={e.key} title={e.descripcion} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: e.color, display: "inline-block" }} />
            <span style={{ color: C.suave }}>{e.label}</span>
            <strong style={{ fontWeight: 650 }}>{porEstado[e.key]}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

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
