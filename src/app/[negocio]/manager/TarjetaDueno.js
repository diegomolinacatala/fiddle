"use client";

import { useCallback, useEffect, useId, useState } from "react";
import VistaTarjetaDueno from "./VistaTarjetaDueno";
import Icono from "@/app/Icono";
import { Interruptor } from "@/app/Interruptor";
import AnadirEnIphone from "./AnadirEnIphone";
import { EsqueletoGestion, Hueso } from "@/app/Esqueleto";
import { recibirDe, resumenRecibir, TOPE_SEMANA } from "@/lib/dueno/recibir";
import { C, panel, botonPequeno, etiqueta, RADIO, legible, tinte } from "@/app/ui";

// ============================================================================
// TU TARJETA DE DUEÑO (Tienda, bajo el QR del mostrador)
// ----------------------------------------------------------------------------
// Antes era una fila de Ajustes; desde el 18-11-2026 vive aquí, en el hueco de
// debajo del QR, y solo aquí. Plegada es una línea: qué es y qué le avisa. Al
// tocarla se abre lo que el dueño elige recibir (lib/dueno/recibir.js), que se
// guarda al tocar, y debajo su tarjeta: el botón de Wallet en el iPhone o un QR en
// el ordenador (AnadirEnIphone.js), la vista previa y el aviso de prueba. Solo sale si la tienda la tiene activa (page.js).
//
// Al navegador no llega el serial ni el token del pase. La vista previa no viene
// con la página: calcular el informe lee el historial, y Tienda no debe hacerlo
// cada vez que alguien entra. Se pide al abrirla.
// ============================================================================

const OPCIONES = [
  { clave: "resumen", titulo: "El resumen del lunes", texto: "Visitas, clientes nuevos y premios de la semana que acaba." },
  { clave: "ideas", titulo: "Ideas para tus clientes", texto: "Cuando los números digan algo, un aviso ya preparado. Tú decides si se envía." },
];

const MENSAJES_PRUEBA = {
  repetida: "Ya hay un aviso de prueba en camino. Espera a que caduque para enviar otro.",
  sin_iphone: "No hay ningún iPhone con la tarjeta. Añádela primero.",
};
const ERROR_PRUEBA = "No se pudo enviar. Prueba otra vez en un momento.";

/** Lo que se le dice al dueño tras pedir la prueba. */
function textoDePrueba(data) {
  if (data.repetida) return MENSAJES_PRUEBA.repetida;
  if (data.avisados > 0) return "Enviado. Mira la pantalla de bloqueo.";
  return MENSAJES_PRUEBA[data.motivo] ?? ERROR_PRUEBA;
}

// La vista previa se pide una vez, al abrirla: { vista, error, cargando }.
function useVista(slug, abierta) {
  const [vista, setVista] = useState(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);
  const pedir = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const res = await fetch(`/api/dueno/vista?b=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(String(res.status));
      setVista(await res.json());
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [slug]);
  useEffect(() => {
    if (abierta && !vista && !cargando && !error) pedir();
  }, [abierta, vista, cargando, error, pedir]);
  return { vista, error, cargando, reintentar: pedir, olvidar: () => setVista(null) };
}

/**
 * Lo que elige recibir, guardado al tocar: se pinta ya y, si el servidor no lo
 * guarda, vuelve a como estaba y lo dice.
 */
function useRecibir(slug, inicial, flash) {
  const [recibir, setRecibir] = useState(() => recibirDe({ recibir: inicial }));
  const [guardando, setGuardando] = useState(false);
  async function cambiar(cambios, mensaje) {
    const antes = recibir;
    setRecibir({ ...antes, ...cambios });
    setGuardando(true);
    try {
      const res = await fetch(`/api/dueno/recibir?b=${encodeURIComponent(slug)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setRecibir(recibirDe({ recibir: data.recibir }));
      flash(mensaje);
      return true;
    } catch (e) {
      setRecibir(antes);
      flash(e instanceof TypeError ? "Sin conexión: no se ha guardado" : e.message);
      return false;
    } finally {
      setGuardando(false);
    }
  }
  return { recibir, guardando, cambiar };
}

