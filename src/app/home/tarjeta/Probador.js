"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import CaraDelPase from "@/app/CaraDelPase";
import { LogoApple } from "@/app/LogoTienda";
import LogoFiddle from "@/app/LogoFiddle";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { WALLET } from "@/lib/vistaWallet";
import { leerContactos, MAX_CONTACTO } from "@/lib/interesados";
import { PALETA } from "../paleta";
import {
  PALETAS, ICONOS, MODOS, MODOS_DOS, FONDOS, NUMEROS, SECCIONES, INICIAL, MAX_NOMBRE, NOMBRE_POR_DEFECTO,
  limpiar, temaDe, tarjetaDe, encuadre, regionDe,
} from "./opciones";
import { css } from "./estilo";

// ============================================================================
// «DISEÑA TU TARJETA» (/home/tarjeta)
// ----------------------------------------------------------------------------
// Una tarjeta en el centro que se inclina siguiendo el ratón (o el dedo) y una
// cámara que se acerca a la parte que se está tocando. Cada paso se contesta de
// un toque y pasa solo al siguiente: tiene que ser rápido y divertido. Solo llevan
// botón el color (se desliza) y el nombre (se escribe). Al final, un email, un
// teléfono o los dos guardan la tarjeta y nos llega a /admin → Interesados.
//
// Guardada, el probador se cierra: el panel entero (pestañas, flecha de atrás,
// pasos) da paso a «Tarjeta guardada» y la tarjeta ya no lleva a ningún paso. Si
// no, se volvía atrás y se mandaba otra vez, una por cada vuelta.
//
// - La tarjeta es CaraDelPase con lo elegido (opciones.js → ejemplo de demo.js):
//   lo que se ve es lo que saldría en el Wallet.
// - La inclinación NO pasa por React: un bucle de requestAnimationFrame escribe
//   el transform y unas variables CSS (brillo y sombra) con un muelle suave, y se
//   duerme cuando la pestaña no se ve. Sin el ratón encima, flota sola, muy poco.
// - El encuadre es un transform con transición (CSS): mide las partes de verdad
//   (`data-parte` de CaraDelPase) y encuadre() decide escala y desplazamiento.
// - La tarjeta se pinta al doble de su tamaño (RESOLUCION, `zoom` en estilo.js) y
//   la cámara la encoge: un transform agranda lo ya pintado y al acercarse se
//   vería borrosa, banda incluida.
// - Cada cambio entra como una capa nueva encima de la anterior, que se funde. La
//   sombra es UNA, fuera de las capas: con una por capa se sumaban mientras había
//   dos y, al quitar la vieja, la sombra saltaba de golpe.
// - Con «reducir movimiento», ni se inclina ni flota y la cámara salta sin animar.
// ============================================================================

const INCLINA = 9; // grados, con la tarjeta entera
const INCLINA_CERCA = 4.5; // al acercarse, menos: que se lea
const CAPAS_MAX = 3;
const FUNDIDO = 480; // ms; lo mismo que la animación de entrada en estilo.js
const ARRASTRE = 6; // px de dedo o ratón a partir de los que no es un toque
const RESOLUCION = 2; // el `zoom` de .prob-tarjeta en estilo.js
const PAUSA_AL_ELEGIR = 280; // ms: lo justo para ver el cambio en la tarjeta antes de seguir

// Tocar una parte de la tarjeta lleva a su paso.
const SECCION_DE_PARTE = { cabecera: "nombre", banda: "puntos", campos: "icono" };

