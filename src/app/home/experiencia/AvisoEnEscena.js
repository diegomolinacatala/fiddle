"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Aviso } from "../Telefono";
import { avisoDe, avisoDePromo } from "../demo";
import { useReducirMovimiento } from "../tarjeta/movimiento";
import { useTarjeta } from "./Tarjeta";

const AVISO_GENERICO = "Tu tarjeta se ha puesto al día.";
const DURA = 4000; // ms que se queda a la vista
const SALIDA = 200; // ms de la salida (más rápida que la entrada)
const VUELO = 640; // ms que tarda en salir del móvil hasta su sitio
const MAX_VIVOS = 3; // dos a la vista y uno apagándose

const textoDe = (tipo, tarjeta) => (tipo === "promo" ? avisoDePromo(tarjeta) : avisoDe(tarjeta)) || AVISO_GENERICO;

// El centro del móvil del cliente, en coordenadas de la zona de avisos.
function origenDe(zona, movil) {
  if (!zona || !movil) return null;
  const z = zona.getBoundingClientRect();
  const m = movil.getBoundingClientRect();
  return { x: m.left + m.width / 2 - z.left, y: m.top + m.height / 2 - z.top };
}

// Los avisos que le llegan al cliente: nacen en su móvil y suben hasta su sitio.
// Solo reacciona a un aviso NUEVO: al volver a este paso no reaparecen los de antes.
// `visible`: son de la prueba; si se pasa a guardarla con avisos en pantalla, se quitan.
export default function AvisoEnEscena({ visible = true, movilRef }) {
  const { tarjeta, aviso } = useTarjeta();
  const zona = useRef(null);
  const visto = useRef(aviso.n);
  const [lista, setLista] = useState([]); // el más nuevo primero: { clave, texto, origen, saliendo }

  useEffect(() => {
    if (aviso.n === visto.current) return;
    visto.current = aviso.n;
    const nuevo = { clave: aviso.n, texto: textoDe(aviso.tipo, tarjeta), origen: origenDe(zona.current, movilRef?.current), saliendo: false };
    setLista((l) => [nuevo, ...l].slice(0, MAX_VIVOS));
    // El texto sale del aviso: con `aviso.n` basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso.n]);

  useEffect(() => {
    if (!visible) setLista([]);
  }, [visible]);

  const irse = useCallback((clave) => setLista((l) => l.map((a) => (a.clave === clave ? { ...a, saliendo: true } : a))), []);
  const quitar = useCallback((clave) => setLista((l) => l.filter((a) => a.clave !== clave)), []);
  const ultimo = lista.find((a) => !a.saliendo);

  return (
    <div ref={zona} className="exp-aviso-zona" aria-live="polite">
      {visible && lista.map((a, i) => (
        <AvisoVolando key={a.clave} a={a} indice={i} negocio={tarjeta.negocio} alIrse={irse} alQuitar={quitar} />
      ))}
      {visible && ultimo && <p className="prob-oculto">{`${tarjeta.negocio.nombre}: ${ultimo.texto}`}</p>}
    </div>
  );
}

function AvisoVolando({ a, indice, negocio, alIrse, alQuitar }) {
  const quieto = useReducirMovimiento();
  const raiz = useRef(null);
  const ejeX = useRef(null);
  const ejeY = useRef(null);

  // El vuelo son dos movimientos con curvas distintas (sube deprisa y se desliza
  // despacio hacia su sitio): juntos hacen un arco. Partiendo del móvil.
  useLayoutEffect(() => {
    if (quieto || !raiz.current) return;
    const r = raiz.current;
    const dx = a.origen ? a.origen.x - (r.offsetLeft + r.offsetWidth / 2) : 0;
    const dy = a.origen ? a.origen.y - (r.offsetTop + r.offsetHeight / 2) : 40;
    ejeX.current.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: VUELO, easing: "cubic-bezier(.45,0,.25,1)", fill: "backwards" });
    ejeY.current.animate(
      [{ transform: `translateY(${dy}px) scale(.3)`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "none", opacity: 1 }],
      { duration: VUELO, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" },
    );
    // Solo al nacer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const irse = setTimeout(() => alIrse(a.clave), DURA);
    const quitar = setTimeout(() => alQuitar(a.clave), DURA + SALIDA);
    return () => { clearTimeout(irse); clearTimeout(quitar); };
  }, [a.clave, alIrse, alQuitar]);

  return (
    <div ref={raiz} className={`exp-aviso i${Math.min(indice, 2)}${a.saliendo ? " sale" : ""}`} aria-hidden="true">
      <div ref={ejeX}>
        <div ref={ejeY}>
          <Aviso negocio={negocio} texto={a.texto} cuando="ahora" />
        </div>
      </div>
    </div>
  );
}
