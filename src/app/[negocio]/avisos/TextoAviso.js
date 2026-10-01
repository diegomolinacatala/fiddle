"use client";

import { useRef } from "react";
import Icono from "@/app/Icono";
import { VARIABLES, FRASES, MAX_TEXTO, renderTexto, largoMaximo, variablesDesconocidas } from "@/lib/automatizaciones";
import { C, campo, etiqueta, RADIO } from "@/app/ui";

// ============================================================================
// "LO QUE LE LLEGA": el texto de un aviso automático o programado
// ----------------------------------------------------------------------------
// Las llaves ({premio}) son cosa de dentro: el manager ve botones con nombre
// ("Su premio · cookie gratis") que las meten donde está el cursor, y justo
// debajo el texto tal cual le llega a uno de los clientes. Dos tipos:
//   DATOS   lo de cada uno (su premio, lo que le falta, su nombre…)
//   FRASES  una frase entera que solo ven los que encajan ("si está cerca del
//           premio"); a los demás no les sale nada. Con cuántos la verían.
// Lo usan los dos formularios (Regla.js y Programados.js): las mismas piezas.
// ============================================================================

// Más o menos lo que cabe en el iPhone al lado del premio (lib/vistaWallet.js).
const CABE_IPHONE = 100;

/**
 * @param {object} props
 * @param {object} props.vars      las del cliente de muestra (o varsDeEjemplo)
 * @param {object} props.ejemplo   varsDeEjemplo: con todas las frases puestas, para enseñar qué dice cada una
 * @param {object[]} props.encajan contextos de los clientes a los que va: para contar quién ve cada frase
 * @param {string|null} props.quien nombre del cliente de muestra, si lo hay
 */
export default function TextoAviso({ id, valor, onChange, vars, ejemplo, encajan = [], quien = null, accent }) {
  const area = useRef(null);
  const tocada = useRef(false); // sin tocar el texto, lo nuevo va al final (no al principio)
  const malas = variablesDesconocidas(valor);
  const final = renderTexto(valor, vars);
  // Si el de muestra no ve alguna frase del texto, cómo le llega a quien sí.
  const conFrases = renderTexto(valor, { ...vars, ...Object.fromEntries(FRASES.map((f) => [f.clave, vars[f.clave] || ejemplo[f.clave]])) });
  const largo = largoMaximo(valor, [vars, ...encajan.map((x) => x.vars)]);

  function meter(clave) {
    const el = area.current;
    const desde = tocada.current ? el?.selectionStart ?? valor.length : valor.length;
    const hasta = tocada.current ? el?.selectionEnd ?? valor.length : valor.length;
    const antes = valor.slice(0, desde);
    const despues = valor.slice(hasta);
    // Con su espacio: "{premio}Esta tarde" se leería "cookie gratisEsta tarde".
    const pre = antes && !/\s$/.test(antes) ? " " : "";
    const post = despues && !/^[\s,.;:!?]/.test(despues) ? " " : "";
    const trozo = `${pre}{${clave}}${post}`;
    onChange((antes + trozo + despues).slice(0, MAX_TEXTO));
    const pos = antes.length + trozo.length;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos, pos); });
  }

  return (
    <div>
      <label style={etiqueta} htmlFor={id}>Lo que le llega</label>
      <textarea id={id} ref={area} rows={3} value={valor} maxLength={MAX_TEXTO}
        onChange={(e) => onChange(e.target.value)} onFocus={() => { tocada.current = true; }}
        style={{ ...campo, resize: "vertical", fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 8, fontSize: 12, color: C.tenue, marginTop: 4 }}>
        <span style={{ flex: 1 }}>Lo que va entre llaves cambia para cada cliente.</span>
        <span style={{ color: valor.length > MAX_TEXTO - 10 ? C.mal : C.tenue }}>{valor.length}/{MAX_TEXTO}</span>
      </div>

      {/* El texto ya relleno: así se entiende qué hace cada llave sin explicarlo. */}
      <div style={asi}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {quien ? `Así le llega a ${quien}` : encajan.length ? "Así le llega a uno de ellos" : "Así llegaría (con datos de ejemplo)"}
        </span>
        <span style={{ display: "block", fontSize: 14, marginTop: 3 }}>{final ? `«${final}»` : "—"}</span>
        {conFrases !== final && (
          <>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>
              Y a quien le toque la frase
            </span>
            <span style={{ display: "block", fontSize: 14, marginTop: 3 }}>«{conFrases}»</span>
          </>
        )}
      </div>
      {largo > CABE_IPHONE && (
        <p style={{ ...nota, color: C.mal }}>
          A alguno le llegaría con {largo} letras: en el iPhone caben unas {CABE_IPHONE} y el resto se corta con «…».
        </p>
      )}
      {malas.length > 0 && <p style={{ ...nota, color: C.mal }}>No existe {`{${malas[0]}}`}: bórralo y usa los botones de abajo.</p>}

      <div style={{ ...subtitulo, marginTop: 14 }}>Añadir un dato de cada cliente</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {VARIABLES.map((v) => (
          <button key={v.clave} type="button" onClick={() => meter(v.clave)} title={`{${v.clave}}: ${v.ayuda}`} style={chip}>
            <Icono nombre="mas" tam={13} />
            {v.nombre}
            <span style={{ color: C.tenue, fontWeight: 400 }}>· {String(vars[v.clave] || ejemplo[v.clave] || v.ejemplo)}</span>
          </button>
        ))}
      </div>

      <div style={{ ...subtitulo, marginTop: 14 }}>Añadir una frase que solo ven algunos</div>
      <p style={{ ...nota, margin: "0 0 8px" }}>A quien no encaje no le sale nada: el mismo aviso le dice algo más a quien toca.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: 6 }}>
        {FRASES.map((f) => {
          const lo = encajan.filter((x) => x.vars?.[f.clave]).length;
          const puesta = valor.includes(`{${f.clave}}`);
          return (
            <button key={f.clave} type="button" onClick={() => meter(f.clave)} title={`{${f.clave}}`}
              style={{ ...frase, borderColor: puesta ? accent : C.borde, background: puesta ? `${accent}0d` : "#fff" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontSize: 13 }}>
                <Icono nombre={puesta ? "check" : "mas"} tam={13} style={{ color: puesta ? accent : C.suave }} /> {f.nombre}
              </span>
              <span style={{ fontSize: 12, color: C.suave, marginTop: 2 }}>«{vars[f.clave] || ejemplo[f.clave]}»</span>
              <span style={{ fontSize: 11.5, color: C.tenue, marginTop: 2 }}>
                {f.ayuda}{encajan.length > 0 ? ` · ahora, ${lo} de ${encajan.length}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const asi = { marginTop: 10, padding: "9px 12px", borderRadius: RADIO.boton, background: C.panelSuave, border: `1px solid ${C.borde}`, color: C.texto };
const nota = { fontSize: 12.5, color: C.tenue, margin: "6px 0 0", lineHeight: 1.45 };
const subtitulo = { fontSize: 12.5, fontWeight: 600, color: C.suave, marginBottom: 6 };
const chip = {
  font: "inherit", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8,
  border: `1px solid ${C.borde}`, background: "#fff", color: C.texto, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
};
const frase = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "8px 10px",
  borderRadius: RADIO.boton, border: "1px solid", cursor: "pointer", font: "inherit", color: C.texto,
};
