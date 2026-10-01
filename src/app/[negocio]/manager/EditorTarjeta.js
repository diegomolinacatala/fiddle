"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PaseVista from "@/app/PaseVista";
import { comoDataUri } from "@/lib/apple/dibujo";
import { MARCAS, FORMAS, BANDAS, ESTILOS, NOMBRES_FAMILIA, familiaDeModo, modosDeFamilia, temaPorDefecto } from "@/lib/negocios";
import { vistaMarca, vistaForma, vistaBanda, vistaModo, vistaFamilia, vistaPlantilla, ROTULO, ROTULO_MODO, ROTULO_FAMILIA, ROTULO_PLANTILLA } from "@/app/admin/vistas";
import { C, campo, etiqueta, botonPrimario, botonSecundario } from "@/app/ui";

// ============================================================================
// EDITOR DE LA TARJETA (manager)
// ----------------------------------------------------------------------------
// La tarjeta en el centro y nada más. Se toca un trozo (el logo, el nombre, los
// sellos, el premio, el fondo…) y se abre a su lado un panel con SOLO lo de ese
// trozo. Así un dueño no se enfrenta a un formulario de veinte campos: cambia
// lo que está mirando.
//
// La tarjeta es PaseVista, la de siempre (camposDelPase, stripDelPase,
// svgLogo): lo que se ve aquí es lo que llega al teléfono. Los campos son las
// mismas claves que el modo comentarios del admin ("apple.premio",
// "google.puntos"…); `seccionDe` dice qué panel abre cada una.
//
// Lo que NO se edita aquí, a propósito: cupón o cartilla y una o dos cartillas.
// Eso cambia lo que el cliente ya tiene en el teléfono, y lo hace el admin.
// ============================================================================

/** Qué panel abre cada trozo de la tarjeta. */
export function seccionDe(clave) {
  const k = String(clave).replace(/^(apple|google)\./, "");
  if (k === "fondo") return "colores";
  if (k === "logo" || k === "cabecera") return "logo";
  if (k === "nombre") return "nombre";
  if (k === "banda" || k === "puntos") return "sellos";
  if (/^premio\d?$/.test(k) || k === "descuento" || k === "reverso.premios") return "premio";
  if (k === "como" || k === "reverso.como") return "reverso";
  if (k === "promo" || k.startsWith("mensaje.")) return "promo";
  if (["canjeados", "guardados", "nivel", "reverso.guardados"].includes(k)) return "contador";
  return "fijo"; // QR, código, titular, estado del cupón, privacidad
}

const TITULO = {
  colores: "Colores", logo: "Logo", nombre: "Nombre de la tienda", sellos: "Los sellos",
  premio: "Premio", reverso: "Texto del reverso", promo: "Promo", contador: "Premios del cliente", fijo: "Lo pone la tarjeta",
};

