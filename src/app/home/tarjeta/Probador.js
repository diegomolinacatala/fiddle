"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import CaraDelPase from "@/app/CaraDelPase";
import { LogoApple } from "@/app/LogoTienda";
import LogoFiddle from "@/app/LogoFiddle";
import { stripDelPase, comoDataUri, colorDelPase, svgCasilla } from "@/lib/apple/dibujo";
import { enlaceWhatsApp } from "../datos";
import { PALETA } from "../paleta";
import {
  PALETAS, ICONOS, MODOS, FORMAS, FONDOS, PREMIOS, METAS, SECCIONES, INICIAL, MAX_NOMBRE, NOMBRE_POR_DEFECTO,
  limpiar, temaDe, tarjetaDe, sumarPunto, mensajeDe, encuadre, regionDe,
} from "./opciones";
import { css } from "./estilo";

// ============================================================================
// «DISEÑA TU TARJETA» (/home/tarjeta)
// ----------------------------------------------------------------------------
// Una tarjeta en el centro que se inclina siguiendo el ratón (o el dedo) y una
// cámara que se acerca a la parte que se está tocando: el color, la tarjeta
// entera; el nombre, la cabecera; los puntos, la banda; el premio, sus campos.
//
// - La tarjeta es CaraDelPase con lo elegido (opciones.js → ejemplo de demo.js):
//   lo que se ve es lo que saldría en el Wallet.
// - La inclinación NO pasa por React: un bucle de requestAnimationFrame escribe
//   el transform y unas variables CSS (brillo y sombra) con un muelle suave, y se
//   duerme cuando la tarjeta ya está quieta o la pestaña no se ve. Sin el ratón
//   encima, la tarjeta flota sola, muy poco.
// - El encuadre es un transform con transición (CSS): mide las partes de verdad
//   (`data-parte` de CaraDelPase) y encuadre() decide escala y desplazamiento.
// - Cada cambio entra como una capa nueva encima de la anterior, que se funde:
//   el color de la tarjeta y su banda (una imagen) cambian a la vez, sin saltos.
// - Con «reducir movimiento», ni se inclina ni flota y la cámara salta sin
//   animar.
// ============================================================================

const INCLINA = 9; // grados, con la tarjeta entera
const INCLINA_CERCA = 4.5; // al acercarse, menos: que se lea
const CAPAS_MAX = 3;
const FUNDIDO = 480; // ms; lo mismo que la animación de entrada en estilo.js
const ARRASTRE = 6; // px de dedo o ratón a partir de los que no es un toque

// Tocar una parte de la tarjeta lleva a su sección.
const SECCION_DE_PARTE = { cabecera: "nombre", banda: "puntos", campos: "premio" };

