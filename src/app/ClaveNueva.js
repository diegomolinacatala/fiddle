"use client";

import { useState } from "react";
import { C, botonPequeno, RADIO } from "@/app/ui";

const ROTULO = { manager: "Dueño / manager", caja: "Móvil de la caja" };

// Una contraseña recién generada. Se ve UNA vez: en la base solo queda el hash,
// así que el aviso lo dice claro y hay botón de copiar.
export default function ClaveNueva({ accesos, onCerrar }) {
  const [copiado, setCopiado] = useState(null);
  async function copiar(a) {
    const texto = `Usuario: ${a.usuario}\nContraseña: ${a.clave}`;
    try { await navigator.clipboard.writeText(texto); setCopiado(a.usuario); } catch { setCopiado(null); }
  }
  return (
    <div role="status" style={caja}>
      <strong style={{ display: "block", marginBottom: 4 }}>Apúntalas ahora: no se vuelven a ver</strong>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.suave }}>
        Se entra en <code>/login</code>. Si se pierde una, se genera otra y la anterior deja de valer.
      </p>
      {accesos.map((a) => (
        <div key={a.usuario} style={fila}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.tenue }}>{ROTULO[a.rol] || a.rol}</div>
            <div style={{ fontSize: 14 }}>Usuario <strong>{a.usuario}</strong></div>
            <div style={mono}>{a.clave}</div>
          </div>
          <button type="button" onClick={() => copiar(a)} style={botonPequeno}>
            {copiado === a.usuario ? "Copiado" : "Copiar"}
          </button>
        </div>
      ))}
      {onCerrar && (
        <button type="button" onClick={onCerrar} style={{ ...botonPequeno, marginTop: 10 }}>Ya las he guardado</button>
      )}
    </div>
  );
}

const caja = { padding: 14, borderRadius: RADIO.fila, border: "1px solid #bfe5cd", background: "#f1faf4", marginTop: 12 };
const fila = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid #d7eee0" };
const mono = { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 700, letterSpacing: 1.5, marginTop: 2 };
