"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { PALETA } from "@/app/home/paleta";
import { GRUPOS, ideaDeGrupo } from "@/lib/crm";
import { Escenario, Panel, usePasos } from "./Marco";

// ============================================================================
// PASO 4: TUS CLIENTES (no se guarda nada, solo se enseña)
// ----------------------------------------------------------------------------
// La idea que hay que llevarse: fiddle aprende cada cuánto viene cada cliente y
// los ordena solo; el dueño solo decide a quién escribir. La escena lo cuenta
// con catorce clientes inventados (iniciales, sin fotos) que empiezan mezclados
// y vuelan a su grupo. Los grupos y sus textos son los de verdad (GRUPOS de
// lib/crm.js): lo que se explica aquí es lo mismo que luego verá en Avisos.
// Con «reducir movimiento» la escena nace ya ordenada.
// ============================================================================

// Cuatro grupos que se entienden de un vistazo y que además se reparten sin
// solaparse en el dibujo (en la realidad se solapan, pero aquí no importa).
const CLAVES = ["a_punto", "habituales", "riesgo", "nuevos"];
// Un tono por grupo: oscuro, para que las iniciales blancas se lean.
const TONOS = { a_punto: PALETA.camelOscuro, habituales: PALETA.verde, riesgo: "#b0553a", nuevos: "#3f6a8c" };
// Colores suaves de los clientes aún sin ordenar.
const SUAVES = ["#ecd9c2", "#d3e2d3", "#f1d3c2", "#cfdce9", "#e9d6e2", "#ebe4bd"];

// Quién va a qué grupo, con sus iniciales y dónde flota antes de ordenarse
// (en % del lienzo: x del ancho, y del alto).
const CLIENTES = [
  { ini: "AM", g: "a_punto", mezcla: [10, 18] },
  { ini: "LP", g: "nuevos", mezcla: [34, 8] },
  { ini: "JR", g: "riesgo", mezcla: [62, 14] },
  { ini: "CS", g: "habituales", mezcla: [82, 30] },
  { ini: "MG", g: "a_punto", mezcla: [22, 44] },
  { ini: "PV", g: "habituales", mezcla: [48, 36] },
  { ini: "IN", g: "riesgo", mezcla: [72, 56] },
  { ini: "DR", g: "nuevos", mezcla: [88, 12] },
  { ini: "SO", g: "habituales", mezcla: [8, 66] },
  { ini: "TB", g: "a_punto", mezcla: [38, 62] },
  { ini: "EF", g: "riesgo", mezcla: [58, 78] },
  { ini: "RH", g: "habituales", mezcla: [84, 76] },
  { ini: "NK", g: "nuevos", mezcla: [24, 82] },
  { ini: "OL", g: "a_punto", mezcla: [50, 12] },
];

// Las cajas en rejilla de 2x2 (en %), y dónde cae el cliente número k de cada una.
const CAJAS = { a_punto: [0, 0], habituales: [52, 0], riesgo: [0, 54], nuevos: [52, 54] };
const destinoDe = (g, k) => [CAJAS[g][0] + 4.2 + k * 10.4, CAJAS[g][1] + 20];

const MEZCLADOS_MS = 1000; // cuánto flotan antes de ordenarse
const ORDENADOS_MS = 2900; // desde que arranca todo hasta que el último ya está en su sitio

// Los clientes con su destino ya calculado: cada uno ocupa el sitio siguiente de su grupo.
const PUNTOS = (() => {
  const dentro = {};
  return CLIENTES.map((c, i) => {
    const k = dentro[c.g] ?? 0;
    dentro[c.g] = k + 1;
    return { ...c, i, destino: destinoDe(c.g, k), suave: SUAVES[i % SUAVES.length] };
  });
})();

