"use client";

import { useEffect, useMemo, useState } from "react";
import { fotoDe, rutaFoto } from "@/lib/propios";

// ============================================================================
// LA FOTO DE LA BANDA, EN EL NAVEGADOR
// ----------------------------------------------------------------------------
// La banda es un SVG pintado en un <img>, y un SVG dentro de un <img> no carga
// nada de fuera: la foto tiene que ir DENTRO, como data URI (`tema.fotoBanda`,
// lo mismo que pone el servidor al dibujar el pase, lib/propiosServidor.js).
// Aquí se pide una vez por foto y se recuerda: varias tarjetas en la misma
// pantalla no la piden dos veces. Mientras llega, la banda sale clara.
// ============================================================================

const leidas = new Map(); // "slug/id" -> data URI
const pidiendo = new Map(); // "slug/id" -> Promise

function pedir(f) {
  const clave = `${f.b}/${f.id}`;
  if (!pidiendo.has(clave)) {
    pidiendo.set(clave, fetch(rutaFoto(f))
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => b && new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); }))
      .then((uri) => { if (uri) leidas.set(clave, uri); else pidiendo.delete(clave); return uri; })
      .catch(() => { pidiendo.delete(clave); return null; }));
  }
  return pidiendo.get(clave);
}

/** El data URI de la foto de banda de un tema (o null mientras no está, o si no lleva). */
export function useFotoBanda(tema) {
  const f = tema?.banda === "foto" ? fotoDe(tema) : null;
  const clave = f ? `${f.b}/${f.id}` : null;
  const [uri, setUri] = useState(() => (clave ? leidas.get(clave) ?? null : null));
  useEffect(() => {
    if (!clave) return undefined;
    if (leidas.has(clave)) { setUri(leidas.get(clave)); return undefined; }
    let vivo = true;
    pedir(f).then((u) => { if (vivo && u) setUri(u); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return clave ? uri : null;
}

/** El negocio con su foto de banda dentro, listo para stripDelPase. */
export function useConFotoBanda(negocio) {
  const uri = useFotoBanda(negocio?.tema);
  return useMemo(() => (uri ? { ...negocio, tema: { ...negocio.tema, fotoBanda: uri } } : negocio), [negocio, uri]);
}
