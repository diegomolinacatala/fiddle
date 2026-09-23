"use client";

import { useEffect, useMemo, useState } from "react";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { normalizarCodigo } from "@/lib/codigo";
import QrImagen from "@/app/QrImagen";
import PaseVista from "@/app/PaseVista";
import GrabarTag from "./GrabarTag";
import CabeceraGestion from "../CabeceraGestion";
import Icono from "@/app/Icono";
import { C, pagina, panel, campo, etiqueta, h2, botonPrimario, botonSecundario, botonPequeno, chipCodigo } from "@/app/ui";

// Manager de un negocio: la cartilla, las acciones de la caja, dónde está la
// tienda, la promo y el tag/QR del mostrador. La vista previa enseña, mientras
// se edita, cómo queda el pase. Los clientes tienen su propia pestaña (CRM):
// aquí no se listan, que con cientos la página no acabaría nunca.
// Llega con el negocio ya cargado en el servidor (page.js).
export default function PanelManager({ negocio, inicial }) {
  const [n, setN] = useState(inicial);
  const [promoTexto, setPromoTexto] = useState(inicial.promo || "");
  const [ubicacion, setUbicacion] = useState(() => {
    const u = inicial.ubicaciones?.[0];
    return u ? { lat: String(u.lat), lng: String(u.lng) } : { lat: "", lng: "" };
  });
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const [real, setReal] = useState(null); // cliente real en la vista previa (null = ejemplo)
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  // Cliente de ejemplo a medida de la cartilla que se está editando: con dos
  // cartillas, las dos a medias (antes solo se rellenaba la primera).
  const clienteVista = useMemo(() => {
    if (real) return real;
    const aMedias = (meta) => Math.max(1, Math.round((meta || 1) * 0.6));
    return {
      serial: "ejemplo-0000-0000-0000-000000000000",
      codigo: "ABC",
      nombre: "Cliente",
      sellos: aMedias(n?.cartillas?.[0]?.meta ?? n?.meta),
      sellos2: n?.cartillas?.[1] ? aMedias(n.cartillas[1].meta) - 1 : 0,
      premios: 0,
    };
  }, [real, n?.meta, n?.cartillas]);

  async function verCliente(e) {
    e.preventDefault();
    const cod = normalizarCodigo(codigo);
    if (!cod) return flash("Escribe el código de 3 caracteres del cliente");
    const r = await fetch(`/api/clientes?b=${negocio}&codigo=${cod}`);
    const data = await r.json();
    if (!r.ok) return flash(data.error || "No encontrado");
    setReal(data);
  }

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
  }

  async function copiarTap() {
    try { await navigator.clipboard.writeText(`${origin}/api/tap?b=${negocio}`); flash("Enlace copiado"); }
    catch { flash(`${origin}/api/tap?b=${negocio}`); }
  }

  const accent = n.tema.accent;
  const tapUrl = `${origin}/api/tap?b=${negocio}`;
  const esCupon = n.tipo === "descuento";

  return (
    <main style={pagina}>
      <div style={{ width: "min(1080px, 96vw)" }}>
        <CabeceraGestion negocio={n} slug={negocio} activa="manager" />

        <div style={grid}>
          {/* ---------------------------------------------------- cartilla */}
          <section style={panel}>
            <h2 style={h2}>{esCupon ? "Cupón" : "Cartilla"}</h2>
            <div style={{ display: "flex", gap: 12 }}>
              {!esCupon && (
                <div style={{ flex: 1 }}>
                  <label style={{ ...etiqueta, marginTop: 0 }}>Sellos</label>
                  <input type="number" min={1} max={50} value={n.meta} onChange={(e) => set("meta", Number(e.target.value))} style={campo} />
                </div>
              )}
              <div style={{ flex: 2 }}>
                <label style={{ ...etiqueta, marginTop: 0 }}>{esCupon ? "Descuento" : "Premio"}</label>
                <input value={n.premio} onChange={(e) => set("premio", e.target.value)} style={campo} />
              </div>
            </div>

            <label style={etiqueta}>Botones de la caja</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LISTA_ACCIONES.map((a) => (
                <label key={a.key} style={accionRow(n.acciones.includes(a.key), accent)}>
                  <input type="checkbox" checked={n.acciones.includes(a.key)} onChange={() => toggleAccion(a.key)} />
                  <span style={{ color: accent, display: "inline-flex" }}><Icono nombre={a.icon} tam={20} /></span>
                  <span>
                    <strong style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</strong><br />
                    <span style={{ color: C.suave, fontSize: 13 }}>{a.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>

            <label style={etiqueta}>Ubicación de la tienda</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={ubicacion.lat} onChange={(e) => setUbicacion((u) => ({ ...u, lat: e.target.value }))} placeholder="Latitud" inputMode="decimal" style={campo} />
              <input value={ubicacion.lng} onChange={(e) => setUbicacion((u) => ({ ...u, lng: e.target.value }))} placeholder="Longitud" inputMode="decimal" style={campo} />
            </div>
            <button onClick={usarMiUbicacion} style={{ ...botonPequeno, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icono nombre="ubicacion" tam={16} /> Usar mi ubicación
            </button>

            <div><button onClick={guardar} style={{ ...botonPrimario(accent), marginTop: 18 }}>Guardar y actualizar pases</button></div>
          </section>

          {/* ------------------------------------------------ vista previa */}
          <section style={panel}>
            <h2 style={h2}>Vista previa del pase</h2>
            <form onSubmit={verCliente} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Código de un cliente"
                maxLength={3}
                autoCapitalize="characters"
                style={codigo ? { ...campo, fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: 2 } : campo}
              />
              <button type="submit" style={{ ...botonSecundario, flexShrink: 0 }}>Ver</button>
            </form>
            {real && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "-4px 0 12px", fontSize: 13, color: C.suave }}>
                <span style={chipCodigo(accent)}>{real.codigo}</span>
                {real.nombre || "Sin nombre"}
                <button type="button" onClick={() => { setReal(null); setCodigo(""); }} style={{ ...botonPequeno, marginLeft: "auto" }}>
                  Ver ejemplo
                </button>
              </div>
            )}

            <PaseVista negocio={n} cliente={clienteVista} qrTexto={`${origin}/w/${clienteVista.serial}`} />
          </section>

          {/* ------------------------------------------------- promo · tag */}
          <section style={panel}>
            <h2 style={h2}>Promo</h2>
            <p style={texto}>Sale en todas las tarjetas y avisa en el móvil.</p>
            <input value={promoTexto} onChange={(e) => setPromoTexto(e.target.value)} placeholder="Hoy 2x1…" maxLength={200} style={campo} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => lanzarPromo(promoTexto)} style={botonPrimario(accent)}>Lanzar</button>
              <button onClick={() => lanzarPromo("")} style={botonSecundario}>Quitar</button>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Tag NFC y QR del mostrador</h2>
            <p style={texto}>Quien lo toque o escanee se lleva su tarjeta.</p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {origin && <QrImagen texto={tapUrl} lado={104} style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 6 }} />}
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 12, color: C.tenue, wordBreak: "break-all", marginBottom: 8 }}>{tapUrl}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiarTap} style={botonPequeno}>Copiar enlace</button>
                  <button onClick={emitir} style={botonPequeno}>Emitir una</button>
                </div>
              </div>
            </div>
            <GrabarTag url={origin ? tapUrl : null} accent={accent} />
          </section>
        </div>

        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginTop: 20, alignItems: "start" };
const texto = { color: C.suave, fontSize: 13, margin: "-6px 0 10px" };
const accionRow = (on, accent) => ({
  display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10,
  border: `1px solid ${on ? accent : C.borde}`, background: on ? `${accent}0f` : "#fff", cursor: "pointer",
});
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
