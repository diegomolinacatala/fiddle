"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { LISTA_ACCIONES } from "@/lib/acciones";
import LogoutButton from "@/app/LogoutButton";
import QrImagen from "@/app/QrImagen";
import PaseVista from "@/app/PaseVista";
import EstadoIntegracion from "./EstadoIntegracion";
import GrabarTag from "./GrabarTag";
import MarcaTienda from "@/app/MarcaTienda";
import Icono from "@/app/Icono";
import { C, pagina, panel, campo, etiqueta, h2, titulo, subtitulo, botonPrimario, botonSecundario, chipCodigo } from "@/app/ui";

// Manager de un negocio. Controla su cartilla, sus acciones, sus promos y dónde
// está la tienda (para que el pase aparezca en la pantalla de bloqueo al llegar).
// La vista previa enseña, mientras se edita, cómo queda el pase en Apple y Google.
export default function Manager() {
  const { negocio } = useParams();
  const [n, setN] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [promoTexto, setPromoTexto] = useState("");
  const [ubicacion, setUbicacion] = useState({ lat: "", lng: "" });
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState(null);
  const [verPase, setVerPase] = useState("ejemplo"); // serial del pase de la vista previa

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
  // Cuántos teléfonos se enteraron: iPhone (APNs) y Android (avisos web + Google Wallet).
  const resumenAviso = (a) => {
    if (!a) return "";
    const partes = [];
    if (a.proveedor === "apple") partes.push(`${a.enviadas}/${a.total} iPhone`);
    const android = (a.web || 0) + (a.google || 0);
    if (android) partes.push(`${android} Android`);
    return partes.length ? ` · avisados: ${partes.join(", ")}` : "";
  };

  // Cliente de la vista previa: uno real o uno inventado a medida de la cartilla
  // que se está editando (para ver el aspecto antes de tener clientes).
  const clienteVista = useMemo(() => {
    const real = clientes.find((c) => c.serial === verPase);
    if (real) return real;
    return {
      serial: "ejemplo-0000-0000-0000-000000000000",
      codigo: "ABC",
      nombre: "Cliente",
      sellos: Math.max(1, Math.round((n?.meta || 1) * 0.6)),
      premios: 0,
    };
  }, [clientes, verPase, n?.meta]);

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
    flash(`Guardado${resumenAviso(data.aviso)}`);
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
    if (!texto) return flash("Promo retirada de todas las tarjetas");
    const avisados = resumenAviso(data);
    flash(avisados ? `Promo enviada${avisados}` : `Promo puesta en ${data.total} tarjetas`);
  }

  async function emitir() {
    const res = await fetch(`/api/crear?b=${negocio}`, { method: "POST" });
    const data = await res.json();
    flash(res.ok ? `Tarjeta emitida · código ${data.codigo}` : data.error);
    cargar();
  }

  async function copiarTap() {
    try { await navigator.clipboard.writeText(`${origin}/api/tap?b=${negocio}`); flash("URL del tag copiada"); }
    catch { flash(`${origin}/api/tap?b=${negocio}`); }
  }

  if (error) return <main style={pagina}><p style={{ color: C.mal }}>{error}</p></main>;
  if (!n) return <main style={pagina}><p style={{ color: C.suave }}>Cargando…</p></main>;
  const accent = n.tema.accent;
  const tapUrl = `${origin}/api/tap?b=${negocio}`;
  const esEjemplo = clienteVista.serial.startsWith("ejemplo");

  return (
    <main style={pagina}>
      <div style={{ width: "min(1080px, 96vw)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <MarcaTienda tema={n.tema} tam={42} icono />
            <div style={{ minWidth: 0 }}>
              <h1 style={titulo}>{n.nombre}</h1>
              <p style={subtitulo}>Manager · lo que cambies aquí llega solo a las tarjetas de iPhone y Android.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href={`/${negocio}/crm`} style={{ ...botonSecundario, textDecoration: "none", padding: "0.5rem 0.9rem", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icono nombre="clientes" tam={16} /> Clientes
            </a>
            <LogoutButton negocio={negocio} />
          </div>
        </header>

        <EstadoIntegracion accent={accent} />

        <div style={grid}>
          {/* ---------------------------------------------------- cartilla */}
          <section style={panel}>
            <h2 style={h2}>Cartilla</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...etiqueta, marginTop: 0 }}>{n.tipo === "descuento" ? "—" : "Sellos"}</label>
                <input type="number" min={1} max={50} value={n.meta} disabled={n.tipo === "descuento"} onChange={(e) => set("meta", Number(e.target.value))} style={campo} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ ...etiqueta, marginTop: 0 }}>{n.tipo === "descuento" ? "Descuento" : "Premio"}</label>
                <input value={n.premio} onChange={(e) => set("premio", e.target.value)} style={campo} />
              </div>
            </div>

            <label style={etiqueta}>Acciones que verá la caja</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LISTA_ACCIONES.map((a) => (
                <label key={a.key} style={accionRow(n.acciones.includes(a.key), accent)}>
                  <input type="checkbox" checked={n.acciones.includes(a.key)} onChange={() => toggleAccion(a.key)} />
                  <span style={{ color: accent }}><Icono nombre={a.icon} tam={20} /></span>
                  <span>
                    <strong style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</strong><br />
                    <span style={{ color: C.suave, fontSize: 13 }}>{a.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>

            <label style={etiqueta}>Ubicación de la tienda (aviso en pantalla de bloqueo)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={ubicacion.lat} onChange={(e) => setUbicacion((u) => ({ ...u, lat: e.target.value }))} placeholder="Latitud" inputMode="decimal" style={campo} />
              <input value={ubicacion.lng} onChange={(e) => setUbicacion((u) => ({ ...u, lng: e.target.value }))} placeholder="Longitud" inputMode="decimal" style={campo} />
            </div>
            <button onClick={usarMiUbicacion} style={{ ...botonSecundario, marginTop: 8, fontSize: 13, padding: "0.45rem 0.8rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icono nombre="ubicacion" tam={16} /> Usar mi ubicación
            </button>

            <div><button onClick={guardar} style={{ ...botonPrimario(accent), marginTop: 18 }}>Guardar y actualizar pases</button></div>
          </section>

          {/* ------------------------------------------------ vista previa */}
          <section style={panel}>
            <h2 style={h2}>Cómo se ve el pase</h2>
            <select value={verPase} onChange={(e) => setVerPase(e.target.value)} style={{ ...campo, marginBottom: 14 }}>
              <option value="ejemplo">Cliente de ejemplo</option>
              {clientes.map((c) => (
                <option key={c.serial} value={c.serial}>
                  {c.codigo} · {c.nombre || "sin nombre"} · {c.sellos} sellos
                </option>
              ))}
            </select>

            <PaseVista
              negocio={n}
              cliente={clienteVista}
              qrTexto={`${origin}/w/${clienteVista.serial}`}
              pie={esEjemplo ? "Cliente inventado: refleja la cartilla que estás editando." : "Aproximado: el pase definitivo lo dibuja el teléfono."}
            />
          </section>

          {/* ------------------------------------- promo · tag · clientes */}
          <section style={panel}>
            <h2 style={h2}>Promo (aviso a todos)</h2>
            <p style={{ color: C.suave, fontSize: 13, margin: "-6px 0 10px" }}>
              Sale en la tarjeta de todos tus clientes y les suena en el móvil: iPhone y Android.
            </p>
            <input value={promoTexto} onChange={(e) => setPromoTexto(e.target.value)} placeholder="Hoy 2x1…" maxLength={200} style={campo} />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={() => lanzarPromo(promoTexto)} style={botonPrimario(accent)}>Lanzar</button>
              <button onClick={() => lanzarPromo("")} style={botonSecundario}>Quitar</button>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Tag NFC y QR del mostrador</h2>
            <p style={{ color: C.suave, fontSize: 13, margin: "0 0 10px" }}>
              Quien toque el tag o escanee este QR se lleva su tarjeta: en iPhone va a Apple Wallet y en
              Android se queda en el móvil. Si vuelve a tocarlo, se le abre la suya, no una nueva.
            </p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {origin && <QrImagen texto={tapUrl} lado={104} style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 6 }} />}
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 12, color: C.tenue, wordBreak: "break-all", marginBottom: 8 }}>{tapUrl}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiarTap} style={{ ...botonPrimario(accent), padding: "0.45rem 0.85rem", fontSize: 13 }}>Copiar URL</button>
                  <button onClick={emitir} style={{ ...botonSecundario, padding: "0.45rem 0.85rem", fontSize: 13 }}>Emitir uno</button>
                </div>
              </div>
            </div>
            <GrabarTag url={origin ? tapUrl : null} accent={accent} />

            <h2 style={{ ...h2, marginTop: 26 }}>Clientes ({clientes.length})</h2>
            <p style={{ color: C.suave, fontSize: 13, margin: "-6px 0 10px" }}>
              El código de 3 caracteres identifica al cliente dentro de esta tienda. Tócalo para ver su pase.
              Quién viene, quién dejó de venir y a quién avisar está en <a href={`/${negocio}/crm`} style={{ color: accent }}>Clientes</a>.
            </p>
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {clientes.map((c) => (
                <div key={c.serial} style={filaCliente}>
                  <button type="button" onClick={() => setVerPase(c.serial)} style={{ ...chipCodigo(accent), cursor: "pointer" }} title="Ver este pase">
                    {c.codigo}
                  </button>
                  <span style={{ fontSize: 13, color: C.suave, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.nombre || "sin nombre"}
                  </span>
                  <span style={{ fontSize: 13, color: C.suave, whiteSpace: "nowrap" }}>
                    {n.tipo === "descuento" ? (c.premios ? "usado" : "válido") : `${c.sellos}/${n.meta}${c.premios ? ` · ${c.premios} premio${c.premios === 1 ? "" : "s"}` : ""}`}
                  </span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <a href={`/p/${c.serial}`} style={{ ...enlace, color: accent }}>pase</a>
                    <a href={`/w/${c.serial}`} style={{ ...enlace, color: accent }}>caja</a>
                  </span>
                </div>
              ))}
              {clientes.length === 0 && <p style={{ color: C.suave, fontSize: 14 }}>Sin clientes todavía.</p>}
            </div>
          </section>
        </div>

        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginTop: 16, alignItems: "start" };
const accionRow = (on, accent) => ({
  display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10,
  border: `1px solid ${on ? accent : C.borde}`, background: on ? `${accent}0f` : "#fff", cursor: "pointer",
});
const filaCliente = { display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.borde}` };
const enlace = { fontSize: 13, textDecoration: "none" };
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
