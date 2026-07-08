"use client";

import { useEffect, useState } from "react";
import { LISTA_ACCIONES } from "@/lib/acciones";
import LogoutButton from "@/app/LogoutButton";

const COLORES = ["dark", "blue", "green", "red", "purple", "orange"];

// Panel del MANAGER (PC). Define qué hace un escaneo (la funcionalidad) y lanza promos.
export default function Manager() {
  const [prog, setProg] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [promoTexto, setPromoTexto] = useState("");
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    cargar();
  }, []);

  async function cargar() {
    const [p, c] = await Promise.all([
      fetch("/api/programa").then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
    ]);
    setProg(p);
    setPromoTexto(p.promo || "");
    setClientes(c);
  }

  function set(k, v) {
    setProg((p) => ({ ...p, [k]: v }));
  }
  function toggleAccion(key) {
    setProg((p) => {
      const on = p.acciones.includes(key);
      return { ...p, acciones: on ? p.acciones.filter((a) => a !== key) : [...p.acciones, key] };
    });
  }

  async function guardar() {
    const res = await fetch("/api/programa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prog),
    });
    const data = await res.json();
    setProg(data);
    flash(res.ok ? "Programa guardado ✔" : data.error);
  }

  async function lanzarPromo(texto) {
    const res = await fetch("/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    const data = await res.json();
    setPromoTexto(texto);
    setProg((p) => ({ ...p, promo: data.promo }));
    flash(res.ok ? `Promo enviada a ${data.enviadas} pases` : data.error);
  }

  async function emitir() {
    const res = await fetch("/api/crear", { method: "POST" });
    const data = await res.json();
    flash(res.ok ? `Pase emitido: ${data.serial.slice(0, 8)}…` : data.error);
    cargar();
  }

  async function copiarTap() {
    try {
      await navigator.clipboard.writeText(`${origin}/api/tap`);
      flash("URL del tag copiada ✔");
    } catch {
      flash("Copia manual: " + `${origin}/api/tap`);
    }
  }

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  if (!prog) return <main style={wrap}><p style={{ opacity: 0.5 }}>Cargando…</p></main>;

  const tapUrl = `${origin}/api/tap`;
  const tapQr = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tapUrl)}`
    : null;

  return (
    <main style={wrap}>
      <div style={{ width: "min(1000px, 96vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "1.8rem", marginBottom: 2 }}>🖥️ Manager</h1>
          <LogoutButton />
        </div>
        <p style={{ opacity: 0.55, marginTop: 0 }}>Define qué hace la tienda. Cambios sin reeditar ningún pase.</p>

        <div style={grid}>
          {/* ---------- Configuración del programa ---------- */}
          <section style={col}>
            <h2 style={h2}>Programa</h2>

            <label style={lbl}>Título de la tarjeta</label>
            <input value={prog.titulo} onChange={(e) => set("titulo", e.target.value)} style={input} />

            <label style={lbl}>Color del pase</label>
            <select value={prog.color} onChange={(e) => set("color", e.target.value)} style={input}>
              {COLORES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Sellos para el premio</label>
                <input type="number" min={1} max={50} value={prog.meta}
                  onChange={(e) => set("meta", Number(e.target.value))} style={input} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={lbl}>Premio</label>
                <input value={prog.premio} onChange={(e) => set("premio", e.target.value)} style={input} />
              </div>
            </div>

            <label style={lbl}>Acciones que verá el trabajador</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LISTA_ACCIONES.map((a) => (
                <label key={a.key} style={accion(prog.acciones.includes(a.key))}>
                  <input type="checkbox" checked={prog.acciones.includes(a.key)}
                    onChange={() => toggleAccion(a.key)} />
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{a.label}</strong>
                    <br /><span style={{ opacity: 0.5, fontSize: 13 }}>{a.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>

            <button onClick={guardar} style={primary}>Guardar programa</button>
          </section>

          {/* ---------- Promo + emitir + clientes ---------- */}
          <section style={col}>
            <h2 style={h2}>Promo (push a todos)</h2>
            <input value={promoTexto} onChange={(e) => setPromoTexto(e.target.value)}
              placeholder="Hoy 2x1 en lattes" style={input} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => lanzarPromo(promoTexto)} style={primary}>Lanzar a todas</button>
              <button onClick={() => lanzarPromo("")} style={ghost}>Quitar</button>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Emitir pase · tag NFC</h2>
            <p style={{ opacity: 0.55, fontSize: 13, marginTop: 0 }}>
              Graba esta URL en el tag NFC (con la app <strong>NFC Tools</strong> → Write → Add record → URL).
              También sirve como QR de mostrador. Al escanear/tocar, el móvil crea un pase.
            </p>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {tapQr && <img src={tapQr} alt="QR emitir" width={110} height={110} style={{ background: "#fff", borderRadius: 10, padding: 8 }} />}
              <div>
                <div style={{ fontSize: 12, opacity: 0.6, wordBreak: "break-all", marginBottom: 8 }}>{tapUrl}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiarTap} style={primaryTight}>Copiar URL del tag</button>
                  <button onClick={emitir} style={ghostTight}>Emitir uno ahora</button>
                </div>
              </div>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Clientes ({clientes.length})</h2>
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {clientes.map((c) => (
                <div key={c.serial} style={row}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>
                    {c.nombre || <span style={{ fontFamily: "monospace", opacity: 0.6 }}>{c.serial.slice(0, 8)}…</span>}
                  </span>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>{c.sellos} sellos · {c.premios || 0} 🎁</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <a href={`/p/${c.serial}`} style={link}>pase</a>
                    <a href={`/w/${c.serial}`} style={link}>trabajador</a>
                  </span>
                </div>
              ))}
              {clientes.length === 0 && <p style={{ opacity: 0.5, fontSize: 14 }}>Sin clientes todavía.</p>}
            </div>
          </section>
        </div>

        {msg && <div style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const wrap = { minHeight: "100vh", background: "#0b0b0c", color: "#fff", padding: "2rem 1.5rem", display: "grid", placeItems: "start center" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 12 };
const col = { background: "#141416", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 20 };
const h2 = { fontSize: "1.05rem", fontWeight: 500, margin: "0 0 12px" };
const lbl = { display: "block", fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 6px" };
const input = { width: "100%", boxSizing: "border-box", padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid rgba(255,255,255,.18)", background: "#0e0e10", color: "#fff", fontSize: 15 };
const accion = (on) => ({ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, border: `1px solid ${on ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.1)"}`, background: on ? "#1c1c1f" : "transparent", cursor: "pointer" });
const primary = { marginTop: 16, padding: "0.65rem 1.2rem", borderRadius: 999, border: 0, background: "#fff", color: "#000", fontWeight: 500, cursor: "pointer" };
const ghost = { marginTop: 16, padding: "0.65rem 1.2rem", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", cursor: "pointer" };
const primaryTight = { padding: "0.5rem 1rem", borderRadius: 999, border: 0, background: "#fff", color: "#000", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const ghostTight = { padding: "0.5rem 1rem", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 13 };
const row = { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" };
const link = { color: "#6cf", fontSize: 13, textDecoration: "none" };
const toast = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#000", padding: "10px 18px", borderRadius: 999, fontWeight: 500 };
