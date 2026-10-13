"use client";

import { C, solapa } from "@/app/ui";

/**
 * Las pestañas de dentro de una pantalla (Resumen / Grupos…, Enviar / Enviados…).
 * Las mismas en la página y en su loading.js: mientras carga se ven ya con su
 * texto, sin `onCambiar`, y la página entra sin que nada salte.
 */
export default function Solapas({ pestanas, activa, accent, onCambiar }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
      {pestanas.map(([id, texto]) => (
        <button key={id} type="button" role="tab" aria-selected={activa === id} onClick={() => onCambiar?.(id)} style={solapa(activa === id, accent)}>
          {texto}
        </button>
      ))}
    </div>
  );
}
