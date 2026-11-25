"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LogoFiddle from "@/app/LogoFiddle";
import { PALETA } from "@/app/home/paleta";
import { useAltoVisible, useReducirMovimiento } from "@/app/home/tarjeta/movimiento";
import useTeclado from "@/app/home/experiencia/useTeclado";
import { avanceDe, marcarHecho, pasoDeHash, siguienteDe, anteriorDe, FINAL, INICIO } from "@/lib/primerosPasos";
import { Contexto } from "./Marco";
import PasoTarjeta from "./PasoTarjeta";
import PasoQr from "./PasoQr";
import PasoHorario from "./PasoHorario";
import PasoClientes from "./PasoClientes";
import PasoPromos from "./PasoPromos";
import PasoListo from "./PasoListo";
import PasoHola from "./PasoHola";

// ============================================================================
// LOS PRIMEROS PASOS DEL DUEÑO (/<slug>/primeros-pasos)
// ----------------------------------------------------------------------------
// Lo primero que ve una tienda nueva al elegir sus accesos. Cinco pasos con la
// misma pinta que la demo de la web, una pregunta cada vez:
//
//   tarjeta → QR del mostrador → horario → clientes → promociones → listo
//
// Nada es obligatorio: «Ahora no» salta un paso y «Terminar luego» vuelve al
// panel, donde una barra en Tienda dice lo que falta (lib/primerosPasos.js).
// El paso vive en la URL (#qr): atrás del navegador vuelve un paso y el aviso
// de Tienda entra directo en el que toca. Cada paso que cambia algo de la tienda
// lo guarda por /api/negocio, como desde Tienda; aquí solo se apunta qué se hizo.
// ============================================================================

const PANTALLAS = { [INICIO]: PasoHola, tarjeta: PasoTarjeta, qr: PasoQr, horario: PasoHorario, clientes: PasoClientes, promos: PasoPromos, [FINAL]: PasoListo };
const SUB_DE_PARTIDA = { i: 0, total: 1 };

