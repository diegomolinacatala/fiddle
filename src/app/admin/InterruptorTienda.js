"use client";

import { useState } from "react";
import { FilaInterruptor } from "@/app/Interruptor";
import { C, panel, h2 } from "@/app/ui";

// Lo que el admin enciende o apaga para UNA tienda: una clave de su config que
// la tienda no puede tocar (los avisos automáticos, la plantilla). Se guarda al
// momento con solo esa clave (PUT /api/admin/negocios, `INTERRUPTORES`) y no
// mueve ningún pase. Apagar nunca borra: al volver a encender, todo como estaba.
//
// `encendido` y `apagado`: { titulo, texto, aviso } de cada lado; `aviso` es lo
// que dice el mensaje de abajo al guardar.
export default function InterruptorTienda({ slug, clave, on, seccion, icono, encendido, apagado, nota, accent, flash, onCambio }) {
  const [guardando, setGuardando] = useState(false);
  const lado = on ? encendido : apagado;

  async function alternar() {
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/negocios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, [clave]: !on }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo guardar");
      onCambio(d[clave]);
      flash(d[clave] ? encendido.aviso : apagado.aviso);
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section style={panel}>
      <h2 style={h2}>{seccion}</h2>
      <FilaInterruptor on={on} onClick={alternar} disabled={guardando} accent={accent} icono={icono} titulo={lado.titulo} texto={lado.texto} />
      {nota && <p style={{ fontSize: 12.5, color: C.tenue, margin: "10px 0 0", lineHeight: 1.4 }}>{nota}</p>}
    </section>
  );
}
