"use client";

import { C, panel } from "@/app/ui";

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

/** Cifra grande con su etiqueta y, si la hay, la variación contra el mes anterior. */
export function Cifra({ label, valor, pie, variacion, accent }) {
  const sube = variacion > 0;
  return (
    <div style={{ ...panel, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 650, color: accent || C.texto, lineHeight: 1 }}>{valor}</span>
        {variacion !== null && variacion !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 600, color: sube ? C.ok : C.mal }}>
            {sube ? "▲" : "▼"} {Math.abs(variacion)}%
          </span>
        )}
      </div>
      {pie && <div style={{ fontSize: 12, color: C.suave, marginTop: 5 }}>{pie}</div>}
    </div>
  );
}

/**
 * Visitas por día. Barras simples; el eje no lleva números porque la altura ya
 * se compara sola y lo que importa es la forma: si sube, si cae, si hay un día
 * muerto. El detalle exacto va en el `title` de cada barra.
 */
export function Barras({ serie, accent, alto = 110 }) {
  const max = Math.max(1, ...serie.map((d) => d.n));
  const ancho = 100 / Math.max(serie.length, 1);
  const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: alto, display: "block" }}>
        {serie.map((d, i) => (
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
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.tenue, marginTop: 4 }}>
        <span>{serie.length ? dia(serie[0].dia) : ""}</span>
        <span>máx. {max}/día</span>
        <span>{serie.length ? dia(serie.at(-1).dia) : ""}</span>
      </div>
    </div>
  );
}

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
        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20,
        background: `${e.color}18`, color: e.color, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      {e.icon} {e.label}
    </span>
  );
}
