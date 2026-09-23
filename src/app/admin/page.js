"use client";

import Icono from "@/app/Icono";
import MarcaTienda from "@/app/MarcaTienda";
import { useEffect, useState } from "react";
import LogoutButton from "@/app/LogoutButton";
import { ESTILOS, MARCAS, FORMAS, BANDAS, MODOS, temaPorDefecto } from "@/lib/negocios";
import Selector from "@/app/admin/Selector";
import EstadoIntegracion from "@/app/admin/EstadoIntegracion";
import { vistaMarca, vistaForma, vistaBanda, vistaModo, vistaPlantilla, ROTULO, ROTULO_PLANTILLA } from "@/app/admin/vistas";
import { C, pagina, panel, campo, etiqueta, h2, titulo, botonPrimario, botonSecundario, aviso, solapa } from "@/app/ui";

// ============================================================================
// ADMIN DE LA PLATAFORMA — lista de tiendas
// ----------------------------------------------------------------------------
// Aquí no se lleva una tienda: se llevan TODAS. Crear, entrar a editar, archivar
// y (desde la pestaña de archivadas) borrar del todo.
//
// Crear pide cuatro datos y un BRIEF en texto libre: el brief es para Claude,
// que luego rellena lo que falte. La idea es poder montar una tienda a mano sin
// tener que pedirlo todo por chat.
// ============================================================================

const AZUL = "#2563eb";

