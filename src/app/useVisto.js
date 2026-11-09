"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { entre, ceros, frenando, duracionDe } from "@/lib/animar";
import Rueda from "./Rueda";

// ============================================================================
// LO ÚLTIMO QUE VIO ESTE DISPOSITIVO
// ----------------------------------------------------------------------------
// `useVisto(id, valor)` devuelve [ref, mostrado]: `mostrado` es `valor`, pero
// cuando el bloque (el elemento de `ref`) entra en pantalla sale de lo último
// que se vio AQUÍ de ese bloque y llega a lo de ahora (lib/animar.js). Si luego
// cambia con la pantalla abierta (en vivo, app/useEnVivo.js), se mueve otra vez.
// La primera vez en un dispositivo sale de cero.
//
// Se guarda en localStorage, por dispositivo y por tienda (el `id` lleva el
// slug). Solo cuentas de la tienda: nunca un nombre ni nada de un cliente.
// Quien pide menos movimiento en su teléfono ve el número final, sin más.
// ============================================================================

const PREFIJO = "fiddle:visto:";
const leer = (id) => { try { const s = localStorage.getItem(PREFIJO + id); return s ? JSON.parse(s) : null; } catch { return null; } };
const guardar = (id, v) => { try { localStorage.setItem(PREFIJO + id, JSON.stringify(v)); } catch { /* sin sitio o sin permiso: la próxima, desde cero */ } };
const quieto = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// En el servidor no hay layout: el efecto normal basta (y no avisa).
const useAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useVisto(id, valor) {
  const ref = useRef(null);
  const [mostrado, setMostrado] = useState(valor);
  // Para las cifras que ruedan (Rueda): no a medio camino, sino el de antes hasta que
  // arranca y el de llegada desde ese momento. La rueda gira sola de uno a otro; si
  // se le cambiara en cada fotograma, volvería a arrancar sesenta veces por segundo.
  const [final, setFinal] = useState(valor);
  // La rueda no gira hasta que tiene puesto lo de antes: el primer cambio (del valor
  // del servidor a lo último visto) es un salto, no un giro. Sin esto, giraba hacia
  // atrás (58 → 31) y luego hacia delante (31 → 58), visto fotograma a fotograma.
  const [gira, setGira] = useState(false);
  const girando = useRef(false);
  const ahora = useRef(valor); // lo que se ve en este momento (a medio camino, si se mueve)
  const destino = useRef(valor);
  const pendiente = useRef(false);
  const visible = useRef(false);
  const vuelta = useRef(0);
  const firma = JSON.stringify(valor);
  destino.current = valor;

  function arrancar() {
    if (!pendiente.current || !visible.current) return;
    // Aún con lo de antes sin pintar: en cuanto la rueda pueda girar (efecto de abajo).
    if (!girando.current) return;
    pendiente.current = false;
    cancelAnimationFrame(vuelta.current);
    const desde = ahora.current;
    const hasta = destino.current;
    guardar(id, hasta);
    setFinal(hasta);
    const dura = duracionDe(desde, hasta);
    if (!dura) { ahora.current = hasta; setMostrado(hasta); return; }
    const t0 = performance.now();
    const paso = (t) => {
      const f = (t - t0) / dura;
      const v = f >= 1 ? hasta : entre(desde, hasta, frenando(f));
      ahora.current = v;
      setMostrado(v);
      if (f < 1) vuelta.current = requestAnimationFrame(paso);
    };
    vuelta.current = requestAnimationFrame(paso);
  }

  // Antes de pintar: lo último visto (o ceros), para que no se vea el final y luego salte atrás.
  useAntesDePintar(() => {
    if (quieto()) { guardar(id, destino.current); return; }
    const previo = leer(id) ?? ceros(destino.current);
    const inicio = entre(previo, destino.current, 0);
    ahora.current = inicio;
    setMostrado(inicio);
    setFinal(inicio);
    pendiente.current = true;
  }, [id]);

  // Ya pintado lo de antes (sin girar): desde aquí la rueda gira, y si el bloque ya se ve, arranca.
  // En dos tiempos: primero la rueda se entera de que puede girar (un render con el
  // mismo valor) y solo después le llega el nuevo. Los dos en el mismo render y saltaba.
  useEffect(() => {
    const t = setTimeout(() => setGira(true), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!gira) return;
    girando.current = true;
    arrancar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gira]);

  // Se mueve cuando se ve: lo de abajo, al bajar hasta ello.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { visible.current = true; arrancar(); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      if (e.isIntersecting) arrancar();
    }, { threshold: 0.2 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(vuelta.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambió con la pantalla abierta: de lo que se ve a lo nuevo.
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (quieto()) { ahora.current = valor; setMostrado(valor); setFinal(valor); guardar(id, valor); return; }
    pendiente.current = true;
    arrancar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  return [ref, mostrado, final, gira];
}

/**
 * Un bloque que se mueve al verse: `children(aMedioCamino, final, gira)`. Las gráficas
 * usan el primero; las frases, el final; las cifras grandes, `<Rueda valor={final…}
 * gira={gira} />`. Ocupa su hueco de la rejilla entero.
 */
export function Visto({ id, valor, children, style }) {
  const [ref, v, final, gira] = useVisto(id, valor);
  return <div ref={ref} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, ...style }}>{children(v, final, gira)}</div>;
}

/** Un número suelto en una frase («312 clientes») que rueda desde el último que se vio aquí. */
export function NumeroVisto({ id, valor }) {
  const [ref, , final, gira] = useVisto(id, valor);
  return <span ref={ref}><Rueda valor={final} gira={gira} /></span>;
}
