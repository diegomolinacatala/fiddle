"use client";

import { C, tinte, legible } from "@/app/ui";
import { ESTADOS } from "@/lib/crm";
import { Lectura, Leyenda, usePuntero, contar, numero } from "./piezas";

// ============================================================================
// LAS GRÁFICAS DEL RESUMEN
// ----------------------------------------------------------------------------
// Cada una contesta UNA pregunta y va dentro de su Tarjeta, que ya la ha dicho
// en una frase. Reglas de todas (las de la skill dataviz, adaptadas):
//   - Marcas finas y de un solo color salvo que el color SIGNIFIQUE algo (los
//     estados, lo que sigue y lo que se va); el texto nunca va en el color de
//     la serie, va en los de la app.
//   - Los porcentajes dicen de qué son («62 % de los que la estrenaron»), sin
//     pasar el ratón.
//   - Lo que no se puede escribir sin llenarlo todo de números sale en la
//     línea de lectura al tocar (usePuntero), con el teclado también.
//   - En HTML, no en SVG escalado: las letras no crecen con el ancho de la
//     tarjeta y las barras no se deforman. El SVG solo para la línea de la
//     curva, con trazo que no se estira.
//   - El color de la tienda, con `legible`: de día es el mismo y de noche se
//     aclara, que un marrón sobre el fondo oscuro no se ve.
// ============================================================================

