"use client";

import Icono from "@/app/Icono";
import { C, panel, legible } from "@/app/ui";
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
