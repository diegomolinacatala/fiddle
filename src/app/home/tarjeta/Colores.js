"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { PALETAS } from "./opciones";

// ----------------------------------------------------------------------------
// Los colores: un rectángulo de bloques pegados que se desliza bajo un marco fijo;
// el bloque del marco es el elegido, mientras se desliza (se ve cambiar la tarjeta
// al pasar el dedo). Con ratón, se arrastra o se usa la rueda; con teclado, las
// flechas.
//
// Da la vuelta: la lista va tres veces seguidas y, en cuanto se para, salta sin que
// se note a la tanda del medio. Solo cuando se para: mover el scroll a mitad de un
// deslizamiento le corta la inercia en iPhone.
// ----------------------------------------------------------------------------
const TANDAS = 3;
const REPOSO = 140; // ms sin moverse para darlo por parado

function Colores({ valor, alCambiar, quieto }) {
  const n = PALETAS.length;
  const fila = useRef(null);
  const porDeslizar = useRef(false); // el cambio vino de deslizar: no recolocar
  const guiado = useRef(false); // va solo hacia un color: los que pasa por el camino no cuentan
  const tocando = useRef(false);
  const montado = useRef(false);
  const arrastre = useRef(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const indice = Math.max(0, PALETAS.findIndex((p) => p.id === valor));
  const bloques = useMemo(() => Array.from({ length: n * TANDAS }, (_, i) => PALETAS[i % n]), [n]);

  const enElCentro = () => {
    const f = fila.current;
    const paso = f?.children[0]?.offsetWidth;
    if (!paso) return 0;
    return Math.max(0, Math.min(n * TANDAS - 1, Math.round((f.scrollLeft + f.clientWidth / 2 - paso / 2) / paso)));
  };

  // true si tenía que moverse.
  const centrar = (i, suave) => {
    const f = fila.current;
    const paso = f?.children[0]?.offsetWidth;
    if (!paso) return false;
    const left = i * paso + paso / 2 - f.clientWidth / 2;
    if (Math.abs(f.scrollLeft - left) < 1) return false;
    const animado = suave && !quieto;
    guiado.current = animado;
    f.scrollTo({ left, behavior: animado ? "smooth" : "auto" });
    return true;
  };

  // De las tres veces que sale un color, la más cercana: nada de cruzar el rectángulo.
  const copiaCercana = (i) => {
    const vuelta = Math.max(0, Math.min(TANDAS - 1, Math.round((enElCentro() - i) / n)));
    return i + vuelta * n;
  };

  useLayoutEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    if (porDeslizar.current) {
      porDeslizar.current = false;
      return;
    }
    centrar(copiaCercana(indice), true);
    // Solo al cambiar desde fuera (un toque, una flecha).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice]);

  useEffect(() => {
    const f = fila.current;
    if (!f) return undefined;
    centrar(n + indice, false);
    let raf = 0;
    let reposo = 0;
    const enReposo = () => {
      guiado.current = false;
      if (arrastre.current || tocando.current) return;
      if (f.classList.contains("sin-iman")) {
        f.classList.remove("sin-iman");
        if (centrar(enElCentro(), true)) return; // al acabar de centrar vuelve a pasar por aquí
      }
      const tanda = f.children[0].offsetWidth * n;
      const c = enElCentro();
      if (c < n) f.scrollLeft += tanda;
      else if (c >= 2 * n) f.scrollLeft -= tanda;
    };
    const alDeslizar = () => {
      clearTimeout(reposo);
      reposo = setTimeout(enReposo, REPOSO);
      if (guiado.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const id = PALETAS[enElCentro() % n].id;
        if (id !== valorRef.current) {
          porDeslizar.current = true;
          alCambiarRef.current(id);
        }
      });
    };
    // La rueda del ratón, de arriba abajo, pasa colores. Sin imán mientras gira: si
    // no, un paso pequeño (el trackpad) vuelve a su bloque y no se mueve nunca.
    const rueda = (ev) => {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
      ev.preventDefault();
      guiado.current = false;
      f.classList.add("sin-iman");
      f.scrollLeft += ev.deltaY;
    };
    const dedoAbajo = () => { tocando.current = true; guiado.current = false; };
    const dedoArriba = () => {
      tocando.current = false;
      clearTimeout(reposo);
      reposo = setTimeout(enReposo, REPOSO);
    };
    f.addEventListener("scroll", alDeslizar, { passive: true });
    f.addEventListener("wheel", rueda, { passive: false });
    f.addEventListener("touchstart", dedoAbajo, { passive: true });
    f.addEventListener("touchend", dedoArriba, { passive: true });
    f.addEventListener("touchcancel", dedoArriba, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(reposo);
      f.removeEventListener("scroll", alDeslizar);
      f.removeEventListener("wheel", rueda);
      f.removeEventListener("touchstart", dedoAbajo);
      f.removeEventListener("touchend", dedoArriba);
      f.removeEventListener("touchcancel", dedoArriba);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrastrar con el ratón (con el dedo ya desliza solo).
  const bajar = (ev) => {
    if (ev.pointerType !== "mouse" || ev.button !== 0) return;
    guiado.current = false;
    arrastre.current = { x: ev.clientX, left: fila.current.scrollLeft, movido: false };
  };
  const mover = (ev) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = ev.clientX - a.x;
    if (Math.abs(dx) > 3 && !a.movido) {
      // Se captura al empezar a arrastrar, no al bajar: si no, el clic de un
      // toque quieto le llegaría a la fila y no al bloque.
      a.movido = true;
      fila.current.classList.add("arrastrando");
      fila.current.setPointerCapture(ev.pointerId);
    }
    if (a.movido) fila.current.scrollLeft = a.left - dx;
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a?.movido) return;
    // Sin imán hasta que llegue: con él, saltaría de golpe en vez de deslizarse.
    fila.current.classList.add("sin-iman");
    fila.current.classList.remove("arrastrando");
    centrar(enElCentro(), true);
    // Que el clic que llega al soltar no elija el bloque de debajo.
    const tragar = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    fila.current.addEventListener("click", tragar, { capture: true, once: true });
    setTimeout(() => fila.current?.removeEventListener("click", tragar, { capture: true }), 0);
  };

  const teclas = (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    const siguiente = (indice + (ev.key === "ArrowRight" ? 1 : -1) + n) % n;
    alCambiar(PALETAS[siguiente].id);
    fila.current?.children[n + siguiente]?.focus({ preventScroll: true });
  };

  return (
    <div className="prob-colores">
      <div
        ref={fila}
        className="prob-colores-fila"
        role="radiogroup"
        aria-label="Colores"
        onKeyDown={teclas}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        {bloques.map((p, i) => {
          // Las otras dos tandas son solo el rectángulo que sigue: para el teclado y
          // el lector de pantalla, los colores están una vez.
          const deVerdad = i >= n && i < 2 * n;
          return (
            <button
              key={i}
              type="button"
              {...(deVerdad ? { role: "radio", "aria-checked": p.id === valor, "aria-label": p.nombre } : { "aria-hidden": true })}
              tabIndex={deVerdad && p.id === valor ? 0 : -1}
              className="prob-muestra"
              onClick={() => alCambiar(p.id)}
              style={{ "--fondo": p.cardBg }}
            />
          );
        })}
      </div>
      <span className="prob-colores-marco" aria-hidden="true" />
    </div>
  );
}

export default Colores;
