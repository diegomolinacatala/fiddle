"use client";

import { DIAS_CORTOS } from "@/lib/horario";
import { C } from "@/app/ui";

// ============================================================================
// GRÁFICAS DE LA PLANTILLA — SVG a mano, como las del CRM (crm/piezas.js)
// ----------------------------------------------------------------------------
// Cada persona tiene su color (lib/plantilla.js, colorDe) y aquí solo se pinta:
// las cuentas vienen hechas de cuentasDePlantilla / serieDiaria.
// ============================================================================

/** Barras horizontales, una por persona: nombre, barra y cifra. */
export function BarrasPorPersona({ filas, valor = (f) => f.sellos, colorDe, formato = (v) => v }) {
  const max = Math.max(1, ...filas.map(valor));
  if (!filas.length) return <p style={vacio}>Todavía no hay movimientos en este periodo.</p>;
  return (
    <div style={{ display: "grid", gap: 9 }}>
      {filas.map((f) => (
        <div key={f.clave} style={{ display: "grid", gridTemplateColumns: "minmax(70px, 120px) 1fr auto", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: f.persona ? C.texto : C.tenue }}>{f.nombre}</span>
          <div style={{ height: 12, background: C.borde, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${(valor(f) / max) * 100}%`, height: "100%", background: colorDe(f.clave), minWidth: valor(f) ? 3 : 0, borderRadius: 6 }} />
          </div>
          <strong style={{ fontVariantNumeric: "tabular-nums", fontWeight: 650 }}>{formato(valor(f))}</strong>
        </div>
      ))}
    </div>
  );
}

const dia = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

/** Sellos por día, apilados por persona: quién selló cada día. */
export function SerieApilada({ serie, claves, colorDe, nombreDe, alto = 120 }) {
  const max = Math.max(1, ...serie.map((d) => d.total));
  const ancho = 100 / Math.max(1, serie.length);
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: alto, display: "block" }}>
        {serie.map((d, i) => {
          let y = 40;
          return claves.map((k) => {
            const n = d.por[k] || 0;
            if (!n) return null;
            const h = (n / max) * 38;
            y -= h;
            return (
              <rect key={k} x={i * ancho + ancho * 0.15} y={y} width={ancho * 0.7} height={h} fill={colorDe(k)} opacity={0.9}>
                <title>{`${dia(d.dia)}: ${nombreDe(k)}, ${n} ${n === 1 ? "sello" : "sellos"}`}</title>
              </rect>
            );
          });
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.tenue, marginTop: 4 }}>
        <span>{serie.length ? dia(serie[0].dia) : ""}</span>
        <span>máx. {max}/día</span>
        <span>{serie.length ? dia(serie.at(-1).dia) : ""}</span>
      </div>
      <Leyenda claves={claves} colorDe={colorDe} nombreDe={nombreDe} />
    </div>
  );
}

export function Leyenda({ claves, colorDe, nombreDe }) {
  if (!claves.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
      {claves.map((k) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.suave }}>
          <Punto color={colorDe(k)} /> {nombreDe(k)}
        </span>
      ))}
    </div>
  );
}

export const Punto = ({ color }) => <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: color, display: "inline-block", flexShrink: 0 }} />;

/**
 * Quién cubre cada hora de la semana: la casilla, del color de quien más
 * movimientos hizo a esa hora de ese día; más oscura cuanto más movimiento.
 * Solo las horas con algo, como la rejilla del CRM.
 */
export function RejillaEquipo({ filas, colorDe }) {
  const total = (d, h) => filas.reduce((a, f) => a + f.rejilla[d][h], 0);
  const horas = Array.from({ length: 24 }, (_, h) => h).filter((h) => filas.some((f) => f.rejilla.some((fila) => fila[h] > 0)));
  if (!horas.length) return <p style={vacio}>Todavía no hay movimientos que situar en el reloj.</p>;
  const desde = Math.min(...horas);
  const hasta = Math.max(...horas);
  const rango = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  let max = 1;
  for (let d = 0; d < 7; d += 1) for (const h of rango) max = Math.max(max, total(d, h));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderSpacing: 2, borderCollapse: "separate" }}>
        <tbody>
          {Array.from({ length: 7 }, (_, d) => (
            <tr key={d}>
              <td style={{ fontSize: 11, color: C.tenue, paddingRight: 4, fontWeight: 600 }}>{DIAS_CORTOS[d]}</td>
              {rango.map((h) => {
                const n = total(d, h);
                const quien = n ? [...filas].sort((a, b) => b.rejilla[d][h] - a.rejilla[d][h])[0] : null;
                return (
                  <td
                    key={h}
                    title={n ? `${DIAS_CORTOS[d]} ${String(h).padStart(2, "0")}:00: ${quien.nombre}, ${quien.rejilla[d][h]} de ${n}` : undefined}
                    style={{
                      width: 15, height: 15, borderRadius: 3,
                      background: n ? colorDe(quien.clave) : C.borde,
                      opacity: n ? 0.3 + 0.7 * (n / max) : 0.5,
                    }}
                  />
                );
              })}
            </tr>
          ))}
          <tr>
            <td />
            {rango.map((h) => (
              <td key={h} style={{ fontSize: 9, color: C.tenue, textAlign: "center" }}>{h % 3 === 0 ? h : ""}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const vacio = { color: C.suave, fontSize: 13, margin: 0 };
