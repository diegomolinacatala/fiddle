"use client";

import { createContext, useContext } from "react";
import Cabeza from "@/app/home/experiencia/Cabeza";
import { Flecha } from "@/app/home/tarjeta/controles";
import Icono from "@/app/Icono";
import { PASOS, FINAL } from "@/lib/primerosPasos";

// ============================================================================
// EL MARCO DE CADA PASO (lo que comparten las cinco pantallas)
// ----------------------------------------------------------------------------
// La disposición es la de la demo de la web (/home/tarjeta): una escena grande
// con UNA protagonista y un panel con UNA pregunta. Cada paso pinta las dos
// mitades con estas piezas:
//
//   <Escenario>  la mitad grande (arriba en el móvil): lo que se enseña
//   <Panel>      la otra: el progreso, el título, lo que se elige y los botones
//
// y saca lo demás del contexto con usePasos():
//
//   n, setN        la tienda (negocioDelPersonal) y cómo ponerla al día tras guardar
//   slug, accent   su slug y su color (botones sobre blanco)
//   tapUrl, qr     la URL del QR del mostrador y el QR ya hecho:
//                  { src: data URI SVG, lado: módulos por lado, modulos: "0101…" fila a fila }
//   quieto         «reducir movimiento»: nada se anima
//   paso           el paso de la URL
//   seguir()       lo da por hecho (POST /api/primeros-pasos) y pasa al siguiente
//   saltar()       pasa al siguiente sin darlo por hecho («Ahora no»)
//   guardar(body)  PUT /api/negocio con `body`: devuelve la tienda guardada (y la pone
//                  en `n`) o lanza un Error con el mensaje para enseñar
//   setSub(i, total)  en un paso con varias pantallas, en cuál está (llena su tramo)
//   setAtras(fn)   en un paso con varias pantallas, qué hace la flecha de atrás
//                  (fn devuelve true si lo ha resuelto dentro; null para quitarlo)
// ============================================================================

export const Contexto = createContext(null);

export function usePasos() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usePasos se usa dentro de los primeros pasos");
  return valor;
}

/** La mitad grande. `className` para lo propio de cada paso. */
export function Escenario({ className = "", children, etiqueta }) {
  return (
    <div className={`prob-escena pp-escena${className ? ` ${className}` : ""}`} role="group" aria-label={etiqueta}>
      {children}
    </div>
  );
}

/**
 * El panel de un paso.
 * @param {{
 *   llave?: string,      cambia la pantalla de dentro (entra deslizando)
 *   titulo: string, pista?: string,
 *   principal?: { texto: string, onClick: () => void, ocupado?: boolean, deshabilitado?: boolean } | null,
 *     el botón grande; por defecto «Seguir» (seguir()). null, sin botón (el paso avanza solo al elegir)
 *   ahoraNo?: boolean,   el «Ahora no» de debajo (saltar()); por defecto sí
 *   error?: string|null, junto a los botones, en rojo y anunciado
 *   className?: string,  para el cuerpo
 *   children
 * }} props
 */
export function Panel({ llave, titulo, pista, principal, ahoraNo = true, error = null, className = "", children }) {
  const { paso, seguir, saltar, quieto } = usePasos();
  const boton = principal === undefined ? { texto: "Seguir", onClick: seguir } : principal;
  return (
    <aside className="prob-panel exp-panel pp-panel" aria-label="Primeros pasos">
      <Progreso />
      <section key={`${paso}:${llave ?? ""}`} className={`exp-paso${quieto ? "" : " desde-dcha"}`}>
        <div className={`exp-cuerpo${className ? ` ${className}` : ""}`}>
          <Cabeza titulo={titulo} pista={pista} />
          {children}
        </div>
        {(boton || ahoraNo || error) && (
          <div className="exp-accion">
            {error && <p className="pp-error" role="alert">{error}</p>}
            {boton && (
              <button
                type="button" className="prob-siguiente prob-ancho exp-principal"
                onClick={boton.onClick} disabled={boton.ocupado || boton.deshabilitado} aria-busy={boton.ocupado || undefined}
              >
                {boton.texto} {!boton.ocupado && <Flecha />}
              </button>
            )}
            {ahoraNo && paso !== FINAL && (
              <button type="button" className="pp-ahora-no" onClick={saltar}>Ahora no</button>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}

/**
 * Atrás y cinco tramos, uno por paso: los hechos, llenos y con su marca; el de
 * ahora, lleno hasta donde va (sus pantallas); el resto, vacíos. Llena con
 * transform, nunca con el ancho.
 */
function Progreso() {
  const { paso, hechos, sub, atras } = usePasos();
  const i = paso === FINAL ? PASOS.length : PASOS.findIndex((p) => p.id === paso);
  const actual = PASOS[i];
  const n = Math.min(i + 1, PASOS.length);
  return (
    <div className="exp-progreso pp-progreso">
      <button type="button" className="exp-atras" onClick={atras} disabled={i <= 0 && !sub.i} aria-label="Atrás">
        <Flecha atras />
      </button>
      <ol
        className="pp-tramos" role="progressbar" aria-label="Primeros pasos"
        aria-valuemin={1} aria-valuemax={PASOS.length} aria-valuenow={n}
        aria-valuetext={actual ? `Paso ${n} de ${PASOS.length}: ${actual.nombre}` : "Terminado"}
      >
        {PASOS.map((p, j) => {
          const lleno = j < i || paso === FINAL ? 1 : j === i ? (sub.i + 1) / (sub.total + 1) : 0;
          return (
            <li key={p.id} className={`pp-tramo${hechos.includes(p.id) ? " hecho" : ""}${j === i ? " ahora" : ""}`}>
              <i style={{ transform: `scaleX(${lleno})` }} />
            </li>
          );
        })}
      </ol>
      <span className="exp-pasos" aria-hidden="true">
        {actual ? `${n} de ${PASOS.length}` : <Icono nombre="check" tam={18} />}
      </span>
    </div>
  );
}
