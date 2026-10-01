"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizarCodigo } from "@/lib/codigo";
import { estadoDeTienda, resumenHorario } from "@/lib/horario";
import QrImagen from "@/app/QrImagen";
import PaseVista from "@/app/PaseVista";
import GrabarTag from "./GrabarTag";
import Horario from "./Horario";
import MapaUbicacion from "./MapaUbicacion";
import EditorTarjeta from "./EditorTarjeta";
import EditorCaja from "./EditorCaja";
import { normalizarCaja } from "@/lib/caja";
import Recorrido from "@/app/Recorrido";
import { FilaInterruptor } from "@/app/Interruptor";
import CabeceraGestion from "../CabeceraGestion";
import Bloque from "../Bloque";
import Icono from "@/app/Icono";
import { C, pagina, panel, campo, h2, botonPrimario, botonSecundario, botonPequeno, chipCodigo, RADIO } from "@/app/ui";

// La pestaña TIENDA: cómo es la tarjeta (cartillas y premios), qué botones
// tiene la caja, cuándo abre y dónde está la tienda, y el tag/QR del mostrador.
// La vista previa enseña, mientras se edita, cómo queda el pase.
//
// A la izquierda, una fila por cosa, todas con la misma forma (Bloque.js): lo
// que se pone una vez (horario, mapa) va plegado y se abre con su botón. Lo de
// la cuenta (la contraseña de la caja) vive en Ajustes; lo que se les DICE a los
// clientes, en Avisos; la lista de clientes, en Clientes. Cada cosa en un solo
// sitio. Llega con el negocio ya cargado en el servidor (page.js).
export default function PanelManager({ negocio, inicial, reloj = false }) {
  const [n, setN] = useState(inicial);
  // Una sola ubicación (la tienda). Se guarda entera para no perder su `texto`.
  const guardada = n.ubicaciones?.[0] || null;
  const [ubicacion, setUbicacion] = useState(guardada);
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const [real, setReal] = useState(null); // cliente real en la vista previa (null = ejemplo)
  const [codigo, setCodigo] = useState("");
  const [abierto, setAbierto] = useState(null); // "horario" | "mapa" | null: lo plegado que está abierto
  const [editando, setEditando] = useState(false);
  const [editandoCaja, setEditandoCaja] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    // El enlace de Avisos ("Poner horario") llega con #horario: abierto y a la vista.
    if (window.location.hash === "#horario") {
      setAbierto("horario");
      requestAnimationFrame(() => document.getElementById("horario")?.scrollIntoView({ behavior: "smooth" }));
    }
  }, []);

  const set = (k, v) => setN((p) => ({ ...p, [k]: v }));
  function flash(m) {
    setMsg(m);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setMsg(null), 3000);
  }
  // Cuántos teléfonos se enteraron: iPhone (APNs) y Android (avisos web + Google Wallet).
  const resumenAviso = (a) => {
    if (!a) return "";
    const partes = [];
    if (a.proveedor === "apple") partes.push(`${a.enviadas}/${a.total} iPhone`);
    const android = (a.web || 0) + (a.google || 0);
    if (android) partes.push(`${android} Android`);
    return partes.length ? ` · avisados: ${partes.join(", ")}` : "";
  };
  const plegar = (que) => setAbierto((a) => (a === que ? null : que));

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

  /** Guarda una pieza suelta de la tienda (PUT /api/negocio). Devuelve lo guardado o null. */
  async function guardarPieza(cambios) {
    try {
      const res = await fetch(`/api/negocio?b=${negocio}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error || "No se pudo guardar"); return null; }
      return data;
    } catch {
      flash("Sin conexión: no se ha guardado");
      return null;
    }
  }

  async function guardarUbicacion() {
    const data = await guardarPieza({ ubicaciones: ubicacion ? [ubicacion] : [] });
    if (!data) return;
    setN(data);
    setAbierto(null);
    flash(`Ubicación guardada${resumenAviso(data.aviso)}`);
  }

  // Se guarda al tocarlo: no sale en el pase, así que no espera a ningún botón.
  async function cambiarPedirNombre(pedirNombre) {
    set("pedirNombre", pedirNombre);
    const data = await guardarPieza({ pedirNombre });
    if (!data) return set("pedirNombre", !pedirNombre);
    setN((p) => ({ ...p, pedirNombre: data.pedirNombre }));
    flash(pedirNombre ? "Al escanear se pedirá el nombre" : "Al escanear irán directos a la Wallet");
  }

  // «● Abierto hasta las…» en la tarjeta: la misma pieza que en Editar tarjeta.
  async function cambiarEnPase(on) {
    const antes = n.tema;
    setN((p) => ({ ...p, tema: { ...p.tema, abierto: on } }));
    const data = await guardarPieza({ tema: { abierto: on } });
    if (!data) return setN((p) => ({ ...p, tema: antes }));
    setN(data);
    flash(on ? `La tarjeta dirá si estás abierto${resumenAviso(data.aviso)}` : `La tarjeta ya no dice si estás abierto${resumenAviso(data.aviso)}`);
  }

  async function copiarTap() {
    try { await navigator.clipboard.writeText(tapUrl); flash("Enlace copiado"); }
    catch { flash(tapUrl); }
  }

  // El estado del pase con la hora de la tienda. `origin` vacío = aún en el
  // servidor: sin hora, para que el HTML de servidor y el del navegador casen.
  // Sin mirar si está apagada: el editor la necesita para enseñar qué pasa al encenderla.
  const estadoReloj = reloj && origin ? estadoDeTienda({ ...n, tema: { ...n.tema, abierto: true } }, Date.now()) : null;
  const estadoVista = n.tema.abierto === false ? null : estadoReloj;
  const accent = n.tema.accent;
  const tapUrl = `${origin}/api/tap?b=${negocio}`;
  const esCupon = n.tipo === "descuento";
  const mapaCambiado = JSON.stringify(ubicacion) !== JSON.stringify(guardada);

  return (
    <main style={pagina}>
      <div style={{ width: "min(1080px, 100%)" }}>
        <CabeceraGestion negocio={n} slug={negocio} activa="manager" ayuda />

        <div style={grid}>
          {/* ------------------------------------------------ la tienda */}
          <section style={{ ...panel, paddingTop: 6, paddingBottom: 6 }}>
            {/* Sellos, premio, colores, logo… todo lo que se VE en la tarjeta se
                cambia tocándolo en ella, en el editor. Aquí solo el resumen. */}
            <Bloque
              primero data-recorrido="cartilla" accent={accent} icono="cartera" titulo="Tu tarjeta"
              resumen={esCupon
                ? `Cupón · ${n.premio}`
                : (n.cartillas || [{ meta: n.meta, premio: n.premio }]).map((c) => `${c.meta} sellos · ${c.premio}`).join(" — ")}
              accion={{ texto: "Editar tarjeta", icono: "editar", onClick: () => setEditando(true) }}
            />
            {/* La caja: qué puede hacer y cómo se ve, en su editor con vista previa. */}
            <Bloque
              data-recorrido="botones-caja" accent={accent} icono="movil" titulo="La caja" resumen={resumenCaja(n)}
              accion={{ texto: "Editar vista de caja", icono: "editar", onClick: () => setEditandoCaja(true) }}
            />
            <Bloque
              id="horario" data-recorrido="horario" accent={accent} icono="reloj" titulo="Horario"
              resumen={n.horario ? resumenHorario(n.horario) : "Sin horario: los avisos automáticos no salen hasta que lo pongas."}
              falta={!n.horario} abierto={abierto === "horario"}
              accion={{
                texto: abierto === "horario" ? "Cerrar" : n.horario ? "Cambiar horario" : "Poner horario",
                icono: abierto === "horario" ? "cerrar" : "editar",
                onClick: () => plegar("horario"),
              }}
            >
              <Horario
                slug={negocio} inicial={n.horario} accent={accent} flash={flash} reloj={reloj}
                onGuardado={(data) => { setN(data); setAbierto(null); }}
                enPase={n.tema.abierto !== false} onEnPase={cambiarEnPase}
              />
            </Bloque>
            <Bloque
              data-recorrido="ubicacion" accent={accent} icono="ubicacion" titulo="Ubicación"
              resumen={guardada ? "Puesta: el iPhone saca la tarjeta al pasar cerca." : "Sin poner: la tarjeta no aparece sola al acercarse."}
              abierto={abierto === "mapa"}
              accion={{
                texto: abierto === "mapa" ? (mapaCambiado ? "Descartar" : "Cerrar") : guardada ? "Cambiar" : "Elegir en el mapa",
                icono: abierto === "mapa" ? "cerrar" : "ubicacion",
                onClick: () => { setUbicacion(guardada); plegar("mapa"); },
              }}
            >
              <MapaUbicacion valor={ubicacion} onChange={(v) => setUbicacion(v && { ...ubicacion, ...v })} accent={accent} flash={flash} />
              <button type="button" onClick={guardarUbicacion} disabled={!mapaCambiado}
                style={{ ...botonPrimario(accent), marginTop: 12, opacity: mapaCambiado ? 1 : 0.45 }}>
                Guardar ubicación
              </button>
            </Bloque>
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
            {n.horario && !reloj && n.tema.abierto !== false && (
              <p style={{ ...texto, margin: "10px 0 0" }}>
                Con el reloj de los avisos en marcha, el pase dirá también si la tienda está abierta.
              </p>
            )}
          </section>

          {/* ------------------------------------------------ el mostrador */}
          <section style={panel} data-recorrido="tag">
            <h2 style={h2}>QR y tag del mostrador</h2>
            <p style={texto}>
              {n.pedirNombre
                ? "Quien lo toque o escanee escribe su nombre y se lleva su tarjeta."
                : "Quien lo toque o escanee se lleva su tarjeta, sin escribir nada."}
            </p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {origin && <QrImagen texto={tapUrl} lado={104} style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 6 }} />}
              {/* El enlace con su botón de copiar, como un campo: no hace falta otro botón. */}
              <div style={enlace}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: C.suave }} title={tapUrl}>
                  {tapUrl}
                </span>
                <button type="button" onClick={copiarTap} aria-label="Copiar el enlace" title="Copiar el enlace" style={botonCopiar}>
                  <Icono nombre="copiar" tam={16} />
                </button>
              </div>
            </div>
            <GrabarTag url={origin ? tapUrl : null} accent={accent} />

            <FilaInterruptor
              data-recorrido="pedir-nombre" style={{ marginTop: 14 }}
              on={Boolean(n.pedirNombre)} onClick={() => cambiarPedirNombre(!n.pedirNombre)} accent={accent}
              titulo="Pedir el nombre al escanear"
              texto="Un paso más antes de la Wallet, pero la caja sabe quién es cada uno."
            />
          </section>
        </div>

        {editando && (
          <EditorTarjeta
            inicial={n}
            slug={negocio}
            origin={origin}
            estado={estadoReloj}
            onCerrar={() => setEditando(false)}
            onGuardado={(data) => { setN(data); setEditando(false); setReal(null); flash(`Tarjeta guardada${resumenAviso(data.aviso)}`); }}
          />
        )}
        {editandoCaja && (
          <EditorCaja
            negocio={n}
            slug={negocio}
            onCerrar={() => setEditandoCaja(false)}
            onGuardado={(data) => { setN(data); setEditandoCaja(false); flash("Vista de la caja guardada"); }}
          />
        )}
        {msg && <div role="status" style={toast}>{msg}</div>}
        <Recorrido recorrido="manager" accent={accent} />
      </div>
    </main>
  );
}

/** "Suma y quita · da premios · +2 · vuelve al escáner": lo que hace la caja, en una línea. */
function resumenCaja(n) {
  const caja = normalizarCaja(n.caja);
  const a = n.acciones || [];
  const partes = n.tipo === "descuento"
    ? [a.includes("canjear") && "aplica el descuento"]
    : [
        a.includes("sellar") && (a.includes("restar") ? "suma y quita sellos" : "suma sellos"),
        a.includes("canjear") && (caja.guardarPremios ? "da o guarda premios" : "da premios"),
        caja.sumarDos && "botón +2",
      ];
  partes.push(a.includes("confirmar") && "confirma visitas", caja.volverAlEscaner && "vuelve sola al escáner");
  const lista = partes.filter(Boolean);
  return lista.length ? `${lista[0].charAt(0).toUpperCase()}${lista.join(" · ").slice(1)}.` : "No tiene ningún botón activado.";
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20, marginTop: 20, alignItems: "start" };
const texto = { color: C.suave, fontSize: 13, margin: "-6px 0 10px" };
const enlace = {
  flex: "1 1 170px", minWidth: 0, display: "flex", alignItems: "center", gap: 6, padding: "4px 4px 4px 10px",
  border: `1px solid ${C.bordeFuerte}`, borderRadius: RADIO.boton, background: C.panelSuave,
};
const botonCopiar = {
  width: 34, height: 34, flexShrink: 0, display: "grid", placeItems: "center", padding: 0, cursor: "pointer",
  border: `1px solid ${C.borde}`, borderRadius: 8, background: "#fff", color: C.texto,
};
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
