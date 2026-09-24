"use client";

import { C, panel } from "@/app/ui";

// Lo que ya salió, a mano o solo, y la única pregunta que importa: ¿volvieron?
export default function Enviados({ datos }) {
  const lista = datos.historial;
  if (!lista.length) {
    return (
      <p style={{ ...panel, margin: 0, color: C.suave, fontSize: 14 }}>
        Todavía no se ha enviado nada. Aquí saldrá cada envío, automático o a mano, y cuántos volvieron después.
      </p>
    );
  }
  return (
    <section style={panel}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>{["Cuándo", "Aviso", "Mensaje", "A", "Volvieron"].map((t) => <th key={t} style={th}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {new Date(c.creado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={td}>
                  {c.etiqueta}
                  <div style={{ fontSize: 11.5, color: C.tenue }}>{c.automatico ? "automático" : "a mano"}</div>
                </td>
                <td style={{ ...td, maxWidth: 320 }}>{c.texto}</td>
                <td style={td}>{c.destinatarios}</td>
                <td style={td}>
                  <strong style={{ color: c.volvieron ? C.ok : C.suave }}>{c.volvieron}</strong>
                  <span style={{ color: C.tenue, fontSize: 12 }}> · {c.tasa}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: C.tenue, marginTop: 10, marginBottom: 0 }}>
        «Volvieron»: avisados que pasaron por la tienda después del envío. La promo para todos no sale aquí: se ve en «Enviar ahora».
      </p>
    </section>
  );
}

const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "top" };