export default function TarjetaDueno({ slug, negocio, tarjeta, accent, flash }) {
  const [abierta, setAbierta] = useState(false);
  const [verTarjeta, setVerTarjeta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const { recibir, guardando, cambiar } = useRecibir(slug, tarjeta.recibir, flash);
  const { vista, error, cargando, reintentar, olvidar } = useVista(slug, verTarjeta);
  const idDentro = useId();

  async function alternar(clave) {
    const on = !recibir[clave];
    const nombre = OPCIONES.find((o) => o.clave === clave).titulo;
    // Las ideas cambian lo que enseña la tarjeta hoy: la vista previa se vuelve a pedir.
    if (await cambiar({ [clave]: on }, on ? `${nombre}: te llegará` : `${nombre}: ya no te llegará`) && clave === "ideas") olvidar();
  }

  async function probar() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/dueno/prueba?b=${encodeURIComponent(slug)}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setResultado(res.ok ? textoDePrueba(data) : data.error || ERROR_PRUEBA);
    } catch {
      setResultado("Sin conexión: no se ha enviado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section style={{ ...panel, padding: 0 }}>
      {/* Toda la fila se toca: es lo único que hay plegado, no hace falta otro botón. */}
      <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} aria-controls={idDentro} style={cabecera}>
        <span aria-hidden style={{ ...cuadro, background: tinte(accent, 8), color: legible(accent) }}>
          <Icono nombre="cartera" tam={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 650 }}>Tu tarjeta de dueño</span>
          <span style={{ display: "block", fontSize: 12.5, color: C.suave, marginTop: 2, lineHeight: 1.35 }}>
            {tarjeta.instalada ? resumenRecibir(recibir) : "El resumen de cada semana y avisos para ti, en tu Wallet."}
          </span>
        </span>
        <span aria-hidden style={{ color: C.tenue, display: "inline-flex", transform: `rotate(${abierta ? -90 : 90}deg)`, transition: "transform .18s" }}>
          <Icono nombre="adelante" tam={16} />
        </span>
      </button>

      {abierta && (
        <div id={idDentro} style={{ padding: "0 16px 16px" }}>
          <span style={{ ...etiqueta, marginTop: 4 }}>Qué quieres recibir</span>
          <div style={{ display: "grid" }}>
            {OPCIONES.map((o, i) => (
              <div key={o.clave} style={{ ...fila, borderTop: i ? `1px solid ${C.borde}` : "none" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{o.titulo}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: C.suave, marginTop: 1 }}>{o.texto}</span>
                </span>
                <Interruptor on={recibir[o.clave]} onClick={() => alternar(o.clave)} disabled={guardando} accent={accent} etiqueta={o.titulo} />
              </div>
            ))}
            <PorSemana recibir={recibir} guardando={guardando} accent={accent} cambiar={cambiar} />
          </div>

          <span style={etiqueta}>Tu tarjeta</span>
          <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
            <AnadirEnIphone slug={slug} instalada={tarjeta.instalada} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setVerTarjeta((v) => !v)} aria-expanded={verTarjeta}
                style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icono nombre={verTarjeta ? "cerrar" : "cartera"} tam={15} />
                {verTarjeta ? "Cerrar" : "Ver cómo se ve"}
              </button>
              {tarjeta.instalada && (
                <button type="button" onClick={probar} disabled={enviando} aria-busy={enviando || undefined}
                  style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6, opacity: enviando ? 0.6 : 1 }}>
                  <Icono nombre="campana" tam={15} />
                  {enviando ? "Enviando…" : "Enviar aviso de prueba"}
                </button>
              )}
            </div>
            {resultado && <span role="status" style={{ fontSize: 12.5, color: C.suave }}>{resultado}</span>}
            {verTarjeta && (
              <div style={{ width: "100%" }}>
                {vista && <VistaTarjetaDueno informe={vista.informe} aviso={vista.aviso} negocio={negocio} />}
                {!vista && !error && (
                  <EsqueletoGestion margen={0}>
                    <Hueso w="min(360px, 100%)" h="auto" r={13} style={{ aspectRatio: "360 / 290" }} />
                  </EsqueletoGestion>
                )}
                {error && (
                  <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                    <span role="status" style={{ fontSize: 12.5, color: C.suave }}>No se pudo cargar la vista previa.</span>
                    <button type="button" onClick={reintentar} disabled={cargando} style={botonPequeno}>Reintentar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** «Como mucho 1 / 2 a la semana»: solo cuenta con las ideas encendidas. */
function PorSemana({ recibir, guardando, accent, cambiar }) {
  const apagado = !recibir.ideas || guardando;
  return (
    <div style={{ ...fila, borderTop: `1px solid ${C.borde}`, opacity: recibir.ideas ? 1 : 0.5 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>Como mucho</span>
      <div role="radiogroup" aria-label="Ideas como mucho a la semana" style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: TOPE_SEMANA }, (_, i) => i + 1).map((v) => {
          const elegido = recibir.porSemana === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={elegido} disabled={apagado}
              onClick={() => !elegido && cambiar({ porSemana: v }, v === 1 ? "Como mucho una idea a la semana" : `Como mucho ${v} ideas a la semana`)}
              style={{
                padding: "0.3rem 0.6rem", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: apagado ? "default" : "pointer",
                border: `1px solid ${elegido ? accent : C.borde}`, background: elegido ? tinte(accent, 8) : C.panel,
                color: elegido ? legible(accent) : C.texto,
              }}>
              {v} a la semana
            </button>
          );
        })}
      </div>
    </div>
  );
}

const cabecera = {
  display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", textAlign: "left",
  background: "none", border: 0, borderRadius: RADIO.panel, cursor: "pointer", font: "inherit", color: C.texto,
};
const cuadro = { width: 34, height: 34, borderRadius: RADIO.boton, display: "grid", placeItems: "center", flexShrink: 0 };
const fila = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0" };