export default function PrimerosPasos({ slug, inicial, tapUrl, qr }) {
  const [n, setN] = useState(inicial);
  const [paso, setPaso] = useState(null); // hasta leer la URL, nada (el servidor no la ve)
  const [sub, setSubEstado] = useState(SUB_DE_PARTIDA);
  const atrasDelPaso = useRef(null);
  const raiz = useRef(null);
  const quieto = useReducirMovimiento();
  // Con el teclado abierto (el premio, la promo) la escena se queda en una tira y el panel
  // toma el resto, como en la demo: si no, el campo quedaba entre la tarjeta y el teclado.
  const teclado = useTeclado();
  useAltoVisible(raiz);

  // Ir a un paso. Con pushState y no con location.hash: Next sigue pushState y no
  // vuelve a poner su URL encima (con location.hash, la pantalla y la URL se separaban).
  // El estado va a null: Next copia el suyo, y si se le pasa el suyo cree que la
  // llamada es de él y no apunta la URL nueva.
  const aplicar = useCallback((id) => {
    setPaso(id);
    setSubEstado(SUB_DE_PARTIDA);
    atrasDelPaso.current = null;
  }, []);

  // El paso de la URL o, si no dice ninguno, el primero sin hacer. Atrás y adelante
  // del navegador (popstate) y un hash escrito a mano (hashchange) vuelven a leerla.
  useEffect(() => {
    const leer = () => {
      const desdeUrl = pasoDeHash(window.location.hash);
      // Sin paso en la URL: la bienvenida si aún no ha hecho nada; si no, el que toca.
      const avance = avanceDe(inicial);
      const id = desdeUrl ?? (avance && avance.hechos.length === 0 ? INICIO : avance?.siguiente ?? "tarjeta");
      if (!desdeUrl) window.history.replaceState(null, "", `#${id}`);
      aplicar(id);
    };
    // Un hash escrito a mano no pasa por pushState: se le cuenta a Next, o lo pisa al volver a pintar.
    const aMano = () => { window.history.replaceState(null, "", window.location.hash); leer(); };
    leer();
    window.addEventListener("popstate", leer);
    window.addEventListener("hashchange", aMano);
    return () => { window.removeEventListener("popstate", leer); window.removeEventListener("hashchange", aMano); };
    // Solo al montar: luego manda la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de paso, el foco al título: lector de pantalla y teclado siguen el hilo.
  const primera = useRef(true);
  useEffect(() => {
    if (!paso) return;
    if (primera.current) { primera.current = false; return; }
    raiz.current?.querySelector(".pp-panel [data-titulo]")?.focus({ preventScroll: true });
  }, [paso, sub.i]);

  const ir = useCallback((id) => {
    window.history.pushState(null, "", `#${id}`);
    aplicar(id);
  }, [aplicar]);

  // Apuntar un paso hecho no para nada: se ve hecho al momento y la petición va
  // detrás. EN FILA: el servidor reescribe los primeros pasos enteros, y dos a la vez
  // (un doble toque, dos pasos seguidos) se pisarían. Si falla, se reintenta una vez;
  // si vuelve a fallar, la barra de Tienda lo seguirá pidiendo (es un recordatorio,
  // no un dato del negocio).
  const fila = useRef(Promise.resolve());
  const marcar = useCallback((id) => {
    setN((a) => ({ ...a, primerosPasos: marcarHecho(a.primerosPasos, id) }));
    const enviar = () => fetch(`/api/primeros-pasos?b=${slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hecho: id }), keepalive: true,
    }).then((r) => { if (!r.ok) throw new Error(`primeros pasos: ${r.status}`); });
    fila.current = fila.current.then(() => enviar().catch(() => enviar())).catch((e) => console.warn("[primeros pasos] no se apuntó", id, e));
  }, [slug]);

  const seguir = useCallback(() => {
    if (paso && paso !== FINAL && paso !== INICIO) marcar(paso);
    ir(siguienteDe(paso));
  }, [paso, marcar, ir]);
  const saltar = useCallback(() => ir(siguienteDe(paso)), [paso, ir]);
  const atras = useCallback(() => {
    if (atrasDelPaso.current?.()) return;
    const antes = anteriorDe(paso);
    if (antes) ir(antes);
  }, [paso, ir]);

  const guardar = useCallback(async (body) => {
    let r;
    try {
      r = await fetch(`/api/negocio?b=${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      throw new Error("Sin conexión: no se ha guardado. Prueba otra vez.");
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "No se ha podido guardar. Prueba otra vez.");
    // Lo que devuelve /api/negocio no trae los primeros pasos marcados aquí sin recargar: se conservan.
    setN((a) => ({ ...data, primerosPasos: a.primerosPasos }));
    return data;
  }, [slug]);

  const setSub = useCallback((i, total) => setSubEstado((a) => (a.i === i && a.total === total ? a : { i, total })), []);
  const setAtras = useCallback((fn) => { atrasDelPaso.current = fn; }, []);

  const hechos = avanceDe(n)?.hechos ?? [];
  const valor = useMemo(() => ({
    n, setN, slug, accent: n.tema.accent, tapUrl, qr, quieto, paso, hechos, sub,
    seguir, saltar, atras, guardar, setSub, setAtras, ir,
  }), [n, slug, tapUrl, qr, quieto, paso, hechos, sub, seguir, saltar, atras, guardar, setSub, setAtras, ir]);

  const Pantalla = paso ? PANTALLAS[paso] : null;
  return (
    <div
      ref={raiz}
      className={`prob prob-pagina exp pp pp-en-${paso || "nada"}${quieto ? " prob-quieto" : ""}${teclado ? " exp-teclado" : ""}`}
      style={{ "--tono": n.tema.cardBg, "--tono-2": n.tema.accent }}
    >
      <header className="prob-arriba">
        <span className="prob-volver" aria-hidden="true"><LogoFiddle tam={24} color={PALETA.verde} id="efe-primeros-pasos" /></span>
        {paso !== FINAL && <a href={`/${slug}/manager`} className="exp-entrar">Terminar luego</a>}
      </header>
      <div className="prob-halo" aria-hidden="true" />
      <Contexto.Provider value={valor}>
        {Pantalla && <Pantalla key={paso} />}
      </Contexto.Provider>
    </div>
  );
}
