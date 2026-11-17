"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import CaraDelPase from "@/app/CaraDelPase";
import { WALLET } from "@/lib/vistaWallet";
import { tarjetaDe, encuadre, regionDe } from "./opciones";
import { useInclinacion, useReducirMovimiento } from "./movimiento";

// ============================================================================
// LA TARJETA EN SU ESCENA
// ----------------------------------------------------------------------------
// - La tarjeta es CaraDelPase con lo elegido (opciones.js → ejemplo de demo.js):
//   lo que se ve es lo que saldría en el Wallet.
// - La inclinación NO pasa por React: un bucle de requestAnimationFrame
//   (movimiento.js) escribe el transform y unas variables CSS (brillo y sombra).
// - El encuadre es un transform con transición (CSS): mide las partes de verdad
//   (`data-parte` de CaraDelPase) y encuadre() decide escala y desplazamiento.
//   Mide SU contenedor, así que vale con cualquier tamaño.
// - La tarjeta se pinta al doble de su tamaño (RESOLUCION, `zoom` en estilo.js) y
//   la cámara la encoge: un transform agranda lo ya pintado y al acercarse se
//   vería borrosa, banda incluida.
// - Cada cambio entra como una capa nueva encima de la anterior, que se funde. La
//   sombra es UNA, fuera de las capas: con una por capa se sumaban mientras había
//   dos y, al quitar la vieja, la sombra saltaba de golpe.
// - Con «reducir movimiento», ni se inclina ni flota y la cámara salta sin animar.
//
// Contrato:
//   eleccion      lo elegido, ya pasado por limpiar() (opciones.js)
//   parte         qué enseña la cámara: "todo" | "banda" | "cabecera" | "cabecera banda"…
//   qr            data URI del QR de la tarjeta
//   puntos, promo opcionales, para tarjetaDe(eleccion, { puntos, promo }); si cambian,
//                 entran como una capa fundida más (por eso van en la llave)
//   escala        opcional (1): multiplica la escala de la cámara, para encoger la tarjeta
//   desplaza      opcional ({ x, y } = 0): la aparta, en fracción del ancho y del alto de la escena
//   alTocarParte  opcional: (parte) al tocar sin arrastrar una zona con `data-parte`
//   como          etiqueta de la raíz (por defecto "div"; /home/tarjeta usa "main")
//   className     clases extra de la raíz; el resto de props (aria-label…) pasan tal cual
//   children      se pintan dentro de la escena, por encima de la tarjeta
//   ref           { latido() }: un latido de la tarjeta, al elegir
//
// El `prob-halo` NO va aquí: es hermano de la escena (cubre toda la página, no solo
// la escena), así que lo pone quien tenga la página.
// ============================================================================

const CAPAS_MAX = 3;
const FUNDIDO = 480; // ms; lo mismo que la animación de entrada en estilo.js
const ARRASTRE = 6; // px de dedo o ratón a partir de los que no es un toque
const RESOLUCION = 2; // el `zoom` de .prob-tarjeta en estilo.js

const SIN_DESPLAZO = { x: 0, y: 0 };

