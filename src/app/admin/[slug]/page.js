"use client";

import MarcaTienda from "@/app/MarcaTienda";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PaseVista from "@/app/PaseVista";
import LogoutButton from "@/app/LogoutButton";
import { MARCAS, FORMAS, BANDAS, ESTILOS, NOMBRES_FAMILIA, familiaDeModo, modosDeFamilia, temaPorDefecto } from "@/lib/negocios";
import Selector from "@/app/admin/Selector";
import Cartillas from "@/app/admin/Cartillas";
import { vistaMarca, vistaForma, vistaBanda, vistaModo, vistaFamilia, vistaPlantilla, ROTULO, ROTULO_MODO, ROTULO_FAMILIA, ROTULO_PLANTILLA } from "@/app/admin/vistas";
import { C, pagina, panel, campo, etiqueta, h2, titulo, subtitulo, botonPrimario, botonSecundario, aviso } from "@/app/ui";

// ============================================================================
// ADMIN — una tienda
// ----------------------------------------------------------------------------
// Dos mitades:
//   IZQUIERDA  los datos que se editan a mano (nombre, cartilla, colores) y el
//              BRIEF en texto libre para Claude.
//   DERECHA    el pase, en Apple y en Google, con MODO COMENTARIOS: se toca
//              cualquier campo y se escribe "esto debería ser X". Las notas se
//              guardan con la tienda, así Claude ve de un vistazo qué cambiar
//              y dónde, sin tener que adivinarlo del chat.
// ============================================================================

const AZUL = "#2563eb";

