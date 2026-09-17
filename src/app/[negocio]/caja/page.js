"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QrScanner from "./QrScanner";

// App de CAJA de un negocio (móvil, instalable). Escanea el pase o abre a mano.
export default function Caja() {
  const { negocio } = useParams();
  const router = useRouter();
  const [n, setN] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [valor, setValor] = useState("");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    fetch(`/api/negocio?b=${negocio}`).then((r) => r.json()).then(setN).catch(() => {});
    fetch(`/api/clientes?b=${negocio}`).then((r) => r.json()).then(setClientes).catch(() => {});
  }, [negocio]);

  function abrir(e) {
    e?.preventDefault();
    const m = valor.trim().match(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
    const serial = m ? m[0] : valor.trim();
    if (serial) router.push(`/w/${serial}`);
  }

  const accent = n?.tema?.accent || "#fff";

  return (
    <main style={wrap}>
      <div style={{ width: "min(430px, 94vw)" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 2 }}>
          {n?.tema?.emoji || "📱"} {n?.nombre || "Caja"} · caja
        </h1>
        <p style={{ opacity: 0.6, fontSize: 14, marginTop: 0 }}>Escanea el QR del pase del cliente.</p>

        <QrScanner accent={accent} />

        <button onClick={() => setManual((v) => !v)} style={toggle}>
          {manual ? "Ocultar entrada manual" : "Introducir código a mano"}
        </button>
        {manual && (
          <form onSubmit={abrir} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="serial o URL" style={input} />
            <button type="submit" style={{ ...go, background: accent }}>Abrir</button>
          </form>
        )}

        <div style={{ marginTop: 24, fontSize: 12, opacity: 0.45, textTransform: "uppercase", letterSpacing: 1 }}>
          Clientes ({clientes.length})
        </div>
        {clientes.slice(0, 15).map((c) => (
          <a key={c.serial} href={`/w/${c.serial}`} style={row}>
            <span style={{ fontFamily: "monospace", fontSize: 13, opacity: 0.7 }}>{c.serial.slice(0, 8)}…</span>
            <span style={{ opacity: 0.8 }}>{c.sellos} · {c.premios || 0} 🎁</span>
          </a>
        ))}
        {clientes.length === 0 && <p style={{ opacity: 0.5, fontSize: 14 }}>Aún no hay clientes.</p>}
      </div>
    </main>
  );
}

const wrap = { minHeight: "100vh", display: "grid", placeItems: "start center", background: "#0b0b0c", color: "#fff", padding: "2rem 1rem" };
const toggle = { marginTop: 12, width: "100%", padding: "0.6rem", borderRadius: 12, border: "1px dashed rgba(255,255,255,.25)", background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer" };
const input = { flex: 1, padding: "0.7rem 0.9rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.18)", background: "#141416", color: "#fff", fontSize: 15 };
const go = { padding: "0.7rem 1.1rem", borderRadius: 12, border: 0, color: "#fff", fontWeight: 600, cursor: "pointer" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", marginTop: 8, borderRadius: 12, background: "#141416", border: "1px solid rgba(255,255,255,.1)", color: "#fff", textDecoration: "none" };
