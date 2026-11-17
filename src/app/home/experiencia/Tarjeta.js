"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { INICIAL, limpiar, tarjetaDe, temaDe, MAX_NOMBRE } from "../tarjeta/opciones";
import { PUNTOS_DE_PARTIDA, trasSumar, promoTras } from "./logica";

// ============================================================================
// LA TARJETA DEL VISITANTE, PARA TODA LA WEB
// ----------------------------------------------------------------------------
// Lo que elige (nombre, color, icono…) y los puntos que lleva viven aquí una sola
// vez: todos los pasos y la pantalla de precios enseñan la MISMA tarjeta.
// Nada sale del navegador hasta que la guarda (Guardar → /api/interesados).
//
// Lo elegido se apunta en la pestaña (sessionStorage): si recarga o vuelve atrás
// desde otra página, su tarjeta sigue ahí. Se lee DESPUÉS de montar: el servidor
// pinta la de partida y, si se leyera antes, el HTML no coincidiría.
// ============================================================================

const Contexto = createContext(null);
const LLAVE = "fiddle-tarjeta";

function leerGuardado() {
  try {
    const crudo = window.sessionStorage.getItem(LLAVE);
    if (!crudo) return null;
    const dato = JSON.parse(crudo);
    const nombre = typeof dato?.nombre === "string" ? dato.nombre.slice(0, MAX_NOMBRE) : "";
    return { ...limpiar(dato), nombre };
  } catch {
    // Sin almacenamiento (modo privado, bloqueado) o con algo roto: se empieza de cero.
    return null;
  }
}

function apuntar(eleccion) {
  try {
    window.sessionStorage.setItem(LLAVE, JSON.stringify(eleccion));
  } catch {
    // No poder apuntarlo no rompe nada: solo no se recordará al recargar.
  }
}

export function ProveedorTarjeta({ qr, children }) {
  const [eleccion, setEleccion] = useState(INICIAL);
  const [recuperada, setRecuperada] = useState(false);
  // Puntos, premios, promoción y último aviso van juntos: un toque los mueve a la vez.
  // `aviso` ({ n, tipo }) es de donde sale el aviso de la escena: cada toque, uno nuevo.
  const [prueba, setPrueba] = useState({ puntos: PUNTOS_DE_PARTIDA, premios: 0, envios: 0, promo: null, aviso: { n: 0, tipo: "punto" } });
  const { puntos, premios, promo, aviso } = prueba;
  const [guardada, setGuardada] = useState(null); // { email, telefono } al guardarla

  useEffect(() => {
    const antes = leerGuardado();
    if (antes) setEleccion(antes);
    setRecuperada(true);
  }, []);
  // Hasta haber leído lo de antes no se apunta nada: se pisaría con la de partida.
  useEffect(() => {
    if (recuperada) apuntar(eleccion);
  }, [eleccion, recuperada]);

  const cambiar = useCallback((cambios) => setEleccion((a) => limpiar({ ...a, ...cambios })), []);
  // El nombre se escribe letra a letra: sin limpiar, para no comerle el espacio del final.
  const escribirNombre = useCallback((nombre) => setEleccion((a) => ({ ...a, nombre: nombre.slice(0, MAX_NOMBRE) })), []);

  const sumar = useCallback(() => {
    setPrueba((a) => {
      const tras = trasSumar(a.puntos);
      return { ...a, puntos: tras.puntos, premios: a.premios + (tras.premio ? 1 : 0), aviso: { n: a.aviso.n + 1, tipo: "punto" } };
    });
  }, []);

  // Cada envío pone la promoción siguiente en la tarjeta: ese cambio es el que suena en el iPhone.
  const enviarPromo = useCallback(() => {
    setPrueba((a) => ({ ...a, promo: promoTras(a.envios), envios: a.envios + 1, aviso: { n: a.aviso.n + 1, tipo: "promo" } }));
  }, []);

  const valor = useMemo(() => {
    const e = limpiar(eleccion);
    return {
      qr,
      eleccion, // tal cual se escribe (el nombre, con sus espacios)
      e, // lo elegido, ya limpio
      tema: temaDe(e),
      tarjeta: tarjetaDe(e, { puntos, promo }), // { negocio, cliente } para CaraDelPase
      cambiar,
      escribirNombre,
      puntos,
      premios,
      promo,
      aviso,
      sumar,
      enviarPromo,
      guardada,
      guardar: setGuardada,
    };
  }, [qr, eleccion, puntos, premios, promo, aviso, guardada, cambiar, escribirNombre, sumar, enviarPromo]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTarjeta() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useTarjeta se usa dentro de <ProveedorTarjeta>");
  return valor;
}