export default function EditorTarjeta({ inicial, slug, origin, estado, onCerrar, onGuardado }) {
  const [d, setD] = useState(inicial);
  const [activo, setActivo] = useState(null); // { clave, lado: "izq" | "der" }
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const lado = useRef("der");
  const tarjeta = useRef(null);

  const esCupon = d.tipo === "descuento";
  const cambiado = JSON.stringify(lo(d)) !== JSON.stringify(lo(inicial));

  // Pantalla completa: la página de detrás no se mueve mientras se edita.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e) => { if (e.key === "Escape") setActivo(null); };
    document.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = antes; document.removeEventListener("keydown", tecla); };
  }, []);

  const setTema = (k, v) => setD((p) => ({ ...p, tema: { ...p.tema, [k]: v } }));
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  // Con dos cartillas, la primera ES la meta y el premio de la tienda (lib/cartillas.js).
  const setCartilla = (i, k, v) => setD((p) => {
    const cartillas = p.cartillas.map((c, j) => (j === i ? { ...c, [k]: v } : c));
    return { ...p, cartillas, meta: cartillas[0].meta, premio: cartillas[0].premio };
  });
  // Otra plantilla: sus colores y su dibujo. El nombre, los sellos y el premio se quedan.
  const plantilla = (estilo) => setD((p) => ({ ...p, tema: temaPorDefecto({ estilo, texto: p.tema.texto }) }));

  const cliente = useMemo(() => {
    const aMedias = (meta) => Math.max(1, Math.round((meta || 1) * 0.6));
    return {
      serial: "ejemplo-0000-0000-0000-000000000000",
      codigo: "ABC",
      nombre: "Cliente",
      sellos: aMedias(d.cartillas?.[0]?.meta ?? d.meta),
      sellos2: d.cartillas?.[1] ? aMedias(d.cartillas[1].meta) - 1 : 0,
      premios: 1,
    };
  }, [d.meta, d.cartillas]);

  function abrir(clave) {
    setActivo({ clave, lado: lado.current });
  }

  // El panel se abre del lado del trozo tocado: el logo a la izquierda, los
  // premios a la derecha. En el móvil no hay lados: sube desde abajo.
  function apuntar(e) {
    const r = tarjeta.current?.getBoundingClientRect();
    if (r) lado.current = e.clientX < r.left + r.width / 2 ? "izq" : "der";
  }

  function salir() {
    if (cambiado && !window.confirm("¿Salir sin guardar? Los cambios de la tarjeta se pierden.")) return;
    onCerrar();
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const t = d.tema;
      const r = await fetch(`/api/negocio?b=${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: d.nombre,
          // El tema ENTERO: con `estilo` el servidor re-siembra la plantilla y
          // lo que no vaya aquí volvería a ser el de la plantilla.
          tema: {
            estilo: t.estilo, emoji: t.emoji, atras: t.atras,
            accent: t.accent, cardBg: t.cardBg, ink: t.ink, pageInk: t.pageInk,
            marca: t.marca, texto: t.texto || "", forma: t.forma, banda: t.banda, modo: t.modo,
          },
          ...(d.cartillas
            ? { cartillas: d.cartillas.map(({ nombre, marca, meta, premio }) => ({ nombre, marca, meta, premio })) }
            : { meta: d.meta, premio: d.premio }),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo guardar");
      onGuardado(data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setGuardando(false);
    }
  }

  const seccion = activo && seccionDe(activo.clave);
  const ctx = { d, set, setTema, setCartilla, plantilla, esCupon, slug };
  const panelAbierto = seccion && (
    <aside className={`editor-panel editor-panel-${activo.lado}`} aria-label={TITULO[seccion]}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <strong style={{ flex: 1, fontSize: 15 }}>{TITULO[seccion]}</strong>
        <button type="button" onClick={() => setActivo(null)} style={cerrar} aria-label="Cerrar panel">×</button>
      </div>
      <Seccion cual={seccion} clave={activo.clave} {...ctx} />
    </aside>
  );

  return (
    <div style={capa} role="dialog" aria-modal="true" aria-label="Editar tarjeta">
      <style>{CSS}</style>
      <header style={barra}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 16 }}>Editar tarjeta</strong>
          <div style={{ fontSize: 12, color: C.suave }}>Toca cualquier parte de la tarjeta para cambiarla.</div>
        </div>
        <button type="button" onClick={salir} style={botonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={!cambiado || guardando}
          style={{ ...botonPrimario(d.tema.accent), opacity: cambiado ? 1 : 0.5, cursor: cambiado ? "pointer" : "default" }}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </header>
      {error && <div style={{ background: C.malFondo, color: C.mal, padding: "8px 16px", fontSize: 14 }}>{error}</div>}

      <div className="editor-cuerpo">
        <div className="editor-lado">{activo?.lado === "izq" && panelAbierto}</div>
        <div className="editor-centro">
          <div ref={tarjeta} onPointerDownCapture={apuntar}>
            <PaseVista
              negocio={d}
              cliente={cliente}
              qrTexto={`${origin}/w/${cliente.serial}`}
              estado={estado}
              onCampo={abrir}
              campoActivo={activo?.clave || null}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" onClick={() => { lado.current = "der"; abrir("apple.fondo"); }} style={chip}>Colores y plantilla</button>
            {cambiado && <button type="button" onClick={() => { setD(inicial); setActivo(null); }} style={chip}>Deshacer todo</button>}
          </div>
          <p style={{ fontSize: 12, color: C.tenue, textAlign: "center", margin: "10px 0 0" }}>
            Al guardar, la tarjeta cambia en todos los teléfonos.
          </p>
        </div>
        <div className="editor-lado">
          {activo?.lado === "der" && panelAbierto}
          {!activo && (
            <div className="editor-pista">
              <strong style={{ display: "block", marginBottom: 6 }}>¿Qué se puede cambiar?</strong>
              El logo, el nombre, los colores, cómo se cuentan los sellos, cuántos hacen falta, el premio y el
              texto del reverso. Toca el trozo que quieras en la tarjeta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Lo que se guarda: para saber si hay algo que guardar. */
const lo = (n) => ({ nombre: n.nombre, meta: n.meta, premio: n.premio, cartillas: n.cartillas, tema: n.tema });

// ------------------------------------------------------------ las secciones
function Seccion({ cual, clave, d, set, setTema, setCartilla, plantilla, esCupon, slug }) {
  const t = d.tema;

  if (cual === "colores") {
    return (
      <>
        <Color titulo="Fondo de la tarjeta" valor={t.cardBg} onChange={(v) => setTema("cardBg", v)} />
        <Color titulo="Texto" valor={t.ink} onChange={(v) => setTema("ink", v)} />
        <Color titulo="Color de la tienda" ayuda="Etiquetas, sellos y logo. En Google Wallet, el fondo." valor={t.accent} onChange={(v) => setTema("accent", v)} />
        <Legible fondo={t.cardBg} texto={t.ink} accent={t.accent} onArreglar={(v) => setTema("ink", v)} />
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Empezar de otra plantilla</summary>
          <p style={ayuda}>Cambia los colores y el dibujo. El nombre, los sellos y el premio se quedan.</p>
          <Opciones opciones={ESTILOS} valor={t.estilo} rotulos={ROTULO_PLANTILLA} vista={vistaPlantilla} onChange={plantilla} ancho={120} />
        </details>
      </>
    );
  }

  if (cual === "logo") {
    return (
      <>
        {clave === "google.cabecera" && <Nombre d={d} set={set} />}
        <label style={etiqueta}>Dibujo</label>
        <Opciones opciones={MARCAS} valor={t.marca} rotulos={ROTULO} vista={(m) => vistaMarca({ ...t, texto: t.texto || "AB" }, m)} onChange={(m) => setTema("marca", m)} ancho={78} />
        {t.marca === "texto" && (
          <>
            <label style={etiqueta}>Letras o números</label>
            <input value={t.texto || ""} onChange={(e) => setTema("texto", e.target.value.toUpperCase().slice(0, 4))}
              placeholder="68" style={{ ...campo, letterSpacing: 2 }} maxLength={4} />
            <p style={ayuda}>Hasta cuatro. Sin tildes: se dibujan letra a letra.</p>
          </>
        )}
        <Color titulo="Color del logo" ayuda="Es el color de la tienda: cambia también etiquetas y sellos." valor={t.accent} onChange={(v) => setTema("accent", v)} />
      </>
    );
  }

  if (cual === "nombre") {
    return (
      <>
        <Nombre d={d} set={set} />
        <Color titulo="Color del texto" valor={t.ink} onChange={(v) => setTema("ink", v)} />
      </>
    );
  }

  if (cual === "sellos") {
    if (esCupon) {
      return (
        <>
          <label style={etiqueta}>Dibujo de la banda</label>
          <Opciones opciones={MARCAS} valor={t.marca} rotulos={ROTULO} vista={(m) => vistaMarca(t, m)} onChange={(m) => setTema("marca", m)} ancho={78} />
          <Color titulo="Color" valor={t.accent} onChange={(v) => setTema("accent", v)} />
        </>
      );
    }
    const familia = familiaDeModo(t.modo);
    const variantes = modosDeFamilia(familia);
    return (
      <>
        {d.cartillas ? d.cartillas.map((c, i) => (
          <fieldset key={i} style={grupo}>
            <legend style={leyenda}>{i === 0 ? "Fila de arriba" : "Fila de abajo"}</legend>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                <label style={{ ...etiqueta, marginTop: 0 }}>Nombre</label>
                <input value={c.nombre} maxLength={24} onChange={(e) => setCartilla(i, "nombre", e.target.value)} style={campo} />
              </div>
              <div style={{ flex: "0 0 auto" }}>
                <label style={{ ...etiqueta, marginTop: 0 }}>Sellos</label>
                <Numero valor={c.meta} max={20} onChange={(v) => setCartilla(i, "meta", v)} />
              </div>
            </div>
            <label style={etiqueta}>Dibujo</label>
            <Opciones opciones={MARCAS.filter((m) => m !== "texto")} valor={c.marca} rotulos={ROTULO}
              vista={(m) => vistaMarca(t, m)} onChange={(m) => setCartilla(i, "marca", m)} ancho={64} />
          </fieldset>
        )) : (
          <>
            <label style={{ ...etiqueta, marginTop: 4 }}>Sellos para el premio</label>
            <Numero valor={d.meta} max={50} onChange={(v) => set("meta", v)} />
            <label style={etiqueta}>Cómo se cuentan</label>
            <Opciones opciones={NOMBRES_FAMILIA} valor={familia} rotulos={ROTULO_FAMILIA}
              vista={(f) => vistaFamilia(t, f, d.meta)} onChange={(f) => setTema("modo", modosDeFamilia(f)[0])} ancho={132} />
            {variantes.length > 1 && (
              <>
                <label style={etiqueta}>Variante</label>
                <Opciones opciones={variantes} valor={t.modo} rotulos={ROTULO_MODO}
                  vista={(m) => vistaModo(t, m, d.meta)} onChange={(m) => setTema("modo", m)} ancho={132} />
              </>
            )}
          </>
        )}
        {(t.modo === "casillas" || d.cartillas) && (
          <>
            <label style={etiqueta}>Casilla del sello</label>
            <Opciones opciones={FORMAS} valor={t.forma} rotulos={ROTULO} vista={(f) => vistaForma(t, f)} onChange={(f) => setTema("forma", f)} ancho={100} />
          </>
        )}
        <label style={etiqueta}>Fondo de la banda</label>
        <Opciones opciones={BANDAS} valor={t.banda} rotulos={ROTULO} vista={(b) => vistaBanda(t, b)} onChange={(b) => setTema("banda", b)} ancho={132} />
        <Color titulo="Color de los sellos" ayuda="Es el color de la tienda: cambia también etiquetas y logo." valor={t.accent} onChange={(v) => setTema("accent", v)} />
      </>
    );
  }

  if (cual === "premio") {
    if (d.cartillas) {
      return d.cartillas.map((c, i) => (
        <div key={i} style={{ marginTop: i ? 12 : 4 }}>
          <label style={{ ...etiqueta, marginTop: 0 }}>Premio · {c.nombre}</label>
          <input value={c.premio} maxLength={64} onChange={(e) => setCartilla(i, "premio", e.target.value)} style={campo} />
          <label style={etiqueta}>Sellos para conseguirlo</label>
          <Numero valor={c.meta} max={20} onChange={(v) => setCartilla(i, "meta", v)} />
        </div>
      ));
    }
    return (
      <>
        <label style={{ ...etiqueta, marginTop: 4 }}>{esCupon ? "Descuento" : "Qué se lleva el cliente"}</label>
        <input value={d.premio} maxLength={128} onChange={(e) => set("premio", e.target.value)}
          placeholder={esCupon ? "20% en la tarta" : "café gratis"} style={campo} />
        {!esCupon && (
          <>
            <label style={etiqueta}>Sellos para conseguirlo</label>
            <Numero valor={d.meta} max={50} onChange={(v) => set("meta", v)} />
          </>
        )}
      </>
    );
  }

  if (cual === "reverso") {
    return (
      <>
        <p style={ayuda}>Lo que lee el cliente al dar la vuelta a la tarjeta, en «Cómo funciona».</p>
        <textarea value={t.atras || ""} maxLength={200} rows={4} onChange={(e) => setTema("atras", e.target.value)}
          style={{ ...campo, resize: "vertical", fontFamily: "inherit" }} />
        <p style={{ ...ayuda, textAlign: "right" }}>{(t.atras || "").length}/200</p>
      </>
    );
  }

  if (cual === "promo") {
    return (
      <p style={ayuda}>
        Lo que se les dice a los clientes (la promo, los avisos a un grupo) se escribe en{" "}
        <a href={`/${slug}/avisos`} style={{ color: d.tema.accent, fontWeight: 600 }}>Avisos</a>. Ahí también se
        ve a quién le llega.
      </p>
    );
  }

  if (cual === "contador") {
    return (
      <>
        <p style={ayuda}>Cuenta los premios de cada cliente: lo pone la tarjeta sola. La etiqueta va en el color de la tienda.</p>
        <Color titulo="Color de las etiquetas" valor={t.accent} onChange={(v) => setTema("accent", v)} />
      </>
    );
  }

  return (
    <p style={ayuda}>
      Esto es de cada cliente (su QR, su código, si el cupón está usado) y lo pone la tarjeta sola. Toca el fondo
      de la tarjeta para cambiar los colores.
    </p>
  );
}

// ------------------------------------------------------------- piezas
function Nombre({ d, set }) {
  return (
    <>
      <label style={{ ...etiqueta, marginTop: 4 }}>Nombre de la tienda</label>
      <input value={d.nombre} maxLength={60} onChange={(e) => set("nombre", e.target.value)} style={campo} />
      <p style={ayuda}>Sale arriba en la tarjeta y en los avisos. Si es largo, el iPhone lo corta.</p>
    </>
  );
}

/** Todas las opciones a la vista, dibujadas: el panel ya ES el menú. */
function Opciones({ opciones, valor, vista, rotulos, onChange, ancho = 92 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${ancho}px, 1fr))`, gap: 6 }}>
      {opciones.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={o === valor} title={rotulos?.[o] || o} style={opcion(o === valor)}>
          <img src={comoDataUri(vista(o))} alt="" style={{ height: 38, maxWidth: "100%", objectFit: "contain", display: "block" }} />
          <span style={{ fontSize: 11, lineHeight: 1.2, color: o === valor ? C.texto : C.suave }}>{rotulos?.[o] || o}</span>
        </button>
      ))}
    </div>
  );
}

