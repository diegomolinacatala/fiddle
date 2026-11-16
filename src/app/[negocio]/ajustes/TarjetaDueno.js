"use client";

import { useCallback, useEffect, useState } from "react";
import Bloque from "../Bloque";
import VistaTarjetaDueno from "./VistaTarjetaDueno";
import { BotonAppleWallet } from "@/app/BotonesWallet";
import { EsqueletoGestion, Hueso } from "@/app/Esqueleto";
import { C, botonPequeno } from "@/app/ui";

// ============================================================================
// TU TARJETA DE DUEÑO (Ajustes)
// ----------------------------------------------------------------------------
// Una fila como las demás: cómo está y un botón que despliega la vista previa,
// el botón de Wallet y el aviso de prueba. Solo existe si la tienda la tiene
// activa (page.js). Al navegador no llega el serial ni el token del pase.
// La vista previa NO viene con la página: calcular el informe lee el historial, y
// Ajustes no debe hacerlo cada vez que alguien entra. Se pide al abrir la fila.
// ============================================================================

const SIN_INSTALAR = "El resumen de cada semana y avisos para ti, en tu Wallet.";
const INSTALADA = "En tu Wallet. Cada lunes llega el resumen de la semana.";

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

// La vista previa se pide una vez, al abrir: { vista, error, cargando }.
function useVista(slug, abierto) {
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
    if (abierto && !vista && !cargando && !error) pedir();
  }, [abierto, vista, cargando, error, pedir]);
  return { vista, error, cargando, reintentar: pedir };
}

export default function TarjetaDueno({ slug, negocio, tarjeta, accent }) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const { vista, error, reintentar, cargando } = useVista(slug, abierto);

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
    <Bloque
      accent={accent} icono="cartera" titulo="Tu tarjeta de dueño"
      resumen={tarjeta.instalada ? INSTALADA : SIN_INSTALAR}
      abierto={abierto}
      accion={{ texto: abierto ? "Cerrar" : "Ver mi tarjeta", icono: abierto ? "cerrar" : "cartera", onClick: () => setAbierto((v) => !v) }}
    >
      <div style={{ display: "grid", gap: 14, justifyItems: "start" }}>
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
        <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
          <BotonAppleWallet href={`/api/dueno/pase?b=${encodeURIComponent(slug)}`} />
          <span style={{ fontSize: 12.5, color: C.suave }}>Solo en iPhone por ahora.</span>
        </div>
        {tarjeta.instalada && (
          <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
            <button type="button" onClick={probar} disabled={enviando} aria-busy={enviando || undefined}
              style={{ ...botonPequeno, opacity: enviando ? 0.6 : 1 }}>
              {enviando ? "Enviando…" : "Enviar aviso de prueba"}
            </button>
            {resultado && <span role="status" style={{ fontSize: 12.5, color: C.suave }}>{resultado}</span>}
          </div>
        )}
      </div>
    </Bloque>
  );
}