export default function Admin() {
  const [pestana, setPestana] = useState("activas");
  const [negocios, setNegocios] = useState(null);
  const [abriendo, setAbriendo] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [borrando, setBorrando] = useState(null); // slug cuyo borrado se está confirmando

  useEffect(() => { cargar(pestana); }, [pestana]);

  async function cargar(cual = pestana) {
    setNegocios(null);
    try {
      const r = await fetch(`/api/admin/negocios?archivados=${cual === "archivadas" ? 1 : 0}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cargar");
      setNegocios(d);
      setError(null);
    } catch (e) {
      setError(String(e?.message || e));
      setNegocios([]);
    }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 3500); }

  async function archivar(slug, modo) {
    const r = await fetch(`/api/admin/negocios?slug=${slug}&modo=${modo}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return flash(d.error || "Error");
    flash(modo === "archivar" ? "Tienda archivada" : "Tienda recuperada");
    cargar();
  }

  async function borrarDelTodo(n, escrito) {
    const r = await fetch(
      `/api/admin/negocios?slug=${n.slug}&modo=borrar&confirmar=${encodeURIComponent(escrito)}`,
      { method: "DELETE" },
    );
    const d = await r.json();
    if (!r.ok) return flash(d.error || "Error");
    setBorrando(null);
    flash(`"${n.nombre}" borrada · ${d.clientes} cliente(s)`);
    cargar();
  }

  return (
    <main style={pagina}>
      <div style={{ width: "min(960px, 96vw)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 style={titulo}>Plataforma</h1>
          </div>
          <LogoutButton />
        </header>

        {/* Certificados, base de datos, avisos, cifrado: es cosa de la plataforma, no de cada tienda. */}
        <EstadoIntegracion accent={AZUL} />

        <div style={{ display: "flex", gap: 8, margin: "18px 0 14px" }}>
          {[["activas", "Tiendas"], ["archivadas", "Archivadas"]].map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setPestana(id)} style={solapa(pestana === id)}>{texto}</button>
          ))}
          <a href="/admin/crm" style={solapa(false)}><Icono nombre="clientes" tam={16} /> Clientes</a>
          <div style={{ flex: 1 }} />
          {pestana === "activas" && (
            <button type="button" onClick={() => setAbriendo((v) => !v)} style={botonPrimario(AZUL)}>
              {abriendo ? "Cancelar" : "+ Nueva tienda"}
            </button>
          )}
        </div>

        {abriendo && pestana === "activas" && (
          <NuevaTienda
            onCreada={(n) => { setAbriendo(false); flash(`"${n.nombre}" creada`); cargar(); }}
          />
        )}

        {error && <div style={{ ...aviso(false), marginBottom: 14 }}>{error}</div>}
        {negocios === null && <p style={{ color: C.suave }}>Cargando…</p>}
        {negocios?.length === 0 && (
          <p style={{ color: C.suave }}>
            {pestana === "archivadas" ? "No hay tiendas archivadas." : "Todavía no hay tiendas. Crea la primera."}
          </p>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {negocios?.map((n) => (
            <div key={n.slug} style={{ ...panel, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <MarcaTienda tema={n.tema} tam={40} icono />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 650 }}>{n.nombre}</div>
                <div style={{ fontSize: 13, color: C.suave }}>
                  /{n.slug} · {n.tipo === "descuento" ? "cupón" : `cartilla de ${n.meta}`} · {n.premio}
                </div>
                <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>
                  {n.clientes} cliente{n.clientes === 1 ? "" : "s"}
                  {n.brief ? " · con brief" : " · sin brief"}
                  {Object.keys(n.notas || {}).length ? ` · ${Object.keys(n.notas).length} comentario(s)` : ""}
                </div>
              </div>
              {pestana === "activas" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={`/admin/${n.slug}`} style={{ ...botonPrimario(AZUL), textDecoration: "none" }}>Editar</a>
                  <a href={`/${n.slug}/manager`} style={{ ...botonSecundario, textDecoration: "none" }}>Manager</a>
                  <button onClick={() => archivar(n.slug, "archivar")} style={botonSecundario}>Archivar</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => archivar(n.slug, "desarchivar")} style={botonSecundario}>Recuperar</button>
                  <button onClick={() => setBorrando(borrando === n.slug ? null : n.slug)} style={{ ...botonPrimario("#b42318") }}>
                    Borrar del todo
                  </button>
                </div>
              )}

              {borrando === n.slug && (
                <ConfirmarBorrado negocio={n} onCancelar={() => setBorrando(null)} onBorrar={(escrito) => borrarDelTodo(n, escrito)} />
              )}
            </div>
          ))}
        </div>

        {pestana === "archivadas" && negocios?.length > 0 && (
          <p style={{ fontSize: 13, color: C.suave, marginTop: 14 }}>
            Una tienda archivada no aparece en ningún sitio y sus páginas dejan de responder, pero no se
            ha borrado nada. Borrar del todo sí es definitivo.
          </p>
        )}

        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

// --------------------------------------------------- borrado definitivo
// Hay que escribir el identificador exacto. No es por ceremonia: se lleva por
// delante los clientes y sus pases dejan de actualizarse para siempre.
function ConfirmarBorrado({ negocio, onCancelar, onBorrar }) {
  const [escrito, setEscrito] = useState("");
  const coincide = escrito.trim() === negocio.slug;
  return (
    <div style={{ width: "100%", marginTop: 12, padding: 14, borderRadius: 10, background: "#fdecea", border: "1px solid #f7c9c3" }}>
      <strong style={{ color: "#b42318", fontSize: 14 }}>Borrar «{negocio.nombre}» para siempre</strong>
      <p style={{ fontSize: 13, color: C.texto, margin: "6px 0 10px" }}>
        Se borran también sus <strong>{negocio.clientes} cliente(s)</strong> y su historial. Los pases que
        ya estén en un teléfono dejan de actualizarse. Esto no se puede deshacer.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          placeholder={`escribe "${negocio.slug}"`}
          autoFocus
          style={{ ...campo, width: "auto", flex: "1 1 200px" }}
        />
        <button disabled={!coincide} onClick={() => onBorrar(escrito.trim())}
          style={{ ...botonPrimario("#b42318"), opacity: coincide ? 1 : 0.45, cursor: coincide ? "pointer" : "default" }}>
          Borrar del todo
        </button>
        <button onClick={onCancelar} style={botonSecundario}>Cancelar</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ nueva tienda
function NuevaTienda({ onCreada }) {
  const [f, setF] = useState({
    slug: "", nombre: "", tipo: "sellos", meta: 8, premio: "", brief: "",
    tema: temaPorDefecto({ estilo: "coffee" }),
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setTema = (k, v) => setF((p) => ({ ...p, tema: { ...p.tema, [k]: v } }));
  // Elegir plantilla parte de cero: sus colores, su marca y sus casillas.
  const cambiarPlantilla = (estilo) => setF((p) => ({ ...p, tema: temaPorDefecto({ estilo, texto: p.tema.texto }) }));

  // El identificador sale del nombre, pero se puede cambiar a mano.
  function ponNombre(v) {
    const auto = f.slug === sugerirSlug(f.nombre);
    setF((p) => ({ ...p, nombre: v, slug: auto || !p.slug ? sugerirSlug(v) : p.slug }));
  }

  async function crear(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El servidor pide las piezas sueltas, no el tema entero.
        body: JSON.stringify({
          slug: f.slug, nombre: f.nombre, tipo: f.tipo, meta: f.meta, premio: f.premio, brief: f.brief,
          estilo: f.tema.estilo, emoji: f.tema.emoji, accent: f.tema.accent,
          marca: f.tema.marca, texto: f.tema.texto, forma: f.tema.forma,
          banda: f.tema.banda, modo: f.tema.modo,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setError(d.error || "No se pudo crear");
      onCreada(d);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={crear} style={{ ...panel, marginBottom: 16 }}>
      <h2 style={h2}>Nueva tienda</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>Nombre</label>
          <input value={f.nombre} onChange={(e) => ponNombre(e.target.value)} placeholder="Panadería Rosa" style={campo} autoFocus />
        </div>
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>Identificador (URL)</label>
          <input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="panaderia-rosa" style={campo} />
        </div>
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>Tipo</label>
          <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} style={campo}>
            <option value="sellos">Cartilla de sellos</option>
            <option value="descuento">Cupón de un uso</option>
          </select>
        </div>
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>Color</label>
          <input type="color" value={f.tema.accent} onChange={(e) => setTema("accent", e.target.value)} style={{ ...campo, padding: 4, height: 42 }} />
        </div>
        {f.tipo === "sellos" && (
          <div>
            <label style={{ ...etiqueta, marginTop: 0 }}>Sellos para el premio</label>
            <input type="number" min={1} max={50} value={f.meta} onChange={(e) => set("meta", Number(e.target.value))} style={campo} />
          </div>
        )}
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>{f.tipo === "descuento" ? "Descuento" : "Premio"}</label>
          <input value={f.premio} onChange={(e) => set("premio", e.target.value)} placeholder={f.tipo === "descuento" ? "20% en la tarta" : "croissant gratis"} style={campo} />
        </div>
      </div>

      {/* El aspecto: se elige VIÉNDOLO, no leyendo nombres. */}
      <Selector
        titulo="Plantilla"
        valor={f.tema.estilo}
        opciones={ESTILOS}
        rotulos={ROTULO_PLANTILLA}
        vista={vistaPlantilla}
        onChange={cambiarPlantilla}
        ancho={132}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, alignItems: "flex-end" }}>
        <Selector
          titulo="Marca"
          valor={f.tema.marca}
          opciones={MARCAS}
          rotulos={ROTULO}
          vista={(m) => vistaMarca(f.tema, m)}
          onChange={(m) => setTema("marca", m)}
        />
        {f.tema.marca === "texto" && (
          <div>
            <label style={etiqueta}>Letras o números</label>
            <input
              value={f.tema.texto || ""}
              onChange={(e) => setTema("texto", e.target.value.toUpperCase().slice(0, 4))}
              placeholder="68"
              style={{ ...campo, letterSpacing: 2 }}
            />
          </div>
        )}
        {f.tipo !== "descuento" && (
          <>
            <Selector
              titulo="Cómo se cuentan los sellos"
              valor={f.tema.modo}
              opciones={MODOS}
              rotulos={ROTULO}
              vista={(m) => vistaModo(f.tema, m, f.meta)}
              onChange={(m) => setTema("modo", m)}
              ancho={150}
            />
            {f.tema.modo !== "relleno" && (
              <Selector
                titulo="Casilla del sello"
                valor={f.tema.forma}
                opciones={FORMAS}
                rotulos={ROTULO}
                vista={(x) => vistaForma(f.tema, x)}
                onChange={(x) => setTema("forma", x)}
                ancho={120}
              />
            )}
            <Selector
              titulo="Banda"
              valor={f.tema.banda}
              opciones={BANDAS}
              rotulos={ROTULO}
              vista={(b) => vistaBanda(f.tema, b)}
              onChange={(b) => setTema("banda", b)}
              ancho={150}
            />
          </>
        )}
      </div>

      <label style={etiqueta}>Brief para Claude</label>
      <textarea
        value={f.brief}
        onChange={(e) => set("brief", e.target.value)}
        rows={4}
        placeholder="Cuenta qué es esta tienda, cómo quieres su tarjeta, qué premio tiene sentido, qué tono… Claude lo usará para rellenar el resto."
        style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
      />

      {error && <div style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 14 }}>
        <button type="submit" disabled={busy} style={botonPrimario(AZUL)}>{busy ? "Creando…" : "Crear tienda"}</button>
      </div>
    </form>
  );
}

const sugerirSlug = (nombre) =>
  String(nombre).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);


const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