function Color({ titulo, valor, onChange, ayuda: texto }) {
  return (
    <div>
      <label style={etiqueta}>{titulo}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={valor || "#000000"} onChange={(e) => onChange(e.target.value)}
          style={{ width: 52, height: 40, padding: 2, border: `1px solid ${C.borde}`, borderRadius: 8, background: "#fff", cursor: "pointer" }} />
        {/* Se escribe libre y solo cuenta al quedar un color entero ("#a1b2c3"). */}
        <input defaultValue={valor || ""} key={valor} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase()); }}
          maxLength={7} aria-label={`${titulo} en hexadecimal`}
          style={{ ...campo, fontFamily: "ui-monospace, Menlo, monospace", width: 110 }} />
      </div>
      {texto && <p style={ayuda}>{texto}</p>}
    </div>
  );
}

function Numero({ valor, max, onChange }) {
  const cambiar = (v) => onChange(Math.max(1, Math.min(max, Math.round(Number(v) || 1))));
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button type="button" onClick={() => cambiar(valor - 1)} style={paso} aria-label="Uno menos">−</button>
      <input type="number" min={1} max={max} value={valor} onChange={(e) => cambiar(e.target.value)} style={{ ...campo, textAlign: "center", width: 56, padding: "8px 4px" }} />
      <button type="button" onClick={() => cambiar(valor + 1)} style={paso} aria-label="Uno más">+</button>
    </div>
  );
}

