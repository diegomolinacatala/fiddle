"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { avisoDeCambio } from "@/lib/avisos";

// ============================================================================
// LO QUE LA TARJETA WEB LE PIDE AL TELÉFONO
// ----------------------------------------------------------------------------
// Lo que en iPhone hace Wallet y en Android tiene que hacer la página:
//   useTarjetaEnVivo    ponerse al día sola cuando la caja sella
//   useAvisos           avisos del navegador (sellos y promos con el móvil bloqueado)
// (Quedarse en la pantalla de inicio como una app: useInstalar, en app/instalable.js.)
// ============================================================================

// Mientras el cliente está en caja con la tarjeta abierta, cada pocos segundos;
// pasado un rato sin cambios, sin prisa. Oculta, nada (y al volver, al momento).
const RAPIDO_MS = 3000;
const LENTO_MS = 10000;
const PRISA_MS = 3 * 60 * 1000;

const cambio = (a, b) =>
  a.cliente.sellos !== b.cliente.sellos ||
  a.cliente.sellos2 !== b.cliente.sellos2 ||
  a.cliente.premios !== b.cliente.premios ||
  a.cliente.mensaje !== b.cliente.mensaje ||
  a.cliente.nombre !== b.cliente.nombre ||
  JSON.stringify(a.negocio) !== JSON.stringify(b.negocio);

/**
 * Estado de la tarjeta al día. `novedad` es el aviso del último cambio (un
 * sello, un canje), para enseñarlo en pantalla aunque no haya avisos activados.
 */
export function useTarjetaEnVivo(serial, inicial) {
  const [datos, setDatos] = useState(inicial);
  const [novedad, setNovedad] = useState(null);
  const ultimo = useRef(inicial);
  const ultimoCambio = useRef(Date.now());

  const refrescar = useCallback(async () => {
    try {
      const r = await fetch(`/api/tarjeta/${serial}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (!cambio(ultimo.current, d)) return;
      const aviso = avisoDeCambio(ultimo.current.cliente, d.cliente, d.negocio);
      ultimo.current = d;
      ultimoCambio.current = Date.now();
      setDatos(d);
      if (aviso) {
        setNovedad({ ...aviso, id: Date.now() });
        navigator.vibrate?.([35, 60, 35]);
      }
    } catch {
      // Sin red un momento: la próxima vuelta lo intenta otra vez.
    }
  }, [serial]);

  useEffect(() => {
    let reloj = null;
    const programar = () => {
      clearTimeout(reloj);
      if (document.visibilityState !== "visible") return;
      const espera = Date.now() - ultimoCambio.current < PRISA_MS ? RAPIDO_MS : LENTO_MS;
      reloj = setTimeout(async () => { await refrescar(); programar(); }, espera);
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        ultimoCambio.current = Date.now(); // vuelve a mirarla: probablemente está en caja
        refrescar();
      }
      programar();
    };
    // El service worker avisa cuando llega un aviso: se refresca sin esperar.
    const alMensaje = (e) => { if (e.data?.tipo === "tarjeta") refrescar(); };

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    navigator.serviceWorker?.addEventListener("message", alMensaje);
    programar();
    return () => {
      clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      navigator.serviceWorker?.removeEventListener("message", alMensaje);
    };
  }, [refrescar]);

  useEffect(() => {
    if (!novedad) return;
    const t = setTimeout(() => setNovedad(null), 7000);
    return () => clearTimeout(t);
  }, [novedad]);

  return { datos, novedad, cerrarNovedad: () => setNovedad(null) };
}

// ------------------------------------------------------------------ avisos
const bytesDeClave = (b64url) => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const mismaClave = (sub, clave) => {
  const actual = sub?.options?.applicationServerKey;
  if (!actual) return true; // el navegador no la enseña: se da por buena
  const a = new Uint8Array(actual);
  const b = bytesDeClave(clave);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

const marca = (serial) => `avisos:${serial}`;
const leerMarca = (serial) => { try { return localStorage.getItem(marca(serial)) === "1"; } catch { return false; } };
const ponerMarca = (serial, si) => {
  try { if (si) localStorage.setItem(marca(serial), "1"); else localStorage.removeItem(marca(serial)); } catch { /* modo privado */ }
};

async function registroSW() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

/**
 * Avisos del navegador para esta tarjeta.
 * estado: "no-soportado" | "cargando" | "apagado" | "encendido" | "bloqueado" | "trabajando"
 */
export function useAvisos(serial, clavePush) {
  const [estado, setEstado] = useState("cargando");
  const [error, setError] = useState(null);

  const alta = useCallback(async (reg) => {
    let sub = await reg.pushManager.getSubscription();
    if (sub && !mismaClave(sub, clavePush)) {
      await sub.unsubscribe(); // la clave del servidor cambió: la vieja ya no sirve
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeClave(clavePush) });
    const r = await fetch(`/api/push/${serial}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suscripcion: sub.toJSON() }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "No se pudieron activar los avisos");
  }, [serial, clavePush]);

  useEffect(() => {
    const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!soportado || !clavePush) return setEstado("no-soportado");
    if (Notification.permission === "denied") return setEstado("bloqueado");
    let vivo = true;
    (async () => {
      try {
        const reg = await registroSW();
        const sub = await reg.pushManager.getSubscription();
        if (!leerMarca(serial) || Notification.permission !== "granted") return vivo && setEstado("apagado");
        // Estaban activados: si el navegador perdió la suscripción o cambió la
        // clave, se rehace sola sin volver a preguntar.
        if (!sub || !mismaClave(sub, clavePush)) await alta(reg);
        if (vivo) setEstado("encendido");
      } catch {
        if (vivo) setEstado("apagado");
      }
    })();
    return () => { vivo = false; };
  }, [serial, clavePush, alta]);

  const activar = async () => {
    setError(null);
    setEstado("trabajando");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") return setEstado(permiso === "denied" ? "bloqueado" : "apagado");
      await alta(await registroSW());
      ponerMarca(serial, true);
      setEstado("encendido");
    } catch (e) {
      setError(String(e?.message || e));
      setEstado("apagado");
    }
  };

  const desactivar = async () => {
    setError(null);
    setEstado("trabajando");
    try {
      const reg = await registroSW();
      const sub = await reg.pushManager.getSubscription();
      // Solo se quita ESTA tarjeta: la misma suscripción puede servir a la de otra tienda.
      if (sub) {
        await fetch(`/api/push/${serial}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
    } finally {
      ponerMarca(serial, false);
      setEstado("apagado");
    }
  };

  return { estado, error, activar, desactivar };
}