export default function PasoClientes() {
  const { n, seguir, quieto } = usePasos();
  const [sel, setSel] = useState(CLAVES[0]);
  const [tocado, setTocado] = useState(false);
  const [fase, setFase] = useState(quieto ? "fin" : "mezcla");

  // Mezclados, ordenándose y ordenados. Solo en el último se apagan los grupos que
  // no se han elegido: antes, la escena tiene que contar la historia entera.
  useEffect(() => {
    if (quieto) { setFase("fin"); return undefined; }
    const ordena = setTimeout(() => setFase("orden"), MEZCLADOS_MS);
    const fin = setTimeout(() => setFase("fin"), ORDENADOS_MS);
    return () => { clearTimeout(ordena); clearTimeout(fin); };
  }, [quieto]);

  const resalta = tocado || fase === "fin" ? sel : null;
  const elegir = (clave) => { setSel(clave); setTocado(true); };

  return (
    <>
      <Escenario etiqueta="Tus clientes, mezclados, se ordenan solos en cuatro grupos" className="pp-cli-escena">
        <Lienzo fase={fase} resalta={resalta} />
      </Escenario>
      <Panel
        titulo="Tus clientes, ordenados solos"
        pista="fiddle aprende el ritmo de cada uno. Tú decides a quién escribir."
        principal={{ texto: "Entendido", onClick: seguir }}
        className="pp-cli-cuerpo"
      >
        <Opciones sel={sel} alElegir={elegir} />
        <Explicacion clave={sel} negocio={n} />
      </Panel>
    </>
  );
}

// El dibujo: cuatro cajas que aparecen y los clientes que van a ellas.
function Lienzo({ fase, resalta }) {
  return (
    <div className={`pp-cli-lienzo pp-cli-${fase}`} aria-hidden="true">
      {CLAVES.map((clave, j) => (
        <div
          key={clave}
          className={`pp-cli-caja${resalta === clave ? " resalta" : ""}${resalta && resalta !== clave ? " apagada" : ""}`}
          style={{ "--x": `${CAJAS[clave][0]}%`, "--y": `${CAJAS[clave][1]}%`, "--g": TONOS[clave], "--j": j }}
        >
          <span className="pp-cli-nombre">
            <Icono nombre={GRUPOS[clave].icon} tam={14} />
            <span>{GRUPOS[clave].label}</span>
          </span>
        </div>
      ))}
      {PUNTOS.map((p) => (
        <span
          key={p.ini}
          className={`pp-cli-punto${resalta === p.g ? " resalta" : ""}${resalta && resalta !== p.g ? " apagado" : ""}`}
          style={{
            "--mx": p.mezcla[0], "--my": p.mezcla[1], "--gx": p.destino[0], "--gy": p.destino[1],
            "--i": p.i, "--g": TONOS[p.g], "--suave": p.suave,
          }}
        >
          <span className="pp-cli-cuerpo-punto">
            <b className="pp-cli-base">{p.ini}</b>
            <b className="pp-cli-final">{p.ini}</b>
          </span>
        </span>
      ))}
    </div>
  );
}

// Los cuatro grupos como un radiogroup: con flechas se mueve la elección, y el foco con ella.
function Opciones({ sel, alElegir }) {
  const grupo = useRef(null);
  const mover = (ev) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
    if (!paso) return;
    ev.preventDefault();
    const siguiente = CLAVES[(CLAVES.indexOf(sel) + paso + CLAVES.length) % CLAVES.length];
    alElegir(siguiente);
    grupo.current?.querySelector(`[data-clave="${siguiente}"]`)?.focus();
  };
  return (
    <div ref={grupo} className="pp-cli-opciones" role="radiogroup" aria-label="Grupos de clientes" onKeyDown={mover}>
      {CLAVES.map((clave) => (
        <button
          key={clave} type="button" role="radio" data-clave={clave}
          aria-checked={clave === sel} tabIndex={clave === sel ? 0 : -1}
          className="pp-cli-opcion" style={{ "--g": TONOS[clave] }} onClick={() => alElegir(clave)}
        >
          <span className="pp-cli-ico"><Icono nombre={GRUPOS[clave].icon} tam={16} /></span>
          <span className="pp-cli-etiqueta">{GRUPOS[clave].label}</span>
        </button>
      ))}
    </div>
  );
}

// Qué es el grupo y, si lo tiene, un ejemplo de lo que se le podría escribir.
function Explicacion({ clave, negocio }) {
  const g = GRUPOS[clave];
  return (
    <div className="pp-cli-explica" aria-live="polite">
      <div key={clave} className="pp-cli-nueva" style={{ "--g": TONOS[clave] }}>
        <p className="pp-cli-desc">{g.descripcion}</p>
        {g.idea && (
          <p className="pp-cli-idea">
            <span>Por ejemplo:</span> «{ideaDeGrupo(g.idea, negocio)}»
          </p>
        )}
      </div>
    </div>
  );
}
