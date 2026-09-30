"use client";

import { useEffect, useMemo, useState } from "react";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { normalizarCodigo } from "@/lib/codigo";
import { estadoParaPase } from "@/lib/horario";
import QrImagen from "@/app/QrImagen";
import PaseVista from "@/app/PaseVista";
import GrabarTag from "./GrabarTag";
import Horario from "./Horario";
import MapaUbicacion from "./MapaUbicacion";
import Recorrido from "@/app/Recorrido";
import ClaveNueva from "@/app/ClaveNueva";
import CabeceraGestion from "../CabeceraGestion";
import Icono from "@/app/Icono";
import { C, pagina, panel, campo, etiqueta, h2, botonPrimario, botonSecundario, botonPequeno, chipCodigo } from "@/app/ui";

// La pestaña TIENDA: cómo es la tarjeta (cartillas y premios), qué botones
// tiene la caja, dónde está y cuándo abre la tienda, y el tag/QR del
// mostrador. La vista previa enseña, mientras se edita, cómo queda el pase.
// Lo que se les DICE a los clientes (la promo, los grupos, los avisos
// automáticos) vive en Avisos, y la lista de clientes en Clientes: cada cosa en
// un solo sitio. Llega con el negocio ya cargado en el servidor (page.js).
export default function PanelManager({ negocio, inicial, reloj = false }) {
  const [n, setN] = useState(inicial);
  // Una sola ubicación (la tienda). Se guarda entera para no perder su `texto`.
  const [ubicacion, setUbicacion] = useState(() => inicial.ubicaciones?.[0] || null);
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const [real, setReal] = useState(null); // cliente real en la vista previa (null = ejemplo)
  const [codigo, setCodigo] = useState("");
  const [claveCaja, setClaveCaja] = useState(null); // contraseña nueva de la caja, se ve una vez

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const set = (k, v) => setN((p) => ({ ...p, [k]: v }));
  // Con dos cartillas se cambian una a una (meta y premio; nombre y dibujo son del admin).
  const setCartilla = (i, k, v) => setN((p) => ({ ...p, cartillas: p.cartillas.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
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
    const ubicaciones = ubicacion ? [ubicacion] : [];
    const res = await fetch(`/api/negocio?b=${negocio}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(n.cartillas
          ? { cartillas: n.cartillas.map(({ meta, premio }) => ({ meta, premio })) }
          : { meta: n.meta, premio: n.premio }),
        acciones: n.acciones,
        ubicaciones,
      }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error || "Error al guardar");
    setN(data);
    flash(`Guardado${resumenAviso(data.aviso)}`);
  }

  // Se guarda al tocarlo: no sale en el pase, así que no espera al botón de la cartilla.
  async function cambiarPedirNombre(pedirNombre) {
    set("pedirNombre", pedirNombre);
    const res = await fetch(`/api/negocio?b=${negocio}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedirNombre }),
    });
    const data = await res.json();
    if (!res.ok) {
      set("pedirNombre", !pedirNombre);
      return flash(data.error || "No se pudo guardar");
    }
    setN((p) => ({ ...p, pedirNombre: data.pedirNombre }));
    flash(pedirNombre ? "Al escanear se pedirá el nombre" : "Al escanear irán directos a la Wallet");
  }

  async function emitir() {
    const res = await fetch(`/api/crear?b=${negocio}`, { method: "POST" });
    const data = await res.json();
    flash(res.ok ? `Tarjeta emitida · código ${data.codigo}` : data.error);
  }

  // Un empleado que se va, un móvil perdido: contraseña nueva y la vieja deja de valer.
  async function cambiarClaveCaja() {
    if (!window.confirm(`¿Cambiar la contraseña de la caja?

La actual dejará de valer para entrar. Tendrás que escribir la nueva en el móvil de la caja.`)) return;
    const res = await fetch(`/api/accesos/caja?b=${negocio}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return flash(data.error || "No se pudo cambiar");
    setClaveCaja(data);
  }

  async function copiarTap() {
    try { await navigator.clipboard.writeText(`${origin}/api/tap?b=${negocio}`); flash("Enlace copiado"); }
    catch { flash(`${origin}/api/tap?b=${negocio}`); }
  }

  // El estado del pase con la hora de la tienda. `origin` vacío = aún en el
  // servidor: sin hora, para que el HTML de servidor y el del navegador casen.
  const estadoVista = reloj && origin ? estadoParaPase(n.horario, Date.now()) : null;
  const accent = n.tema.accent;
  const tapUrl = `${origin}/api/tap?b=${negocio}`;
  const esCupon = n.tipo === "descuento";

  return (
    <main style={pagina}>
      <div style={{ width: "min(1080px, 100%)" }}>
        <CabeceraGestion negocio={n} slug={negocio} activa="manager" ayuda />

        <div style={grid}>
          {/* ---------------------------------------------------- cartilla */}
          <section style={panel}>
            <div data-recorrido="cartilla">
            <h2 style={h2}>{esCupon ? "Cupón" : n.cartillas ? "Cartillas" : "Cartilla"}</h2>
            {!esCupon && n.cartillas ? (
              n.cartillas.map((c, i) => (
                <div key={c.nombre} style={{ display: "flex", gap: 12, marginTop: i ? 12 : 0 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...etiqueta, marginTop: 0 }} htmlFor={`meta-${i}`}>{c.nombre}</label>
                    <input id={`meta-${i}`} type="number" min={1} max={20} value={c.meta} onChange={(e) => setCartilla(i, "meta", Number(e.target.value))} style={campo} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ ...etiqueta, marginTop: 0 }} htmlFor={`premio-${i}`}>Premio</label>
                    <input id={`premio-${i}`} value={c.premio} onChange={(e) => setCartilla(i, "premio", e.target.value)} style={campo} />
                  </div>
                </div>
              ))
            ) : (
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
            )}

            </div>

            <div data-recorrido="botones-caja">
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

            </div>

            <div data-recorrido="ubicacion">
            <label style={etiqueta}>Ubicación de la tienda</label>
            <MapaUbicacion
              valor={ubicacion}
              onChange={(v) => setUbicacion(v && { ...ubicacion, ...v })}
              accent={accent}
              flash={flash}
            />
            </div>

            <div><button onClick={guardar} style={{ ...botonPrimario(accent), marginTop: 18 }}>Guardar y actualizar pases</button></div>
          </section>

          {/* ------------------------------------------------ vista previa */}
          <section style={panel} data-recorrido="vista-previa">
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

            <PaseVista negocio={n} cliente={clienteVista} qrTexto={`${origin}/w/${clienteVista.serial}`} estado={estadoVista} />
            {n.horario && !reloj && (
              <p style={{ ...texto, margin: "10px 0 0" }}>
                Con el reloj de los avisos en marcha, el pase dirá también si la tienda está abierta.
              </p>
            )}
          </section>

          {/* ---------------------------------------- horario · tag · caja */}
          <section style={panel}>
            <div data-recorrido="horario">
            <Horario slug={negocio} inicial={n.horario} accent={accent} flash={flash} onGuardado={(data) => setN(data)} />
            </div>

            <div data-recorrido="tag">
            <h2 style={{ ...h2, marginTop: 26, paddingTop: 20, borderTop: `1px solid ${C.borde}` }}>Tag NFC y QR del mostrador</h2>
            <p style={texto}>
              {n.pedirNombre
                ? "Quien lo toque o escanee escribe su nombre y se lleva su tarjeta."
                : "Quien lo toque o escanee se lleva su tarjeta, sin escribir nada."}
            </p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {origin && <QrImagen texto={tapUrl} lado={104} style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 6 }} />}
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 12, color: C.tenue, wordBreak: "break-all", marginBottom: 8 }}>{tapUrl}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={copiarTap} style={{ ...botonPequeno, whiteSpace: "nowrap" }}>Copiar enlace</button>
                  <button onClick={emitir} style={{ ...botonPequeno, whiteSpace: "nowrap" }}>Emitir una</button>
                </div>
              </div>
            </div>
            <GrabarTag url={origin ? tapUrl : null} accent={accent} />

            <label style={{ ...accionRow(n.pedirNombre, accent), marginTop: 14 }} data-recorrido="pedir-nombre">
              <input type="checkbox" checked={Boolean(n.pedirNombre)} onChange={(e) => cambiarPedirNombre(e.target.checked)} />
              <span>
                <strong style={{ fontWeight: 600, fontSize: 14 }}>Pedir el nombre al escanear</strong><br />
                <span style={{ color: C.suave, fontSize: 13 }}>
                  Un paso más antes de la Wallet, pero la caja sabe quién es cada uno.
                </span>
              </span>
            </label>
            </div>

            <h2 style={{ ...h2, marginTop: 26 }}>Acceso de la caja</h2>
            <p style={texto}>Usuario <strong style={{ color: C.texto }}>{negocio}-caja</strong></p>
            <button onClick={cambiarClaveCaja} style={botonPequeno}>Cambiar contraseña de la caja</button>
            {claveCaja && <ClaveNueva accesos={[claveCaja]} onCerrar={() => setClaveCaja(null)} />}
          </section>
        </div>

        {msg && <div role="status" style={toast}>{msg}</div>}
        <Recorrido recorrido="manager" accent={accent} />
      </div>
    </main>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20, marginTop: 20, alignItems: "start" };
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