const Escena = forwardRef(function Escena({ eleccion, parte = "todo", qr, puntos, promo = null, escala = 1, desplaza = SIN_DESPLAZO, alTocarParte, como: Raiz = "div", className = "", children, ...resto }, ref) {
  const quieto = useReducirMovimiento();
  const e = eleccion;

  // ---- capas: lo de antes se queda debajo mientras lo nuevo entra fundido.
  // El nombre no hace capa (se escribe letra a letra): se cambia en todas.
  const llave = JSON.stringify({ ...e, nombre: "", puntos, promo });
  const [capas, setCapas] = useState(() => [{ id: 0, llave, eleccion: e, puntos, promo }]);
  const siguienteId = useRef(1);
  useEffect(() => {
    setCapas((cs) => {
      if (cs[cs.length - 1].llave === llave) return cs;
      return [...cs, { id: siguienteId.current++, llave, eleccion: e, puntos, promo }].slice(-CAPAS_MAX);
    });
    const t = setTimeout(() => setCapas((cs) => (cs.length > 1 ? cs.slice(-1) : cs)), FUNDIDO + 60);
    return () => clearTimeout(t);
    // `e`, `puntos` y `promo` salen de `llave`: con la llave basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llave]);

  // ---- la cámara
  const escena = useRef(null);
  const inclina = useRef(null);
  const capaArriba = useRef(null);
  const cerca = useRef(false);
  const [camara, setCamara] = useState({ s: 1, y: 0, w: 0, h: 0 });
  const [lista, setLista] = useState(false); // ya medida: desde aquí la cámara se anima

  useLayoutEffect(() => {
    const medir = () => {
      const art = capaArriba.current?.querySelector("article");
      const caja = escena.current?.getBoundingClientRect();
      if (!art || !caja) return;
      // offsetWidth, con `zoom`, no vale lo mismo en todos los navegadores: se
      // pasa todo a puntos de la tarjeta sabiendo cuánto mide de verdad.
      const f = WALLET.ancho / art.offsetWidth;
      const medidas = {};
      for (const el of art.querySelectorAll("[data-parte]")) medidas[el.dataset.parte] = { top: el.offsetTop * f, height: el.offsetHeight * f };
      // En el móvil la escena deja sitio arriba a los botones (su padding): la
      // tarjeta se centra en lo que queda.
      const arriba = parseFloat(getComputedStyle(escena.current).paddingTop) || 0;
      const c = encuadre(regionDe(parte, medidas), { w: WALLET.ancho, h: art.offsetHeight * f }, { w: caja.width, h: caja.height - arriba });
      cerca.current = parte !== "todo";
      const w = Math.round(caja.width);
      const h = Math.round(caja.height);
      setCamara((a) => (a.s === c.s && a.y === c.y && a.w === w && a.h === h ? a : { ...c, w, h }));
      // Dos fotogramas: el primero pinta el encuadre sin transición; luego ya se anima.
      requestAnimationFrame(() => requestAnimationFrame(() => setLista(true)));
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (escena.current) obs.observe(escena.current);
    if (capaArriba.current) obs.observe(capaArriba.current);
    return () => obs.disconnect();
  }, [parte, capas]);

  useInclinacion({ escena, inclina, cerca, quieto });

  // ---- tocar una parte de la tarjeta (sin arrastrar) se lo cuenta a quien mande
  const toque = useRef(null);
  const alSoltar = (ev) => {
    const t = toque.current;
    toque.current = null;
    if (!alTocarParte || !t || Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > ARRASTRE) return;
    const p = ev.target.closest?.("[data-parte]")?.dataset.parte;
    if (p) alTocarParte(p);
  };

  // ---- al elegir, la tarjeta da un latido (sin volver a montarla)
  const tarjetaEl = useRef(null);
  useImperativeHandle(ref, () => ({
    latido() {
      if (quieto) return;
      tarjetaEl.current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.035)" }, { transform: "scale(1)" }],
        { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    },
  }), [quieto]);

  return (
    <Raiz {...resto} ref={escena} className={`prob-escena${quieto ? " prob-quieto" : ""}${lista ? " prob-lista" : ""}${className ? ` ${className}` : ""}`}>
      <div className="prob-inclina" ref={inclina}>
        <div
          className="prob-zoom"
          style={{ transform: `translate3d(${desplaza.x * camara.w}px, ${camara.y + desplaza.y * camara.h}px, 0) scale(${(camara.s * escala) / RESOLUCION})` }}
          onPointerDown={(ev) => { toque.current = { x: ev.clientX, y: ev.clientY }; }}
          onPointerUp={alSoltar}
          onPointerCancel={() => { toque.current = null; }}
        >
          <div ref={tarjetaEl} className="prob-tarjeta">
            <div className="prob-sombra" aria-hidden="true" />
            <div className="prob-capas">
              {capas.map((c, i) => {
                const arriba = i === capas.length - 1;
                const { negocio, cliente } = tarjetaDe({ ...c.eleccion, nombre: e.nombre }, { puntos: c.puntos, promo: c.promo });
                return (
                  <div key={c.id} ref={arriba ? capaArriba : undefined} className={`prob-capa${c.id ? " entra" : ""}`} aria-hidden={!arriba}>
                    <CaraDelPase cliente={cliente} negocio={negocio} qr={{ src: qr, codigo: cliente.codigo }} />
                  </div>
                );
              })}
            </div>
            <div className="prob-brillo" aria-hidden="true" />
          </div>
        </div>
      </div>
      {children}
    </Raiz>
  );
});

export default Escena;
