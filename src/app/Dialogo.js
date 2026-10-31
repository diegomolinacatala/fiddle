"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { C, botonPrimario, botonSecundario, campo, RADIO } from "@/app/ui";

// ============================================================================
// PREGUNTAS EN UNA VENTANA NUESTRA
// ----------------------------------------------------------------------------
// Nunca window.confirm, alert ni prompt (31-10-2026, lo pidió Víctor): la caja del
// navegador es distinta en cada móvil, no lleva nuestros colores y parece un
// error. `await confirmar(…)` devuelve true o false como confirm, así que se
// cambia una línea por otra sin pasar nada por props.
//
// Va en un <dialog> modal: el foco queda dentro, Escape o tocar fuera cancela, y
// al cerrar el foco vuelve a donde estaba. Se monta en su propia raíz, fuera de la
// página, y se desmonta al contestar.
// ============================================================================

/** Un texto con «¿Pregunta?\n\nDetalle» se parte en título y explicación. */
function partir(opciones) {
  if (typeof opciones !== "string") return opciones || {};
  const [titulo, ...resto] = opciones.split(/\n\n+/);
  return { titulo, texto: resto.join("\n\n") };
}

function Ventana({ titulo, texto, si = "Aceptar", no = "Cancelar", peligro = false, accent, copiar = null, claro = false, onFin }) {
  const ref = useRef(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function alPortapapeles() {
    try {
      await navigator.clipboard.writeText(copiar);
      setCopiado(true);
    } catch {
      // Sin permiso: el texto ya está seleccionado en el campo, que lo copie a mano.
      ref.current?.querySelector("input")?.select();
    }
  }

  const fondoSi = peligro ? "#b42318" : accent || "#1b1e23";
  return (
    <dialog
      ref={ref}
      className={`ventana${claro ? " claro" : ""}`}
      aria-labelledby="ventana-titulo"
      // Escape: el navegador lo cierra solo; aquí solo se dice que fue «no».
      onCancel={(e) => { e.preventDefault(); onFin(false); }}
      // Tocar fuera del recuadro (el propio <dialog> es el fondo) también es «no».
      onClick={(e) => { if (e.target === ref.current) onFin(false); }}
      style={{
        border: 0, padding: 0, background: "transparent", color: C.texto,
        width: "min(420px, calc(100% - 32px))", maxWidth: "none",
      }}
    >
      <div style={{ background: C.panel, borderRadius: RADIO.panel + 2, padding: "20px 20px 16px", boxShadow: "0 18px 50px rgb(0 0 0 / 0.28)" }}>
        <h2 id="ventana-titulo" style={{ fontSize: 17, fontWeight: 650, margin: 0, lineHeight: 1.3 }}>{titulo}</h2>
        {texto && <p style={{ margin: "8px 0 0", color: C.suave, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>{texto}</p>}
        {copiar != null && (
          <input
            readOnly value={copiar} aria-label={titulo} autoFocus
            onFocus={(e) => e.target.select()}
            style={{ ...campo, marginTop: 12, fontSize: 13 }}
          />
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
          {copiar != null ? (
            <>
              <button type="button" onClick={() => onFin(true)} style={botonSecundario}>Cerrar</button>
              <button type="button" onClick={alPortapapeles} style={botonPrimario(fondoSi)}>{copiado ? "Copiado" : "Copiar"}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onFin(false)} style={botonSecundario}>{no}</button>
              {/* El foco empieza en «sí» para que Intro conteste, como en confirm. */}
              <button type="button" onClick={() => onFin(true)} autoFocus style={botonPrimario(fondoSi)}>{si}</button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

function abrir(props) {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolver) => {
    const nodo = document.createElement("div");
    document.body.appendChild(nodo);
    const raiz = createRoot(nodo);
    const antes = document.activeElement;
    let hecho = false;
    const fin = (valor) => {
      if (hecho) return;
      hecho = true;
      resolver(valor);
      // Fuera del manejador del clic: React no deja desmontar una raíz en mitad de su propio evento.
      setTimeout(() => {
        raiz.unmount();
        nodo.remove();
        antes?.focus?.();
      }, 0);
    };
    raiz.render(<Ventana {...props} onFin={fin} />);
  });
}

/**
 * ¿Sigue adelante? `opciones`: un texto («¿Pregunta?\n\nDetalle») o
 * `{ titulo, texto, si, no, peligro, accent, claro }`.
 * @returns {Promise<boolean>}
 */
export const confirmar = (opciones) => abrir(partir(opciones));

/** Un texto que hay que copiar a mano (el portapapeles no dejó): en un campo, con «Copiar». */
export const ensenarParaCopiar = ({ titulo, valor, accent, claro }) => abrir({ titulo, copiar: valor, accent, claro });