export default function Probador({ qr }) {
  const [eleccion, setEleccion] = useState(INICIAL);
  const [seccion, setSeccion] = useState(0);
  const [sentido, setSentido] = useState(1);
  const quieto = useReducirMovimiento();

  const e = limpiar(eleccion);
  const cambiar = (cambios) => setEleccion((a) => limpiar({ ...a, ...cambios }));
  const ir = (i) => {
    const n = Math.max(0, Math.min(SECCIONES.length - 1, i));
    setSentido(n >= seccion ? 1 : -1);
    setSeccion(n);
  };

  // ---- capas: lo de antes se queda debajo mientras lo nuevo entra fundido.
  // El nombre no hace capa (se escribe letra a letra): se cambia en todas.
  const llave = JSON.stringify({ ...e, nombre: "" });
  const [capas, setCapas] = useState(() => [{ id: 0, llave, eleccion: e }]);
  const siguienteId = useRef(1);
  useEffect(() => {
    setCapas((cs) => {
      if (cs[cs.length - 1].llave === llave) return cs;
      return [...cs, { id: siguienteId.current++, llave, eleccion: e }].slice(-CAPAS_MAX);
    });
    const t = setTimeout(() => setCapas((cs) => (cs.length > 1 ? cs.slice(-1) : cs)), FUNDIDO + 60);
    return () => clearTimeout(t);
    // `e` sale de `llave`: con la llave basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llave]);

  const tema = temaDe(e);
  const tinta = colorDelPase(tema);

  // ---- la cámara
  const escena = useRef(null);
  const inclina = useRef(null);
  const zoom = useRef(null);
  const capaArriba = useRef(null);
  const cerca = useRef(false);
  const [camara, setCamara] = useState({ s: 1, y: 0 });
  const parte = SECCIONES[seccion].parte;

  useLayoutEffect(() => {
    const medir = () => {
      const art = capaArriba.current?.querySelector("article");
      const caja = escena.current?.getBoundingClientRect();
      if (!art || !caja) return;
      const medidas = {};
      for (const el of art.querySelectorAll("[data-parte]")) medidas[el.dataset.parte] = { top: el.offsetTop, height: el.offsetHeight };
      // En el móvil la escena deja sitio arriba a los botones (su padding): la
      // tarjeta se centra en lo que queda.
      const arriba = parseFloat(getComputedStyle(escena.current).paddingTop) || 0;
      const c = encuadre(regionDe(parte, medidas), { w: art.offsetWidth, h: art.offsetHeight }, { w: caja.width, h: caja.height - arriba });
      cerca.current = parte !== "todo";
      setCamara((a) => (a.s === c.s && a.y === c.y ? a : c));
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (escena.current) obs.observe(escena.current);
    if (capaArriba.current) obs.observe(capaArriba.current);
    return () => obs.disconnect();
  }, [parte, capas]);

  useInclinacion({ escena, inclina, cerca, quieto });

  // ---- tocar una parte de la tarjeta (sin arrastrar) lleva a su sección
  const toque = useRef(null);
  const alSoltar = (ev) => {
    const t = toque.current;
    toque.current = null;
    if (!t || Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > ARRASTRE) return;
    const p = ev.target.closest?.("[data-parte]")?.dataset.parte;
    const id = SECCION_DE_PARTE[p];
    if (id) ir(SECCIONES.findIndex((s) => s.id === id));
  };

  // ---- «Sumar punto»: la tarjeta da un latido (sin volver a montarla)
  const tarjetaEl = useRef(null);
  const sumar = () => {
    cambiar({ puntos: sumarPunto(e.puntos, e.meta) });
    if (!quieto) {
      tarjetaEl.current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.035)" }, { transform: "scale(1)" }],
        { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  };

  const actual = SECCIONES[seccion];
  const ultima = seccion === SECCIONES.length - 1;
  const whatsapp = enlaceWhatsApp(mensajeDe(e));

  return (
    <div className={`prob${quieto ? " prob-quieto" : ""}`} style={{ "--tono": tema.accent, "--tono-2": tema.cardBg }}>
      <style>{css}</style>

      <header className="prob-arriba">
        <a href="/home" className="prob-volver" aria-label="Volver a la web de fiddle">
          <Flecha atras />
          <LogoFiddle tam={24} color={PALETA.verde} id="efe-probador" />
        </a>
        <a href={whatsapp} className="prob-quiero" target="_blank" rel="noopener noreferrer">
          La quiero así
        </a>
      </header>

      <div className="prob-halo" aria-hidden="true" />
      <main className="prob-escena" ref={escena} aria-label="Vista previa de tu tarjeta">
        <div className="prob-inclina" ref={inclina}>
          <div
            className="prob-zoom"
            ref={zoom}
            style={{ transform: `translate3d(0, ${camara.y}px, 0) scale(${camara.s})` }}
            onPointerDown={(ev) => { toque.current = { x: ev.clientX, y: ev.clientY }; }}
            onPointerUp={alSoltar}
            onPointerCancel={() => { toque.current = null; }}
          >
            <div ref={tarjetaEl} className="prob-tarjeta">
              <div className="prob-sombra" aria-hidden="true" />
              <div className="prob-capas">
                {capas.map((c, i) => {
                  const arriba = i === capas.length - 1;
                  const { negocio, cliente } = tarjetaDe({ ...c.eleccion, nombre: e.nombre });
                  return (
                    <div key={c.id} ref={arriba ? capaArriba : undefined} className={`prob-capa${c.id ? " entra" : ""}`} aria-hidden={!arriba}>
                      <CaraDelPase cliente={cliente} negocio={negocio}>
                        <div className="prob-qr">
                          <img src={qr} alt="" width={112} height={112} />
                          <span>{cliente.codigo}</span>
                        </div>
                      </CaraDelPase>
                    </div>
                  );
                })}
              </div>
              <div className="prob-brillo" aria-hidden="true" />
            </div>
          </div>
        </div>
      </main>

      <aside className="prob-panel" aria-label="Diseña tu tarjeta">
        <Solapas actual={seccion} alElegir={ir} />

        <div className="prob-marco">
          <section key={actual.id} className={`prob-seccion ${sentido > 0 ? "desde-dcha" : "desde-izda"}`} aria-labelledby="prob-titulo">
            <div className="prob-cabeza">
              <h1 id="prob-titulo">{actual.nombre}</h1>
              <p>{actual.pista}</p>
            </div>

            {actual.id === "color" && (
              <>
                <Colores valor={e.paleta} alCambiar={(paleta) => cambiar({ paleta })} quieto={quieto} />
                <Grupo titulo="Fondo de la banda">
                  <Segmentos opciones={FONDOS} valor={e.fondo} alCambiar={(fondo) => cambiar({ fondo })} />
                </Grupo>
              </>
            )}

            {actual.id === "nombre" && (
              <label className="prob-nombre">
                <span className="prob-oculto">El nombre de tu cafetería</span>
                <input
                  value={eleccion.nombre}
                  onChange={(ev) => setEleccion((a) => ({ ...a, nombre: ev.target.value.slice(0, MAX_NOMBRE) }))}
                  placeholder={NOMBRE_POR_DEFECTO}
                  maxLength={MAX_NOMBRE}
                  autoComplete="organization"
                  enterKeyHint="next"
                  onKeyDown={(ev) => ev.key === "Enter" && ir(seccion + 1)}
                />
                <span className="prob-cuenta">{eleccion.nombre.length}/{MAX_NOMBRE}</span>
              </label>
            )}

            {actual.id === "icono" && (
              <div className="prob-rejilla prob-iconos" role="radiogroup" aria-label="Icono">
                {ICONOS.map((ic) => (
                  <Opcion key={ic.id} activa={e.icono === ic.id} alElegir={() => cambiar({ icono: ic.id })} etiqueta={ic.nombre}>
                    <span className="prob-icono" style={{ background: tema.cardBg }}>
                      <LogoApple tema={{ ...tema, marca: ic.id }} tam={34} />
                    </span>
                  </Opcion>
                ))}
              </div>
            )}

            {actual.id === "puntos" && (
              <>
                <Modos eleccion={e} alCambiar={(modo) => cambiar({ modo })} />
                {e.modo === "casillas" && (
                  <Grupo titulo="Forma de cada punto">
                    <div className="prob-formas" role="radiogroup" aria-label="Forma de cada punto">
                      {FORMAS.map((f) => (
                        <Opcion key={f.id} activa={e.forma === f.id} alElegir={() => cambiar({ forma: f.id })} etiqueta={f.nombre} sinTexto>
                          <FormaMini forma={f.id} color={tinta} />
                        </Opcion>
                      ))}
                    </div>
                  </Grupo>
                )}
                <Grupo titulo="Puntos para el premio">
                  <div className="prob-fila">
                    <Segmentos opciones={METAS.map((m) => ({ id: m, nombre: String(m) }))} valor={e.meta} alCambiar={(meta) => cambiar({ meta })} />
                    <button type="button" className="prob-sumar" onClick={sumar}>
                      <Mas /> Sumar punto
                    </button>
                  </div>
                </Grupo>
              </>
            )}

            {actual.id === "premio" && (
              <div className="prob-chips" role="radiogroup" aria-label="Premio">
                {PREMIOS.map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={e.premio === p} className="prob-chip" onClick={() => cambiar({ premio: p })}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="prob-pie">
          <button type="button" className="prob-atras" onClick={() => ir(seccion - 1)} disabled={seccion === 0} aria-label="Sección anterior">
            <Flecha atras />
          </button>
          <span className="prob-paso" aria-hidden="true">
            {SECCIONES.map((s, i) => <i key={s.id} className={i === seccion ? "activo" : i < seccion ? "hecho" : ""} />)}
          </span>
          {ultima ? (
            <a href={whatsapp} className="prob-siguiente" target="_blank" rel="noopener noreferrer">
              Quiero esta tarjeta
            </a>
          ) : (
            <button type="button" className="prob-siguiente" onClick={() => ir(seccion + 1)}>
              {SECCIONES[seccion + 1].nombre} <Flecha />
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------------
// La inclinación: un muelle hacia donde apunta el ratón (o hacia donde arrastra
// el dedo) y, sin nadie encima, una deriva lenta. Todo por transform y variables
// CSS, sin pasar por React.
// ----------------------------------------------------------------------------
function useInclinacion({ escena, inclina, cerca, quieto }) {
  useEffect(() => {
    const raiz = escena.current;
    const el = inclina.current;
    if (!raiz || !el) return undefined;
    if (quieto) {
      el.style.transform = "";
      return undefined;
    }

    const objetivo = { x: 0, y: 0 };
    const ahora = { x: 0, y: 0, amp: INCLINA };
    let encima = false; // ratón dentro, o dedo arrastrando
    let dedo = null;
    let raf = 0;
    let antes = 0;

    const pintar = () => {
      const { x, y, amp } = ahora;
      el.style.transform = `rotateX(${(-y * amp).toFixed(3)}deg) rotateY(${(x * amp).toFixed(3)}deg)`;
      el.style.setProperty("--bx", `${(50 + x * 42).toFixed(2)}%`);
      el.style.setProperty("--by", `${(38 + y * 38).toFixed(2)}%`);
      el.style.setProperty("--sx", `${(-x * 16).toFixed(2)}px`);
      el.style.setProperty("--sy", `${(-y * 10).toFixed(2)}px`);
      el.style.setProperty("--brillo", (0.55 + Math.hypot(x, y) * 0.45).toFixed(3));
    };

    const paso = (t) => {
      const dt = antes ? Math.min(64, t - antes) : 16;
      antes = t;
      // Sin nadie encima, flota: dos senos lentos que no se repiten a la vista.
      const tx = encima ? objetivo.x : Math.sin(t / 2600) * 0.32;
      const ty = encima ? objetivo.y : Math.cos(t / 3400) * 0.22;
      const k = 1 - Math.exp(-dt / (encima ? 120 : 520));
      ahora.x += (tx - ahora.x) * k;
      ahora.y += (ty - ahora.y) * k;
      ahora.amp += ((cerca.current ? INCLINA_CERCA : INCLINA) - ahora.amp) * (1 - Math.exp(-dt / 300));
      pintar();
      raf = requestAnimationFrame(paso);
    };
    const arrancar = () => {
      if (!raf && document.visibilityState === "visible") {
        antes = 0;
        raf = requestAnimationFrame(paso);
      }
    };
    const parar = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const hacia = (cx, cy) => {
      const c = raiz.getBoundingClientRect();
      objetivo.x = Math.max(-1, Math.min(1, (cx - (c.left + c.width / 2)) / (c.width / 2)));
      objetivo.y = Math.max(-1, Math.min(1, (cy - (c.top + c.height / 2)) / (c.height / 2)));
    };

    const mover = (ev) => {
      if (ev.pointerType === "mouse") {
        const c = raiz.getBoundingClientRect();
        encima = ev.clientX >= c.left && ev.clientX <= c.right && ev.clientY >= c.top && ev.clientY <= c.bottom;
        if (encima) hacia(ev.clientX, ev.clientY);
      } else if (dedo && ev.pointerId === dedo.id) {
        // Con el dedo, se inclina hacia donde arrastra (un toque no la mueve).
        objetivo.x = Math.max(-1, Math.min(1, (ev.clientX - dedo.x) / 110));
        objetivo.y = Math.max(-1, Math.min(1, (ev.clientY - dedo.y) / 110));
        encima = true;
      }
    };
    const bajar = (ev) => {
      if (ev.pointerType !== "mouse") dedo = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    };
    const soltar = (ev) => {
      if (dedo && ev.pointerId === dedo.id) {
        dedo = null;
        encima = false;
      }
    };
    const salir = () => { encima = false; };
    const visibilidad = () => (document.visibilityState === "visible" ? arrancar() : parar());

    window.addEventListener("pointermove", mover, { passive: true });
    raiz.addEventListener("pointerdown", bajar, { passive: true });
    window.addEventListener("pointerup", soltar, { passive: true });
    window.addEventListener("pointercancel", soltar, { passive: true });
    document.documentElement.addEventListener("pointerleave", salir);
    document.addEventListener("visibilitychange", visibilidad);
    arrancar();
    return () => {
      parar();
      window.removeEventListener("pointermove", mover);
      raiz.removeEventListener("pointerdown", bajar);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      document.documentElement.removeEventListener("pointerleave", salir);
      document.removeEventListener("visibilitychange", visibilidad);
    };
  }, [escena, inclina, cerca, quieto]);
}

function useReducirMovimiento() {
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mirar = () => setQuieto(mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => mq.removeEventListener("change", mirar);
  }, []);
  return quieto;
}

// ----------------------------------------------------------------------------
// Las pestañas de arriba del panel, con una píldora que se desliza a la elegida.
// ----------------------------------------------------------------------------
function Solapas({ actual, alElegir }) {
  const fila = useRef(null);
  const [pildora, setPildora] = useState(null);
  useLayoutEffect(() => {
    const medir = () => {
      const b = fila.current?.children[actual];
      if (b) setPildora({ left: b.offsetLeft, width: b.offsetWidth });
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (fila.current) obs.observe(fila.current);
    return () => obs.disconnect();
  }, [actual]);

  const teclas = (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      const n = (actual + (ev.key === "ArrowRight" ? 1 : -1) + SECCIONES.length) % SECCIONES.length;
      alElegir(n);
      fila.current?.children[n]?.focus();
    }
  };

  return (
    <div className="prob-solapas">
      <div ref={fila} className="prob-solapas-fila" role="tablist" aria-label="Partes de la tarjeta" onKeyDown={teclas}>
        {SECCIONES.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={i === actual} tabIndex={i === actual ? 0 : -1} onClick={() => alElegir(i)}>
            {s.nombre}
          </button>
        ))}
      </div>
      {pildora && <span className="prob-pildora" style={{ transform: `translateX(${pildora.left}px)`, width: pildora.width }} aria-hidden="true" />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Los colores: una fila que se desliza y el del centro es el elegido, mientras se
// desliza (se ve cambiar la tarjeta al pasar el dedo). Con ratón, se arrastra o
// se usa la rueda; con teclado, las flechas.
// ----------------------------------------------------------------------------
function Colores({ valor, alCambiar, quieto }) {
  const fila = useRef(null);
  const porDeslizar = useRef(false); // el cambio vino de deslizar: no recolocar
  const montado = useRef(false);
  const arrastre = useRef(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const elegido = PALETAS.find((p) => p.id === valor) || PALETAS[0];
  const indice = PALETAS.indexOf(elegido);

  const centrar = (i, suave) => {
    const f = fila.current;
    const b = f?.children[i];
    if (!f || !b) return;
    f.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - f.clientWidth / 2, behavior: suave && !quieto ? "smooth" : "auto" });
  };

  // Cuánto se aleja cada muestra del centro, para que encojan hacia los lados.
  const marcar = () => {
    const f = fila.current;
    if (!f) return -1;
    const centro = f.scrollLeft + f.clientWidth / 2;
    let mejor = 0;
    let menor = Infinity;
    [...f.children].forEach((b, i) => {
      const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - centro);
      b.style.setProperty("--d", Math.min(1, d / (f.clientWidth / 2)).toFixed(3));
      if (d < menor) { menor = d; mejor = i; }
    });
    return mejor;
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
    centrar(indice, true);
    // Solo al cambiar desde fuera (un toque, una flecha).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice]);

  useEffect(() => {
    const f = fila.current;
    if (!f) return undefined;
    centrar(indice, false);
    marcar();
    let raf = 0;
    const alDeslizar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = marcar();
        if (i >= 0 && PALETAS[i].id !== valorRef.current) {
          porDeslizar.current = true;
          alCambiarRef.current(PALETAS[i].id);
        }
      });
    };
    // La rueda del ratón, de arriba abajo, pasa colores.
    const rueda = (ev) => {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
      ev.preventDefault();
      f.scrollLeft += ev.deltaY;
    };
    f.addEventListener("scroll", alDeslizar, { passive: true });
    f.addEventListener("wheel", rueda, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      f.removeEventListener("scroll", alDeslizar);
      f.removeEventListener("wheel", rueda);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrastrar con el ratón (con el dedo ya desliza solo).
  const bajar = (ev) => {
    if (ev.pointerType !== "mouse" || ev.button !== 0) return;
    arrastre.current = { x: ev.clientX, left: fila.current.scrollLeft, movido: false };
  };
  const mover = (ev) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = ev.clientX - a.x;
    if (Math.abs(dx) > 3 && !a.movido) {
      // Se captura al empezar a arrastrar, no al bajar: si no, el clic de un
      // toque quieto le llegaría a la fila y no a la muestra.
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
    fila.current.classList.remove("arrastrando");
    centrar(marcar(), true);
    // Que el clic que llega al soltar no elija la muestra de debajo.
    const tragar = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    fila.current.addEventListener("click", tragar, { capture: true, once: true });
    setTimeout(() => fila.current?.removeEventListener("click", tragar, { capture: true }), 0);
  };

  const teclas = (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    const n = Math.max(0, Math.min(PALETAS.length - 1, indice + (ev.key === "ArrowRight" ? 1 : -1)));
    alCambiar(PALETAS[n].id);
    fila.current?.children[n]?.focus({ preventScroll: true });
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
        {PALETAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === valor}
            aria-label={p.nombre}
            tabIndex={p.id === valor ? 0 : -1}
            className="prob-muestra"
            onClick={() => alCambiar(p.id)}
            style={{ "--fondo": p.cardBg, "--tinta": p.detalle || p.accent }}
          >
            <i />
          </button>
        ))}
      </div>
      <div className="prob-colores-nombre" aria-live="polite">
        <span key={elegido.id}>{elegido.nombre}</span>
      </div>
    </div>
  );
}

// Cada forma de contar, con su banda de verdad en pequeño.
function Modos({ eleccion, alCambiar }) {
  const { paleta, icono, forma, fondo } = eleccion;
  const bandas = useMemo(
    () => Object.fromEntries(MODOS.map((m) => {
      const { negocio, cliente } = tarjetaDe({ paleta, icono, forma, fondo, modo: m.id, meta: 8, puntos: 5 });
      return [m.id, comoDataUri(stripDelPase(negocio, cliente).svg)];
    })),
    [paleta, icono, forma, fondo],
  );
  return (
    <div className="prob-rejilla prob-modos" role="radiogroup" aria-label="Cómo se cuentan los puntos">
      {MODOS.map((m) => (
        <Opcion key={m.id} activa={eleccion.modo === m.id} alElegir={() => alCambiar(m.id)} etiqueta={m.nombre}>
          <img src={bandas[m.id]} alt="" className="prob-modo-banda" />
        </Opcion>
      ))}
    </div>
  );
}

function Opcion({ activa, alElegir, etiqueta, sinTexto = false, children }) {
  return (
    <button type="button" role="radio" aria-checked={activa} aria-label={sinTexto ? etiqueta : undefined} className="prob-opcion" onClick={alElegir}>
      {children}
      {!sinTexto && <span className="prob-opcion-texto">{etiqueta}</span>}
    </button>
  );
}

function Segmentos({ opciones, valor, alCambiar }) {
  const i = Math.max(0, opciones.findIndex((o) => o.id === valor));
  return (
    <div className="prob-segmentos" role="radiogroup" style={{ "--n": opciones.length, "--i": i }}>
      <span className="prob-segmentos-pildora" aria-hidden="true" />
      {opciones.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === valor} onClick={() => alCambiar(o.id)}>
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div className="prob-grupo">
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}

function FormaMini({ forma, color }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">${svgCasilla(forma, 20, 20, 26, `fill="${color}"`)}</svg>`;
  return <img src={comoDataUri(svg)} alt="" width={28} height={28} />;
}

const Flecha = ({ atras = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={atras ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const Mas = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