export default function Probador({ qr }) {
  const [eleccion, setEleccion] = useState(INICIAL);
  const [seccion, setSeccion] = useState(0);
  const [sentido, setSentido] = useState(1);
  const [hueco, setHueco] = useState(0); // con dos premios, de qué premio se elige el icono
  const [enviada, setEnviada] = useState(null); // { email, telefono } al guardarla: ya no se edita
  const quieto = useReducirMovimiento();

  const e = limpiar(eleccion);
  const cambiar = (cambios) => setEleccion((a) => limpiar({ ...a, ...cambios }));

  const espera = useRef(0);
  useEffect(() => () => clearTimeout(espera.current), []);
  const ir = (i) => {
    clearTimeout(espera.current);
    const n = Math.max(0, Math.min(SECCIONES.length - 1, i));
    setSentido(n >= seccion ? 1 : -1);
    setSeccion(n);
    setHueco(0);
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

  // ---- la cámara
  const escena = useRef(null);
  const inclina = useRef(null);
  const zoom = useRef(null);
  const capaArriba = useRef(null);
  const cerca = useRef(false);
  const [camara, setCamara] = useState({ s: 1, y: 0 });
  const parte = enviada ? "todo" : SECCIONES[seccion].parte;

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
      setCamara((a) => (a.s === c.s && a.y === c.y ? a : c));
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (escena.current) obs.observe(escena.current);
    if (capaArriba.current) obs.observe(capaArriba.current);
    return () => obs.disconnect();
  }, [parte, capas]);

  useInclinacion({ escena, inclina, cerca, quieto });

  // ---- tocar una parte de la tarjeta (sin arrastrar) lleva a su paso
  const toque = useRef(null);
  const alSoltar = (ev) => {
    const t = toque.current;
    toque.current = null;
    if (enviada || !t || Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > ARRASTRE) return;
    const p = ev.target.closest?.("[data-parte]")?.dataset.parte;
    const id = SECCION_DE_PARTE[p];
    if (id) ir(SECCIONES.findIndex((s) => s.id === id));
  };

  // ---- al elegir, la tarjeta da un latido (sin volver a montarla) y se sigue solo
  const tarjetaEl = useRef(null);
  const latido = () => {
    if (quieto) return;
    tarjetaEl.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.035)" }, { transform: "scale(1)" }],
      { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  };
  const elegirYSeguir = (cambios) => {
    cambiar(cambios);
    latido();
    clearTimeout(espera.current);
    espera.current = setTimeout(() => ir(seccion + 1), quieto ? 0 : PAUSA_AL_ELEGIR);
  };
  const elegirIcono = (id) => {
    if (e.cartillas === 2 && hueco === 0) {
      cambiar({ icono: id });
      latido();
      setHueco(1);
      return;
    }
    elegirYSeguir(hueco === 0 ? { icono: id } : { icono2: id });
  };

  const actual = SECCIONES[seccion];
  const ultima = seccion === SECCIONES.length - 1;
  const iconoDe = hueco === 0 ? e.icono : e.icono2;

  return (
    <div className={`prob${quieto ? " prob-quieto" : ""}${enviada ? " prob-cerrado" : ""}`} style={{ "--tono": tema.accent, "--tono-2": tema.cardBg }}>
      <style>{css}</style>

      <header className="prob-arriba">
        <a href="/home" className="prob-volver" aria-label="Volver a la web de fiddle">
          <Flecha atras />
          <LogoFiddle tam={24} color={PALETA.verde} id="efe-probador" />
        </a>
      </header>

      <div className="prob-halo" aria-hidden="true" />
      <main className="prob-escena" ref={escena} aria-label="Vista previa de tu tarjeta">
        <div className="prob-inclina" ref={inclina}>
          <div
            className="prob-zoom"
            ref={zoom}
            style={{ transform: `translate3d(0, ${camara.y}px, 0) scale(${camara.s / RESOLUCION})` }}
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
                      <CaraDelPase cliente={cliente} negocio={negocio} qr={{ src: qr, codigo: cliente.codigo }} />
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
        {enviada ? <Enviada {...enviada} /> : (
          <>
            <Solapas actual={seccion} alElegir={ir} />

            <div className="prob-marco">
              <section key={`${actual.id}-${hueco}`} className={`prob-seccion ${sentido > 0 ? "desde-dcha" : "desde-izda"}`} aria-labelledby="prob-titulo">
                <div className="prob-cabeza">
                  <h1 id="prob-titulo">{actual.id === "icono" && e.cartillas === 2 ? (hueco === 0 ? "El primer premio" : "Y el segundo") : actual.titulo}</h1>
                  <p>{actual.pista}</p>
                </div>

                {actual.id === "cuantas" && (
                  <div className="prob-cuantas" role="radiogroup" aria-label="Cuántos premios">
                    {[1, 2].map((n) => {
                      const { negocio, cliente } = tarjetaDe({ ...e, cartillas: n, modo: "relleno" });
                      return (
                        <Opcion key={n} activa={e.cartillas === n} alElegir={() => elegirYSeguir({ cartillas: n })} etiqueta={n === 1 ? "Un premio" : "Dos premios"}>
                          <span className="prob-foto" aria-hidden="true"><CaraDelPase cliente={cliente} negocio={negocio} /></span>
                        </Opcion>
                      );
                    })}
                  </div>
                )}

                {actual.id === "puntos" && <Modos eleccion={e} alElegir={(modo) => elegirYSeguir({ modo })} />}

                {actual.id === "color" && (
                  <>
                    <Colores valor={e.paleta} alCambiar={(paleta) => cambiar({ paleta })} quieto={quieto} />
                    <Grupo titulo="Fondo de la banda">
                      <Segmentos opciones={FONDOS} valor={e.fondo} alCambiar={(fondo) => cambiar({ fondo })} />
                    </Grupo>
                    {e.modo !== "casillas" && (
                      <Grupo titulo="Números">
                        <Segmentos opciones={NUMEROS} valor={e.cifras} alCambiar={(cifras) => cambiar({ cifras })} />
                      </Grupo>
                    )}
                  </>
                )}

                {actual.id === "icono" && (
                  <div className="prob-rejilla prob-iconos" role="radiogroup" aria-label="Icono">
                    {ICONOS.filter((ic) => hueco === 0 || ic.id !== e.icono).map((ic) => (
                      <Opcion key={ic.id} activa={iconoDe === ic.id} alElegir={() => elegirIcono(ic.id)} etiqueta={ic.nombre}>
                        <span className="prob-icono" style={{ background: tema.cardBg }}>
                          <LogoApple tema={{ ...tema, marca: ic.id }} tam={34} />
                        </span>
                      </Opcion>
                    ))}
                  </div>
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

                {actual.id === "guardar" && <Guardar eleccion={e} alGuardar={(contacto) => { setEnviada(contacto); latido(); }} />}
              </section>
            </div>

            <footer className="prob-pie">
              <button type="button" className="prob-atras" onClick={() => ir(seccion - 1)} disabled={seccion === 0} aria-label="Paso anterior">
                <Flecha atras />
              </button>
              <span className="prob-paso" aria-hidden="true">
                {SECCIONES.map((s, i) => <i key={s.id} className={i === seccion ? "activo" : i < seccion ? "hecho" : ""} />)}
              </span>
              {actual.boton && !ultima ? (
                <button type="button" className="prob-siguiente" onClick={() => ir(seccion + 1)}>
                  {SECCIONES[seccion + 1].nombre} <Flecha />
                </button>
              ) : <span className="prob-sin-boton" aria-hidden="true" />}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------------
// El último paso: un email, un teléfono o los dos, sin verificar (con uno basta).
// Guarda lo elegido y nos lo enseña en /admin. Lo que se dice aquí tiene que ser
// verdad de lo que se hace.
// ----------------------------------------------------------------------------
const NO_SE_GUARDO = "No se ha podido guardar. Prueba otra vez.";

function Guardar({ eleccion, alGuardar }) {
  const [campos, setCampos] = useState({ email: "", telefono: "" });
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState({}); // { email, telefono, ninguno, servidor }
  const refs = { email: useRef(null), telefono: useRef(null) };

  const escribir = (campo) => (ev) => {
    const valor = ev.target.value;
    setCampos((c) => ({ ...c, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined, ninguno: undefined, servidor: undefined }));
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    const { email, telefono, errores: mal } = leerContactos(campos);
    if (mal) {
      setErrores(mal);
      refs[mal.email || mal.ninguno ? "email" : "telefono"].current?.focus();
      return;
    }
    setEnviando(true);
    setErrores({});
    try {
      const r = await fetch("/api/interesados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, telefono, eleccion }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || NO_SE_GUARDO);
      // Sin volver a poner `enviando` a false: este formulario ya no se vuelve a ver.
      alGuardar({ email, telefono });
    } catch (err) {
      setErrores({ servidor: err.message || NO_SE_GUARDO });
      setEnviando(false);
    }
  };

  const campo = (id, etiqueta, extra) => (
    <div className="prob-campo">
      <label className="prob-nombre prob-contacto">
        <span className="prob-oculto">{etiqueta}</span>
        <input
          ref={refs[id]}
          value={campos[id]}
          onChange={escribir(id)}
          placeholder={etiqueta}
          maxLength={MAX_CONTACTO}
          enterKeyHint="send"
          aria-invalid={Boolean(errores[id] || errores.ninguno)}
          aria-describedby={errores[id] ? `prob-error-${id}` : errores.ninguno ? "prob-error-ninguno" : undefined}
          {...extra}
        />
      </label>
      {errores[id] && <p id={`prob-error-${id}`} className="prob-error" role="alert">{errores[id]}</p>}
    </div>
  );

  return (
    <form className="prob-guardar" onSubmit={enviar} noValidate>
      {campo("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false })}
      {campo("telefono", "Teléfono", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
      {errores.ninguno && <p id="prob-error-ninguno" className="prob-error" role="alert">{errores.ninguno}</p>}
      {errores.servidor && <p className="prob-error" role="alert">{errores.servidor}</p>}
      <button type="submit" className="prob-siguiente prob-ancho" disabled={enviando} aria-busy={enviando || undefined}>
        {enviando ? "Guardando…" : "Guardar mi tarjeta"}
      </button>
      <p className="prob-legal">
        Lo usamos solo para hablarte de tu tarjeta. Si cambias de idea, escríbenos y lo borramos. <a href="/privacidad">Privacidad</a>
      </p>
    </form>
  );
}

// Lo que queda al guardarla: sin pestañas ni flecha de atrás, solo volver a la web.
function Enviada({ email, telefono }) {
  const titulo = useRef(null);
  // El botón que se tocó ya no existe: el foco pasa aquí y el lector lo lee.
  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, []);
  const donde = email && telefono ? `a ${email} o al ${telefono}` : email ? `a ${email}` : `al ${telefono}`;
  return (
    <div className="prob-marco">
      <div className="prob-hecho" role="status">
        <span className="prob-hecho-marca" aria-hidden="true"><Hecho /></span>
        <h1 ref={titulo} tabIndex={-1}>Tarjeta guardada</h1>
        <p>Te escribimos {donde} para ponerla en marcha.</p>
        <a href="/home" className="prob-siguiente">Volver a la web</a>
      </div>
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

// Cada forma de contar, con su banda de verdad en pequeño.
function Modos({ eleccion, alElegir }) {
  const { cartillas, paleta, icono, icono2, fondo, cifras } = eleccion;
  const modos = cartillas === 2 ? MODOS_DOS : MODOS;
  const bandas = useMemo(
    () => Object.fromEntries(modos.map((m) => {
      const { negocio, cliente } = tarjetaDe({ cartillas, paleta, icono, icono2, fondo, cifras, modo: m.id });
      return [m.id, comoDataUri(stripDelPase(negocio, cliente).svg)];
    })),
    [modos, cartillas, paleta, icono, icono2, fondo, cifras],
  );
  const { cardBg } = PALETAS.find((p) => p.id === paleta);
  return (
    <div className="prob-rejilla prob-modos" role="radiogroup" aria-label="Cómo se cuentan los puntos">
      {modos.map((m) => (
        <Opcion key={m.id} activa={eleccion.modo === m.id} alElegir={() => alElegir(m.id)} etiqueta={m.nombre}>
          <img src={bandas[m.id]} alt="" className="prob-modo-banda" style={{ background: cardBg }} />
        </Opcion>
      ))}
    </div>
  );
}

function Opcion({ activa, alElegir, etiqueta, children }) {
  return (
    <button type="button" role="radio" aria-checked={activa} className="prob-opcion" onClick={alElegir}>
      {children}
      <span className="prob-opcion-texto">{etiqueta}</span>
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

const Flecha = ({ atras = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={atras ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const Hecho = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
