"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LISTA_ACCIONES } from "@/lib/acciones";
import LogoutButton from "@/app/LogoutButton";
import QrImagen from "@/app/QrImagen";
import EstadoIntegracion from "./EstadoIntegracion";

// Manager de un negocio. Controla su cartilla, sus acciones, sus promos y dónde
// está la tienda (para que el pase aparezca en la pantalla de bloqueo al llegar).
export default function Manager() {
  const { negocio } = useParams();
  const [n, setN] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [promoTexto, setPromoTexto] = useState("");
  const [ubicacion, setUbicacion] = useState({ lat: "", lng: "" });
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (negocio) cargar();
  }, [negocio]);

  async function cargar() {
    try {
      const [ne, cs] = await Promise.all([
        fetch(`/api/negocio?b=${negocio}`).then((r) => r.json()),
        fetch(`/api/clientes?b=${negocio}`).then((r) => r.json()),
      ]);
      if (ne.error) throw new Error(ne.error);
      setN(ne);
      setPromoTexto(ne.promo || "");
      const u = ne.ubicaciones?.[0];
      setUbicacion(u ? { lat: String(u.lat), lng: String(u.lng) } : { lat: "", lng: "" });
      setClientes(Array.isArray(cs) ? cs : []);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  const set = (k, v) => setN((p) => ({ ...p, [k]: v }));
  function toggleAccion(key) {
    setN((p) => {
      const on = p.acciones.includes(key);
      return { ...p, acciones: on ? p.acciones.filter((a) => a !== key) : [...p.acciones, key] };
    });
  }
  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 3000); }
  const resumenAviso = (a) => (a?.proveedor === "apple" ? ` · ${a.enviadas}/${a.total} iPhone avisados` : "");

  async function guardar() {
    const hayUbicacion = ubicacion.lat.trim() || ubicacion.lng.trim();
    const ubicaciones = hayUbicacion ? [{ lat: ubicacion.lat, lng: ubicacion.lng }] : [];
    const res = await fetch(`/api/negocio?b=${negocio}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: n.meta, premio: n.premio, acciones: n.acciones, ubicaciones }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error || "Error al guardar");
    setN(data);
    flash(`Guardado ✔${resumenAviso(data.aviso)}`);
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) return flash("Este navegador no da la ubicación");
    navigator.geolocation.getCurrentPosition(
      (p) => setUbicacion({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }),
      () => flash("No se pudo obtener la ubicación (da permiso)"),
    );
  }

  async function lanzarPromo(texto) {
    const res = await fetch(`/api/promo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ b: negocio, texto }) });
    const data = await res.json();
    if (!res.ok) return flash(data.error || "Error");
    setPromoTexto(texto);
    setN((p) => ({ ...p, promo: data.promo }));
    flash(data.proveedor === "apple"
      ? `Promo enviada · ${data.enviadas}/${data.total} iPhone avisados`
      : `Promo guardada (${data.total} pases)`);
  }

  async function emitir() {
    const res = await fetch(`/api/crear?b=${negocio}`, { method: "POST" });
    const data = await res.json();
    flash(res.ok ? `Pase emitido: ${data.serial.slice(0, 8)}…` : data.error);
    cargar();
  }

  async function copiarTap() {
    try { await navigator.clipboard.writeText(`${origin}/api/tap?b=${negocio}`); flash("URL del tag copiada ✔"); }
    catch { flash(`${origin}/api/tap?b=${negocio}`); }
  }

  if (error) return <main style={wrap}><p style={{ color: "#ff6b6b" }}>{error}</p></main>;
  if (!n) return <main style={wrap}><p style={{ opacity: 0.5 }}>Cargando…</p></main>;
  const accent = n.tema.accent;
  const tapUrl = `${origin}/api/tap?b=${negocio}`;

  return (
    <main style={wrap}>
      <div style={{ width: "min(1000px, 96vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: "1.8rem", marginBottom: 2 }}>{n.tema.emoji} {n.nombre} · manager</h1>
          <LogoutButton negocio={negocio} />
        </div>
        <p style={{ opacity: 0.55, marginTop: 0 }}>Define qué hace la caja. Los pases se actualizan solos.</p>

        <EstadoIntegracion accent={accent} />

        <div style={grid}>
          <section style={col}>
            <h2 style={h2}>Cartilla</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{n.tipo === "descuento" ? "—" : "Sellos para el premio"}</label>
                <input type="number" min={1} max={50} value={n.meta} disabled={n.tipo === "descuento"} onChange={(e) => set("meta", Number(e.target.value))} style={input} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={lbl}>{n.tipo === "descuento" ? "Descuento" : "Premio"}</label>
                <input value={n.premio} onChange={(e) => set("premio", e.target.value)} style={input} />
              </div>
            </div>

            <label style={lbl}>Acciones que verá la caja</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LISTA_ACCIONES.map((a) => (
                <label key={a.key} style={accionRow(n.acciones.includes(a.key), accent)}>
                  <input type="checkbox" checked={n.acciones.includes(a.key)} onChange={() => toggleAccion(a.key)} />
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span><strong style={{ fontWeight: 500 }}>{a.label}</strong><br /><span style={{ opacity: 0.5, fontSize: 13 }}>{a.descripcion}</span></span>
                </label>
              ))}
            </div>

            <label style={lbl}>Ubicación de la tienda (aviso en pantalla de bloqueo)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={ubicacion.lat} onChange={(e) => setUbicacion((u) => ({ ...u, lat: e.target.value }))} placeholder="Latitud" inputMode="decimal" style={input} />
              <input value={ubicacion.lng} onChange={(e) => setUbicacion((u) => ({ ...u, lng: e.target.value }))} placeholder="Longitud" inputMode="decimal" style={input} />
            </div>
            <button onClick={usarMiUbicacion} style={{ ...ghostTight, marginTop: 8 }}>📍 Usar mi ubicación actual</button>

            <div><button onClick={guardar} style={{ ...primary, background: accent }}>Guardar y actualizar pases</button></div>
          </section>

          <section style={col}>
            <h2 style={h2}>Promo (aviso a todos)</h2>
            <input value={promoTexto} onChange={(e) => setPromoTexto(e.target.value)} placeholder="Hoy 2x1…" maxLength={200} style={input} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => lanzarPromo(promoTexto)} style={{ ...primary, background: accent }}>Lanzar</button>
              <button onClick={() => lanzarPromo("")} style={ghost}>Quitar</button>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Tag NFC / emitir</h2>
            <p style={{ opacity: 0.55, fontSize: 13, marginTop: 0 }}>Graba esta URL en el tag NFC (app NFC Tools → Write → URL) o imprime el QR para el mostrador.</p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {origin && <QrImagen texto={tapUrl} lado={110} style={{ background: "#fff", borderRadius: 10, padding: 8 }} />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, opacity: 0.6, wordBreak: "break-all", marginBottom: 8 }}>{tapUrl}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiarTap} style={{ ...primaryTight, background: accent }}>Copiar URL</button>
                  <button onClick={emitir} style={ghostTight}>Emitir uno</button>
                </div>
              </div>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Clientes ({clientes.length})</h2>
            <div style={{ maxHeight: 240, overflow: "auto" }}>
              {clientes.map((c) => (
                <div key={c.serial} style={rowM}>
                  <span style={{ fontFamily: c.nombre ? "inherit" : "monospace", fontSize: 13, opacity: 0.75 }}>{c.nombre || `${c.serial.slice(0, 8)}…`}</span>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>{c.sellos} · {c.premios || 0} 🎁</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <a href={`/p/${c.serial}`} style={{ ...link, color: accent }}>pase</a>
                    <a href={`/w/${c.serial}`} style={{ ...link, color: accent }}>caja</a>
                  </span>
                </div>
              ))}
              {clientes.length === 0 && <p style={{ opacity: 0.5, fontSize: 14 }}>Sin clientes.</p>}
            </div>
          </section>
        </div>
        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const wrap = { minHeight: "100vh", background: "#0b0b0c", color: "#fff", padding: "2rem 1rem", display: "grid", placeItems: "start center" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22, marginTop: 12 };
const col = { background: "#141416", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 20 };
const h2 = { fontSize: "1.05rem", fontWeight: 500, margin: "0 0 12px" };
const lbl = { display: "block", fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 6px" };
const input = { width: "100%", boxSizing: "border-box", padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid rgba(255,255,255,.18)", background: "#0e0e10", color: "#fff", fontSize: 15 };
const accionRow = (on, accent) => ({ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, border: `1px solid ${on ? accent : "rgba(255,255,255,.1)"}`, background: on ? "#1c1c1f" : "transparent", cursor: "pointer" });
const primary = { marginTop: 16, padding: "0.65rem 1.2rem", borderRadius: 999, border: 0, color: "#fff", fontWeight: 600, cursor: "pointer" };
const ghost = { marginTop: 16, padding: "0.65rem 1.2rem", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", cursor: "pointer" };
const primaryTight = { padding: "0.5rem 1rem", borderRadius: 999, border: 0, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const ghostTight = { padding: "0.5rem 1rem", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 13 };
const rowM = { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" };
const link = { fontSize: 13, textDecoration: "none" };
const toast = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#000", padding: "10px 18px", borderRadius: 999, fontWeight: 500, maxWidth: "90vw", textAlign: "center" };