const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const fechaLarga = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.toLocaleDateString("es-ES", { weekday: "long" })} ${d.getDate()} de ${d.toLocaleDateString("es-ES", { month: "long" })}`;
};
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --------------------------------------------------------------- el camino
/**
 * El camino de la tarjeta (`embudo()` de lib/crm.js): una barra por escalón,
 * medida contra el primero, y debajo qué parte del escalón de arriba llega, con
 * sus palabras. El nombre va encima de la barra: al lado, en el móvil, la barra
 * no medía nada.
 */
export function Embudo({ pasos, accent }) {
  const primero = pasos[0]?.n || 0;
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
      {pasos.map((p, i) => (
        <li key={p.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 14 }}>
            <span>{p.label}</span>
            <strong style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{numero(p.n)}</strong>
          </div>
          <div style={{ height: 10, background: C.panelSuave, borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
            <div style={{ width: `${primero ? (p.n / primero) * 100 : 0}%`, minWidth: p.n ? 4 : 0, height: "100%", background: legible(accent), borderRadius: 4 }} />
          </div>
          {i > 0 && (
            <div style={{ fontSize: 12.5, color: C.suave, marginTop: 4 }}>
              {p.paso}% de los que {pasos[i - 1].de}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

// --------------------------------------------------------------- la curva
const SEMANAS_EJE = [[0, "Estreno"], [7, "1 sem"], [14, "2 sem"], [21, "3 sem"], [28, "4 sem"]];

/**
 * ¿Cuánto tardan en volver? (`curvaDeVuelta()` de lib/crm.js). El eje va
 * siempre de su estreno a las cuatro semanas: lo que aún no se puede ver queda
 * en gris y lo dice, en vez de estirar dos semanas a todo el ancho y que la
 * misma gráfica cambie de escala cada día. Las semanas llevan su cifra escrita.
 */
export function CurvaVuelta({ v, accent: tienda, dias = 28 }) {
  const accent = legible(tienda);
  const hasta = v.puntos.at(-1).dia;
  const { i, props } = usePuntero(hasta + 1, (x) => Math.round(x * dias));
  const p = v.puntos[Math.min(i ?? hasta, hasta)];
  const cuando = (d) => (d === 0 ? "El mismo día" : d === 1 ? "Al día siguiente" : `A los ${d} días`);
  const x = (d) => (d / dias) * 100;
  const linea = v.puntos.map((q) => `${x(q.dia)},${100 - q.pct}`).join(" ");
  const hitos = SEMANAS_EJE.filter(([d]) => d > 0 && d <= hasta);

  return (
    // Crece con la tarjeta (al lado del camino de la tarjeta, que es más alto) sin pasar de un tope.
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Lectura>
        {cuando(p.dia)} ha vuelto el <strong style={{ color: C.texto }}>{p.pct}%</strong>
        {" "}(de {p.seguidos} que la estrenaron hace {p.dia === 0 ? "un día" : `${p.dia} días`} o más)
      </Lectura>
      <div style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", gridTemplateRows: "minmax(150px, 1fr) auto", gap: 6, marginTop: 18, flex: 1, maxHeight: 360 }}>
        <div style={{ position: "relative" }} aria-hidden>
          {[100, 50, 0].map((y) => (
            <span key={y} style={{ position: "absolute", right: 0, top: `${100 - y}%`, transform: "translateY(-50%)", fontSize: 11, color: C.tenue, fontVariantNumeric: "tabular-nums" }}>{y}%</span>
          ))}
        </div>
        <div {...props} role="img" aria-label={`Han vuelto: ${hitos.map(([d, n]) => `${n === "1 sem" ? "a la semana" : `a las ${n.replace(" sem", " semanas")}`} el ${v.puntos[d].pct}%`).join(", ")}`}
          style={{ ...props.style, position: "relative" }}>
          {/* Lo que aún no se puede ver: la tarjeta de los que la estrenaron hace tan poco. */}
          {hasta < dias && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x(hasta)}%`, right: 0, background: C.panelSuave, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11.5, color: C.tenue, textAlign: "center", padding: "0 6px" }}>Aún sin datos</span>
            </div>
          )}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            {[0, 50, 100].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ stroke: C.borde }} />)}
            <polygon points={`0,100 ${linea} ${x(hasta)},100`} style={{ fill: tinte(accent, 12) }} />
            <polyline points={linea} fill="none" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: accent }} />
            {i !== null && <line x1={x(p.dia)} x2={x(p.dia)} y1="0" y2="100" strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ stroke: C.bordeFuerte }} />}
          </svg>
          {/* Cifra solo en la semana y en el final: una en cada semana repetía lo mismo. */}
          {hitos.map(([d], k) => (
            <Marca key={d} izquierda={x(d)} arriba={100 - v.puntos[d].pct} accent={accent}
              texto={k === 0 || k === hitos.length - 1 ? `${v.puntos[d].pct}%` : null} />
          ))}
          {i !== null && !hitos.some(([d]) => d === p.dia) && <Marca izquierda={x(p.dia)} arriba={100 - p.pct} accent={accent} />}
        </div>
        <span />
        <div style={{ position: "relative", height: 16 }} aria-hidden>
          {SEMANAS_EJE.map(([d, texto]) => (
            <span key={d} style={{
              position: "absolute", left: `${x(d)}%`, fontSize: 11, color: C.tenue, whiteSpace: "nowrap",
              transform: d === 0 ? "none" : d === dias ? "translateX(-100%)" : "translateX(-50%)",
            }}>{texto}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Un punto de la curva con su cifra encima. Anillo del color del panel: se lee sobre la línea. */
function Marca({ izquierda, arriba, accent, texto }) {
  return (
    <span style={{ position: "absolute", left: `${izquierda}%`, top: `${arriba}%`, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
      <span style={{ display: "block", width: 10, height: 10, borderRadius: "50%", background: accent, boxShadow: `0 0 0 2px ${C.panel}` }} />
      {texto && (
        <span style={{
          position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", fontSize: 12.5, fontWeight: 650,
          color: C.texto, background: C.panel, padding: "0 3px", borderRadius: 4, whiteSpace: "nowrap",
        }}>{texto}</span>
      )}
    </span>
  );
}

// --------------------------------------------------------------- visitas por día
/**
 * Visitas por día (`serieVisitas()`): una barra por día desde el primero de la
 * tienda, con la media de los días que abre como raya y el mejor día con su
 * cifra encima. Un día cerrado, una rayita gris (un cero de un domingo cerrado
 * no es un domingo malo); hoy, más claro y con su nombre: aún no ha acabado.
 */
export function VisitasPorDia({ serie, resumen, accent: tienda }) {
  const accent = legible(tienda);
  if (!serie.length) return null;
  const max = Math.max(1, ...serie.map((d) => d.n));
  const ayer = serie.length > 1 && serie.at(-1).hoy ? serie.length - 2 : serie.length - 1;
  const { i, props } = usePuntero(serie.length);
  const d = serie[i ?? ayer];
  const lectura = d.cerrado && !d.n
    ? `${mayuscula(fechaLarga(d.dia))}: cerrado`
    : d.hoy
      ? `Hoy, hasta ahora: ${contar(d.n, ["visita", "visitas"])}`
      : `${mayuscula(fechaLarga(d.dia))}: ${contar(d.n, ["visita", "visitas"])}`;
  const alto = 130;
  const mejor = resumen.mejor?.dia;
  const medio = serie.length >= 12 ? serie[Math.floor(serie.length / 2)] : null;

  const enMedia = resumen.media !== null ? (resumen.media / max) * (alto - 22) : null;
  return (
    <div>
      <Lectura>{lectura}</Lectura>
      {/* La raya de la media cruza las barras; su cifra va fuera, a la derecha, para no taparlas. */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 6 }}>
        <div {...props} role="img" aria-label={`Visitas por día desde el ${fechaCorta(serie[0].dia)}${resumen.media !== null ? `: una media de ${numero(resumen.media, 0)} al día que abre` : ""}`}
          style={{ ...props.style, position: "relative", height: alto, display: "flex", alignItems: "flex-end", gap: 2, borderBottom: `1px solid ${C.bordeFuerte}` }}>
          {serie.map((x, k) => {
            const cerrado = x.cerrado && !x.n;
            const marcada = i === k;
            return (
              <div key={x.dia} style={{ flex: 1, maxWidth: 24, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", position: "relative" }}>
                {x.dia === mejor && x.n > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 650, color: C.texto, marginBottom: 3, fontVariantNumeric: "tabular-nums" }}>{x.n}</span>
                )}
                {cerrado ? (
                  <span style={{ width: "70%", height: 3, borderRadius: 2, background: C.bordeFuerte }} />
                ) : (
                  <span style={{
                    width: "100%", height: `${(x.n / max) * (alto - 22)}px`, minHeight: x.n ? 3 : 0, borderRadius: "4px 4px 0 0",
                    background: accent, opacity: x.hoy ? 0.35 : i === null || marcada ? 0.9 : 0.45,
                  }} />
                )}
              </div>
            );
          })}
          {enMedia !== null && (
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: enMedia, borderTop: `1px solid ${C.texto}`, opacity: 0.5, pointerEvents: "none" }} />
          )}
        </div>
        <div aria-hidden style={{ position: "relative", height: alto, minWidth: 40 }}>
          {enMedia !== null && (
            <span style={{ position: "absolute", left: 0, bottom: enMedia, transform: "translateY(50%)", fontSize: 11, lineHeight: 1.15, color: C.suave, whiteSpace: "nowrap" }}>
              media<br /><strong style={{ color: C.texto, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{numero(resumen.media, 0)}</strong>
            </span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.tenue, marginTop: 5 }}>
          <span>{fechaCorta(serie[0].dia)}</span>
          {medio && <span>{fechaCorta(medio.dia)}</span>}
          <span>{serie.at(-1).hoy ? "hoy" : fechaCorta(serie.at(-1).dia)}</span>
        </div>
      </div>
      {serie.some((x) => x.cerrado && !x.n) && <Leyenda colores={[[C.bordeFuerte, "Cerrado"]]} />}
    </div>
  );
}

// --------------------------------------------------------------- quién sigue
// El orden del Resumen: los que siguen viniendo, los que se van alejando y, aparte, los que no han empezado.
const ORDEN_ESTADOS = [["activo", "nuevo"], ["riesgo", "dormido", "perdido"], ["fantasma"]];

/**
 * Cuántos hay en cada estado (`metricas().porEstado`), uno por fila con su
 * barra y qué quiere decir: «En riesgo» sin su frase es una etiqueta que hay que
 * preguntar. Las barras se miden contra el total, así se ven como partes de él.
 */
export function Estados({ porEstado, total }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {ORDEN_ESTADOS.map((bloque, b) => (
        <ul key={b} style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, paddingTop: b ? 14 : 0, borderTop: b ? `1px solid ${C.borde}` : "none" }}>
          {bloque.map((key) => {
            const e = ESTADOS[key];
            const n = porEstado[key] || 0;
            return (
              <li key={key} style={{ opacity: n ? 1 : 0.6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color, flexShrink: 0, alignSelf: "center" }} />
                  <span style={{ fontWeight: 600 }}>{e.plural}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{numero(n)}</span>
                  <span style={{ width: 42, textAlign: "right", fontSize: 12.5, color: C.tenue, fontVariantNumeric: "tabular-nums" }}>{total ? Math.round((n / total) * 100) : 0}%</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.suave, margin: "2px 0 0 18px" }}>{e.quienes}</div>
                <div style={{ height: 6, marginLeft: 18, marginTop: 5, background: C.panelSuave, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${total ? (n / total) * 100 : 0}%`, minWidth: n ? 3 : 0, height: "100%", background: e.color, borderRadius: 3 }} />
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- el puente
/**
 * De dónde salen los que siguen viniendo hoy (`puenteActivos()`): los dos
 * totales desde cero, y entre medias cada cambio flotando donde lo deja el
 * anterior, verde lo que suma y ámbar lo que resta (los colores de los
 * estados). Cada cambio dice qué es debajo de su nombre.
 */
export function Puente({ p, accent }) {
  const max = Math.max(1, ...p.pasos.map((x) => x.hasta));
  const color = (x) => (x.signo > 0 ? ESTADOS.activo.color : x.signo < 0 ? ESTADOS.riesgo.color : legible(accent));
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
      {p.pasos.map((x) => (
        <li key={x.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 14 }}>
            <span style={{ fontWeight: x.signo ? 500 : 650 }}>{x.label}</span>
            <strong style={{ fontWeight: 650, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {x.signo > 0 ? "+" : x.signo < 0 ? "−" : ""}{numero(x.n)}
            </strong>
          </div>
          <div style={{ position: "relative", height: 10, background: C.panelSuave, borderRadius: 4, marginTop: 5 }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, borderRadius: 4,
              left: `${(x.desde / max) * 100}%`, width: `${((x.hasta - x.desde) / max) * 100}%`, minWidth: x.n ? 4 : 0,
              background: color(x),
            }} />
          </div>
          <div style={{ fontSize: 12.5, color: C.suave, marginTop: 4 }}>{x.descripcion}</div>
        </li>
      ))}
    </ol>
  );
}

// --------------------------------------------------------------- la cartilla
const SIGUEN = ESTADOS.activo.color;
const ALEJAN = ESTADOS.riesgo.color;
export const LeyendaCartilla = () => <Leyenda colores={[[SIGUEN, "Siguen viniendo"], [ALEJAN, "Se alejan"]]} />;

/**
 * Cuántos puntos lleva cada cliente en una cartilla (`repartoCartillas()`):
 * una columna por número de puntos, abajo los que se alejan y encima los que
 * siguen viniendo, separados por un hueco. Sobre la gráfica, su frase.
 */
export function Cartilla({ c, conNombre }) {
  const max = Math.max(1, ...c.filas.map((f) => f.siguen + f.alejan));
  const comun = c.filas.reduce((m, f) => (f.siguen + f.alejan > m.siguen + m.alejan ? f : m), c.filas[0]);
  const { i, props } = usePuntero(c.filas.length);
  const f = c.filas[i ?? comun.sellos - 1];
  const cuantos = (s) => (s === c.meta ? "la cartilla llena" : contar(s, ["punto", "puntos"]));
  // «1 punto o menos» no existe (no hay ceros aquí): con 1, «en 1 punto».
  const hasta = (n) => `${contar(n, ["punto", "puntos"])}${n > 1 ? " o menos" : ""}`;
  const frase = c.alejanMediana !== null
    ? `La mitad de los que se alejan se quedó en ${hasta(c.alejanMediana)}, de ${c.meta}.`
    : c.mitad !== null
      ? `La mitad lleva ${hasta(c.mitad)}, de ${c.meta}.`
      : null;

  return (
    <div style={{ minWidth: 0, maxWidth: 520 }}>
      {conNombre && <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 2 }}>{c.nombre}</div>}
      {frase && <p style={{ fontSize: 13.5, margin: "0 0 8px" }}>{frase}</p>}
      {!c.conPuntos ? (
        <p style={{ color: C.suave, fontSize: 13, margin: 0 }}>Aún nadie tiene puntos en esta cartilla.</p>
      ) : (
        <>
          <Lectura>
            {i === null ? `Lo más común, ${cuantos(f.sellos)}` : mayuscula(cuantos(f.sellos))}: {contar(f.siguen + f.alejan, ["cliente", "clientes"])}
            {f.alejan > 0 && ` (${f.alejan} se ${f.alejan === 1 ? "aleja" : "alejan"})`}
          </Lectura>
          <div {...props} role="img" aria-label={`${c.nombre}: ${c.filas.map((x) => `${x.sellos} puntos, ${x.siguen + x.alejan}`).join("; ")}`}
            style={{ ...props.style, display: "flex", alignItems: "flex-end", gap: 3, height: 110, borderBottom: `1px solid ${C.bordeFuerte}` }}>
            {c.filas.map((x, k) => {
              const atenuada = i !== null && i !== k;
              return (
                <div key={x.sellos} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: x.siguen && x.alejan ? 2 : 0, opacity: atenuada ? 0.45 : 1 }}>
                  {x.siguen > 0 && <div style={{ height: `${(x.siguen / max) * 100}%`, minHeight: 3, background: SIGUEN, borderRadius: "4px 4px 0 0" }} />}
                  {x.alejan > 0 && <div style={{ height: `${(x.alejan / max) * 100}%`, minHeight: 3, background: ALEJAN, borderRadius: x.siguen ? 0 : "4px 4px 0 0" }} />}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 4, fontSize: 11, color: C.tenue }}>
            {c.filas.map((x) => (
              <span key={x.sellos} style={{ flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {x.sellos === c.meta ? "llena" : c.meta > 10 && x.sellos % 2 ? "" : x.sellos}
              </span>
            ))}
          </div>
        </>
      )}
      {c.enCero > 0 && (
        <p style={{ fontSize: 12.5, color: C.tenue, margin: "8px 0 0" }}>
          Y {c.enCero} con la cartilla a cero: empiezan o acaban de canjear.
        </p>
      )}
    </div>
  );
}
