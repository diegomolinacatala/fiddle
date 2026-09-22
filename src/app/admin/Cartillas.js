"use client";

import { MARCAS } from "@/lib/negocios";
import { ROTULO } from "@/app/admin/vistas";
import { C, campo, etiqueta } from "@/app/ui";

// ============================================================================
// DOS CARTILLAS EN EL MISMO PASE (ver lib/cartillas.js)
// ----------------------------------------------------------------------------
// La tarjeta de papel con ocho galletas arriba y ocho cafés abajo. Apagado, la
// tienda tiene su cartilla de siempre; encendido, se editan las dos aquí y la
// primera pasa a mandar sobre "Sellos" y "Premio".
// ============================================================================

// Al encender: la primera es la cartilla que ya tenía la tienda.
const dePartida = (n) => [
  { nombre: "Sellos", marca: n.tema.marca === "texto" ? "estrella" : n.tema.marca, meta: n.meta, premio: n.premio },
  { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
];

export default function Cartillas({ negocio, onChange }) {
  const cartillas = negocio.cartillas;
  const cambiar = (i, k, v) => onChange(cartillas.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(cartillas)} onChange={(e) => onChange(e.target.checked ? dePartida(negocio) : null)} />
        Dos cartillas en el mismo pase
      </label>
      <p style={{ fontSize: 12, color: C.tenue, margin: "4px 0 0 24px" }}>
        Una fila por cartilla, cada una con su dibujo y su premio. La caja tiene un botón para cada una.
      </p>

      {cartillas?.map((c, i) => (
        <fieldset key={i} style={grupo}>
          <legend style={{ fontSize: 12, color: C.tenue, padding: "0 4px" }}>{i === 0 ? "Fila de arriba" : "Fila de abajo"}</legend>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2, minWidth: 0 }}>
              <label style={{ ...etiqueta, marginTop: 0 }}>Nombre</label>
              <input value={c.nombre} onChange={(e) => cambiar(i, "nombre", e.target.value)} placeholder="Cookies" style={campo} />
            </div>
            <div style={{ flex: 2, minWidth: 0 }}>
              <label style={{ ...etiqueta, marginTop: 0 }}>Dibujo</label>
              <select value={c.marca} onChange={(e) => cambiar(i, "marca", e.target.value)} style={campo}>
                {MARCAS.filter((m) => m !== "texto").map((m) => <option key={m} value={m}>{ROTULO[m] || m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ ...etiqueta, marginTop: 0 }}>Sellos</label>
              <input type="number" min={1} max={20} value={c.meta} onChange={(e) => cambiar(i, "meta", Number(e.target.value))} style={campo} />
            </div>
          </div>
          <label style={etiqueta}>Premio</label>
          <input value={c.premio} onChange={(e) => cambiar(i, "premio", e.target.value)} placeholder="cookie gratis" style={campo} />
        </fieldset>
      ))}
    </div>
  );
}

const grupo = { border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 12px 12px", margin: "10px 0 0" };