export default function AdminNegocio() {
  const { slug } = useParams();
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const [comentando, setComentando] = useState(false);
  const [campoActivo, setCampoActivo] = useState(null); // { clave, etiqueta }
  const [borrador, setBorrador] = useState("");

  useEffect(() => { setOrigin(window.location.origin); if (slug) cargar(); }, [slug]);

  async function cargar() {
    try {
      const r = await fetch("/api/admin/negocios?archivados=0");
      const lista = await r.json();
      if (!r.ok) throw new Error(lista.error || "No se pudo cargar");
      const encontrado = lista.find((x) => x.slug === slug);
      if (!encontrado) throw new Error("Esa tienda no existe o está archivada");
      setN(encontrado);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 3000); }
  const set = (k, v) => setN((p) => ({ ...p, [k]: v }));
  const setTema = (k, v) => setN((p) => ({ ...p, tema: { ...p.tema, [k]: v } }));

  // Cambiar de plantilla re-siembra la paleta entera (el servidor hace lo mismo
  // al guardar); solo se conserva el texto de la marca, que es de la tienda.
  const cambiarPlantilla = (estilo) =>
    setN((p) => ({ ...p, tema: temaPorDefecto({ estilo, texto: p.tema.texto }) }));

  async function guardar() {
    const r = await fetch("/api/admin/negocios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        nombre: n.nombre,
        meta: n.meta,
        premio: n.premio,
        cartillas: n.cartillas ?? null,
        brief: n.brief,
        tema: {
          estilo: n.tema.estilo, emoji: n.tema.emoji, accent: n.tema.accent, atras: n.tema.atras,
          marca: n.tema.marca, texto: n.tema.texto || "", forma: n.tema.forma,
          banda: n.tema.banda, modo: n.tema.modo,
        },
      }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error || "Error al guardar");
    setN((p) => ({ ...d, clientes: p.clientes }));
    flash(`Guardado${d.aviso?.proveedor === "apple" ? ` · ${d.aviso.enviadas}/${d.aviso.total} iPhone avisados` : ""}${d.aviso?.google ? ` · ${d.aviso.google} en Google Wallet` : ""}`);
  }

  // --------- comentarios sobre campos del pase ---------
  function abrirCampo(clave, etiqueta) {
    setCampoActivo({ clave, etiqueta });
    setBorrador(n.notas?.[clave] || "");
  }

  async function guardarNota(texto) {
    const r = await fetch("/api/admin/negocios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, nota: { clave: campoActivo.clave, texto } }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error || "Error");
    setN((p) => ({ ...p, notas: d.notas }));
    setCampoActivo(null);
    flash(texto ? "Comentario guardado" : "Comentario borrado");
  }

  // Cliente de mentira, a medida de la cartilla que se está editando.
  const clienteVista = useMemo(() => ({
    serial: "ejemplo-0000-0000-0000-000000000000",
    codigo: "ABC",
    nombre: "Cliente",
    sellos: Math.max(1, Math.round((n?.meta || 1) * 0.6)),
    sellos2: Math.max(1, Math.round((n?.cartillas?.[1]?.meta || 1) * 0.3)),
    premios: 0,
  }), [n?.meta, n?.cartillas]);

  if (error) return <main style={pagina}><div style={{ width: "min(700px,94vw)" }}><a href="/admin" style={volver}>← Plataforma</a><div style={{ ...aviso(false), marginTop: 12 }}>{error}</div></div></main>;
  if (!n) return <main style={pagina}><p style={{ color: C.suave }}>Cargando…</p></main>;

  const notas = Object.entries(n.notas || {});

  return (
    <main style={pagina}>
      <div style={{ width: "min(1080px, 96vw)" }}>
        <a href="/admin" style={volver}>← Plataforma</a>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div>
            <h1 style={{ ...titulo, display: "flex", alignItems: "center", gap: 10 }}><MarcaTienda tema={n.tema} tam={34} icono /> {n.nombre}</h1>
            <p style={subtitulo}>/{n.slug} · {n.clientes} cliente{n.clientes === 1 ? "" : "s"}</p>
          </div>
          <LogoutButton />
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginTop: 18, alignItems: "start" }}>
          {/* ------------------------------------------------ datos */}
          <section style={panel}>
            <h2 style={h2}>Datos</h2>
            <label style={{ ...etiqueta, marginTop: 0 }}>Nombre</label>
            <input value={n.nombre} onChange={(e) => set("nombre", e.target.value)} style={campo} />

            {!n.cartillas && <div style={{ display: "flex", gap: 12 }}>
              {n.tipo !== "descuento" && (
                <div style={{ flex: 1 }}>
                  <label style={etiqueta}>Sellos</label>
                  <input type="number" min={1} max={50} value={n.meta} onChange={(e) => set("meta", Number(e.target.value))} style={campo} />
                </div>
              )}
              <div style={{ flex: 2 }}>
                <label style={etiqueta}>{n.tipo === "descuento" ? "Descuento" : "Premio"}</label>
                <input value={n.premio} onChange={(e) => set("premio", e.target.value)} style={campo} />
              </div>
            </div>}

            {n.tipo !== "descuento" && (
              <Cartillas
                negocio={n}
                // La primera cartilla es la de siempre: meta y premio la siguen, y la vista previa también.
                onChange={(cartillas) => setN((p) => ({ ...p, cartillas, ...(cartillas ? { meta: cartillas[0].meta, premio: cartillas[0].premio } : {}) }))}
              />
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={etiqueta}>Color</label>
                <input type="color" value={n.tema.accent} onChange={(e) => setTema("accent", e.target.value)} style={{ ...campo, padding: 4, height: 42 }} />
              </div>
            </div>

            <Selector
              titulo="Plantilla"
              valor={ESTILOS.includes(n.tema.estilo) ? n.tema.estilo : ESTILOS[0]}
              opciones={ESTILOS}
              rotulos={ROTULO_PLANTILLA}
              vista={vistaPlantilla}
              onChange={cambiarPlantilla}
              ancho={132}
            />
            <p style={{ fontSize: 12, color: C.tenue, margin: "6px 0 0" }}>
              Cambiarla vuelve a poner los colores de esa plantilla. Lo de abajo se retoca después.
            </p>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Selector
                  titulo="Marca"
                  valor={n.tema.marca}
                  opciones={MARCAS}
                  rotulos={ROTULO}
                  vista={(m) => vistaMarca(n.tema, m)}
                  onChange={(m) => setTema("marca", m)}
                />
              </div>
              {n.tema.marca === "texto" && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={etiqueta}>Letras o números</label>
                  <input
                    value={n.tema.texto || ""}
                    onChange={(e) => setTema("texto", e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="68"
                    style={{ ...campo, letterSpacing: 2 }}
                  />
                </div>
              )}
            </div>

            {n.tipo !== "descuento" && (
              <>
                {/* Con dos cartillas siempre son casillas: una fila por cartilla. */}
                {!n.cartillas && <Selector
                  titulo="Cómo se cuentan los sellos"
                  valor={familiaDeModo(n.tema.modo)}
                  opciones={NOMBRES_FAMILIA}
                  rotulos={ROTULO_FAMILIA}
                  vista={(f) => vistaFamilia(n.tema, f, n.meta)}
                  onChange={(f) => setTema("modo", modosDeFamilia(f)[0])}
                  ancho={150}
                />}
                {!n.cartillas && modosDeFamilia(familiaDeModo(n.tema.modo)).length > 1 && (
                  <Selector
                    titulo="Variante"
                    valor={n.tema.modo}
                    opciones={modosDeFamilia(familiaDeModo(n.tema.modo))}
                    rotulos={ROTULO_MODO}
                    vista={(m) => vistaModo(n.tema, m, n.meta)}
                    onChange={(m) => setTema("modo", m)}
                    ancho={150}
                  />
                )}
                <div style={{ display: "flex", gap: 12 }}>
                  {(n.tema.modo === "casillas" || n.cartillas) && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Selector
                        titulo="Casilla del sello"
                        valor={n.tema.forma}
                        opciones={FORMAS}
                        rotulos={ROTULO}
                        vista={(f) => vistaForma(n.tema, f)}
                        onChange={(f) => setTema("forma", f)}
                        ancho={120}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Selector
                      titulo="Banda"
                      valor={n.tema.banda}
                      opciones={BANDAS}
                      rotulos={ROTULO}
                      vista={(b) => vistaBanda(n.tema, b)}
                      onChange={(b) => setTema("banda", b)}
                      ancho={150}
                    />
                  </div>
                </div>
              </>
            )}

            <label style={etiqueta}>Texto del reverso</label>
            <input value={n.tema.atras} onChange={(e) => setTema("atras", e.target.value)} style={campo} />

            <label style={etiqueta}>Brief para Claude</label>
            <textarea
              value={n.brief}
              onChange={(e) => set("brief", e.target.value)}
              rows={6}
              placeholder="Qué es esta tienda, cómo debería verse su tarjeta, qué premio encaja, qué tono…"
              style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={guardar} style={botonPrimario(AZUL)}>Guardar</button>
              <a href={`/${n.slug}/manager`} style={{ ...botonSecundario, textDecoration: "none" }}>Abrir manager</a>
            </div>
          </section>

          {/* ------------------------------------------ pase + notas */}
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <h2 style={{ ...h2, margin: 0 }}>El pase</h2>
              <button
                type="button"
                onClick={() => { setComentando((v) => !v); setCampoActivo(null); }}
                style={comentando ? botonPrimario(AZUL) : botonSecundario}
              >
                {comentando ? "Salir de comentarios" : "Comentar campos"}
              </button>
            </div>

            {comentando && (
              <p style={{ fontSize: 13, color: C.suave, margin: "0 0 12px" }}>
                Toca cualquier campo del pase y escribe qué debería poner. Las notas se guardan con la
                tienda: Claude las lee todas juntas.
              </p>
            )}

            <PaseVista
              negocio={n}
              cliente={clienteVista}
              qrTexto={`${origin}/w/${clienteVista.serial}`}
              notas={n.notas}
              onCampo={comentando ? abrirCampo : null}
              campoActivo={campoActivo?.clave || null}
              pie={comentando ? "Modo comentarios: toca un campo." : undefined}
            />

            {campoActivo && (
              <div style={{ ...panel, marginTop: 14, background: C.panelSuave }}>
                <div style={{ fontSize: 12, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {campoActivo.etiqueta}
                </div>
                <div style={{ fontSize: 11, color: C.tenue, fontFamily: "ui-monospace, Menlo, monospace", marginBottom: 8 }}>
                  {campoActivo.clave}
                </div>
                <textarea
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="esto debería ser…"
                  style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={() => guardarNota(borrador.trim())} style={botonPrimario(AZUL)}>Guardar</button>
                  <button onClick={() => setCampoActivo(null)} style={botonSecundario}>Cancelar</button>
                  {n.notas?.[campoActivo.clave] && (
                    <button onClick={() => guardarNota("")} style={{ ...botonSecundario, color: C.mal }}>Borrar nota</button>
                  )}
                </div>
              </div>
            )}

            {notas.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...etiqueta, marginTop: 0 }}>Comentarios ({notas.length})</div>
                {notas.map(([clave, texto]) => (
                  <div key={clave} style={{ padding: "8px 0", borderBottom: `1px solid ${C.borde}` }}>
                    <code style={{ fontSize: 11, color: C.tenue }}>{clave}</code>
                    <div style={{ fontSize: 14 }}>{texto}</div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const txt = notas.map(([k, v]) => `${k}: ${v}`).join("\n");
                    navigator.clipboard?.writeText(txt).then(() => flash("Comentarios copiados"), () => flash(txt));
                  }}
                  style={{ ...botonSecundario, marginTop: 10 }}
                >
                  Copiar todos
                </button>
              </div>
            )}
          </section>
        </div>

        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const volver = { fontSize: 13, color: C.suave, textDecoration: "none" };
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