// Un color bonito que no se lee no sirve: se avisa, no se prohíbe.
function Legible({ fondo, texto, accent, onArreglar }) {
  const malTexto = contraste(fondo, texto) < 3;
  const malAccent = contraste(fondo, accent) < 1.8;
  if (!malTexto && !malAccent) return null;
  // El arreglo de un toque: blanco o casi negro, el que más se lea.
  const mejor = contraste(fondo, "#ffffff") >= contraste(fondo, "#1b1e23") ? "#ffffff" : "#1b1e23";
  return (
    <div style={{ ...ayuda, color: C.mal, background: C.malFondo, padding: "8px 10px", borderRadius: 8, marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 140 }}>
        {malTexto ? "El texto casi no se lee sobre este fondo." : "Las etiquetas y los sellos se pierden en el fondo: prueba otro color de la tienda."}
      </span>
      {malTexto && (
        <button type="button" onClick={() => onArreglar(mejor)} style={{ ...chip, minHeight: 32, padding: "4px 12px" }}>
          Texto {mejor === "#ffffff" ? "blanco" : "oscuro"}
        </button>
      )}
    </div>
  );
}

function contraste(a, b) {
  const luz = (hex) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return 1;
    const [r, g, bl] = m.slice(1).map((x) => {
      const c = parseInt(x, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ------------------------------------------------------------- estilos
// Tres columnas: panel | tarjeta | panel. En el móvil la tarjeta ocupa todo y
// el panel sube desde abajo, tapando como mucho la mitad.
const CSS = `
.editor-cuerpo { flex: 1; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 340px) minmax(0, 1fr); gap: 24px; padding: 24px 20px 40px; align-items: start; }
.editor-centro { min-width: 0; }
.editor-lado { min-width: 0; position: sticky; top: 0; }
.editor-panel { background: #fff; border: 1px solid ${C.borde}; border-radius: 14px; padding: 16px; max-height: calc(100vh - 120px); overflow-y: auto; box-shadow: 0 12px 32px rgba(16,20,28,.12); max-width: 380px; }
.editor-panel-izq { margin-left: auto; }
.editor-pista { color: ${C.suave}; font-size: 13px; line-height: 1.5; max-width: 300px; padding: 14px; border: 1px dashed ${C.bordeFuerte}; border-radius: 12px; }
@media (max-width: 860px) {
  .editor-cuerpo { grid-template-columns: minmax(0, 1fr); padding: 16px 16px 55vh; gap: 12px; }
  .editor-lado { position: static; }
  .editor-lado:first-child { display: none; }
  .editor-lado:has(.editor-panel-izq) { display: block; }
  .editor-panel { position: fixed; left: 0; right: 0; bottom: 0; max-width: none; max-height: 52vh; border-radius: 16px 16px 0 0; z-index: 2; margin: 0; }
  .editor-pista { max-width: none; }
}
`;

const capa = { position: "fixed", inset: 0, zIndex: 50, background: C.fondo, display: "flex", flexDirection: "column", color: C.texto };
const barra = { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff", borderBottom: `1px solid ${C.borde}`, flexWrap: "wrap" };
const cerrar = { width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.borde}`, background: "#fff", fontSize: 20, lineHeight: 1, cursor: "pointer", color: C.suave };
const chip = { padding: "8px 14px", borderRadius: 999, border: `1px solid ${C.borde}`, background: "#fff", fontSize: 13, cursor: "pointer", color: C.texto, minHeight: 36 };
const ayuda = { fontSize: 12, color: C.suave, margin: "6px 0 0", lineHeight: 1.45 };
const grupo = { border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 12px 12px", margin: "8px 0 0", minWidth: 0 };
const leyenda = { fontSize: 12, color: C.tenue, padding: "0 4px" };
const paso = { width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.borde}`, background: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 };
const opcion = (activa) => ({
  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  padding: 6, borderRadius: 10, cursor: "pointer", textAlign: "center", minWidth: 0,
  border: `2px solid ${activa ? "#2563eb" : "transparent"}`,
  background: activa ? "#eff4ff" : C.panelSuave,
});
