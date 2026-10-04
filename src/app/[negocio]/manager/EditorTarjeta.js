"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import PaseVista from "@/app/PaseVista";
import { LogoApple, LogoGoogle } from "@/app/LogoTienda";
import DisenosDeMarca from "./DisenosDeMarca";
import { comoDataUri, colorDelPase } from "@/lib/apple/dibujo";
import { MARCAS, FORMAS, BANDAS, ESTILOS_GENERALES, MODOS_DOBLES, NOMBRES_FAMILIA, familiaDeModo, modosDeFamilia, temaPorDefecto } from "@/lib/negocios";
import { kitDe } from "@/lib/kits";
import { normalizarContacto } from "@/lib/contacto";
import { fondoGoogle } from "@/lib/google/pase";
import { logoImagenDe, LOGO_MIN } from "@/lib/logo";
import { fotoDe, rutaFoto, marcaDeIcono, esMarcaPropia, idDeMarca, MAX_PROPIOS } from "@/lib/propios";
import {
  vistaMarca, vistaForma, vistaBanda, vistaModo, vistaFamilia, vistaPlantilla, vistaDoble,
  ROTULO, ROTULO_MODO, ROTULO_FAMILIA, ROTULO_PLANTILLA, ROTULO_DOBLE,
} from "@/app/admin/vistas";
import { C, campo, etiqueta, botonPrimario, botonSecundario } from "@/app/ui";

// ============================================================================
// EDITOR DE LA TARJETA (manager)
// ----------------------------------------------------------------------------
// La tarjeta en el centro, en Apple Y en Google a la vez (en pantallas
// estrechas, una y un conmutador). Se toca un trozo (el logo, el nombre, los
// sellos, el premio, el fondo…) y se abre a su lado un panel con SOLO lo de ese
// trozo: lo de Apple a la izquierda, lo de Google a la derecha. Lo que es de
// las dos (casi todo) cambia en las dos; lo que solo existe en una (el fondo de
// Google, la línea "Abierto" dibujada en la banda de Apple) lo dice el panel.
//
// Las tarjetas son PaseVista, las de siempre (camposDelPase, stripDelPase,
// construirClase…): lo que se ve aquí es lo que llega al teléfono. Los campos
// son las claves del modo comentarios del admin ("apple.premio",
// "google.puntos"…); `seccionDe` dice qué panel abre cada una.
//
// UNA O DOS CARTILLAS se cambia aquí. Pasar a una no borra nada: la segunda se
// aparca con su nombre y su premio, y los sellos de cada cliente se quedan
// donde estaban (ver patchNegocio). Lo que NO se cambia aquí es cupón ↔
// cartilla: el pase de Apple no puede cambiar de tipo una vez instalado.
//
// DOS CAJONES en cada sitio donde se elige algo (logo, sellos, fondo de la
// banda, colores): PREDETERMINADOS, lo de todos, y TUYOS, lo de esta tienda y
// de nadie más (lib/propios.js): su kit de marca (lib/kits.js) y lo que ha
// subido ella: imágenes de logo, iconos propios (valen de logo y dentro de los
// sellos) y fotos para el fondo de la banda. Subir algo lo deja en «Tuyos» y
// ya elegido; la tarjeta no cambia hasta «Guardar». Que nadie más lo use lo
// comprueba el servidor al guardar.
// ============================================================================

// La paleta del kit de la tienda, para cada selector de color sin pasarla a mano.
const Paleta = createContext([]);
// Lo que ha subido la tienda (GET /api/propios) y cómo cambiarlo.
const Propios = createContext({ lista: { logos: [], iconos: [], fondos: [] }, setLista: () => {}, slug: null });

/** Los dibujos de todos (sin los de ningún kit: esos van en «Tuyos»). */
const PREDETERMINADAS = MARCAS;
/** Los de su kit de marca, y luego sus iconos subidos. */
const marcasTuyas = (kit, lista) => [...Object.keys(kit?.marcas || {}), ...lista.iconos.map((x) => marcaDeIcono(x.id))];
/** El tema con los iconos subidos dentro (`tema.iconos`): así se dibujan en las miniaturas y en la vista previa. */
const conIconos = (tema, lista) => (lista.iconos.length
  ? { ...tema, iconos: { ...(tema.iconos || {}), ...Object.fromEntries(lista.iconos.map((x) => [x.id, x.uri])) } }
  : tema);

/** Qué panel abre cada trozo de la tarjeta. */
export function seccionDe(clave) {
  const k = String(clave).replace(/^(apple|google)\./, "");
  if (k === "fondo") return "colores";
  if (k === "logo" || k === "cabecera") return "logo";
  if (k === "nombre") return "nombre";
  if (k === "banda" || k === "puntos") return "sellos";
  if (k === "estado") return "estado";
  if (/^premio\d?$/.test(k) || k === "descuento" || k === "reverso.premios") return "premio";
  if (k === "como" || k === "reverso.como") return "reverso";
  if (k === "promo" || k.startsWith("mensaje.")) return "promo";
  if (/^(reverso|enlace)\.(telefono|web|instagram|contacto)$/.test(k)) return "contacto";
  if (["canjeados", "guardados", "nivel", "reverso.guardados"].includes(k)) return "contador";
  return "fijo"; // QR, código, titular, estado del cupón, privacidad
}

const TITULO = {
  colores: "Colores y plantilla", logo: "Logo", nombre: "Nombre de la tienda", sellos: "Los sellos",
  estado: "«Abierto ahora»", premio: "Premio", reverso: "«Cómo funciona»", contacto: "Teléfono, web e Instagram",
  promo: "Promo", contador: "Premios del cliente", fijo: "Lo pone la tarjeta",
};

// La que se añade al pasar a dos, si no había ninguna aparcada.
const SEGUNDA_NUEVA = { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis", modo: "casillas" };

/** La paleta del kit de la tienda, a mano de cada selector de color del editor. */
export default function EditorTarjeta(props) {
  const [lista, setLista] = useState({ logos: [], iconos: [], fondos: [] });
  useEffect(() => {
    fetch(`/api/propios?b=${props.slug}`).then((r) => (r.ok ? r.json() : null)).then((l) => l && setLista(l)).catch(() => {});
  }, [props.slug]);
  return (
    <Paleta.Provider value={kitDe(props.slug)?.colores || []}>
      <Propios.Provider value={{ lista, setLista, slug: props.slug }}>
        <Editor {...props} lista={lista} />
      </Propios.Provider>
    </Paleta.Provider>
  );
}

function Editor({ inicial, slug, origin, estado, onCerrar, onGuardado, lista }) {
  // El contacto se edita como TEXTO (lo que va escribiendo) y se limpia al pintar y al guardar.
  const deInicio = useMemo(() => ({ ...inicial, contacto: contactoEditable(inicial.contacto) }), [inicial]);
  const [d, setD] = useState(deInicio);
  const [activo, setActivo] = useState(null); // { clave, lado: "izq" | "der" }
  const [cual, setCual] = useState(0);        // qué cartilla se edita, con dos
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [ancho, setAncho] = useState(1280);
  const lado = useRef("der");
  const tarjeta = useRef(null);

  const esCupon = d.tipo === "descuento";
  const cambiado = JSON.stringify(lo(d)) !== JSON.stringify(lo(deInicio));
  // La vista previa enseña el contacto limpio; mientras uno está a medio escribir, el último que valía.
  const contactoLimpio = normalizarContacto(d.contacto);
  const ultimoBueno = useRef(inicial.contacto ?? null);
  if (!contactoLimpio.error) ultimoBueno.current = contactoLimpio.contacto;
  // Con un teléfono a medias no se guarda: el panel ya dice qué le pasa.
  const listo = cambiado && !contactoLimpio.error;
  // Con los iconos subidos dentro del tema: uno recién subido aún no está guardado en él.
  const vista = useMemo(() => ({ ...d, tema: conIconos(d.tema, lista), contacto: ultimoBueno.current }), [d, lista, contactoLimpio.error]);
  // La línea de abierto/cerrado: la del reloj, salvo que se haya apagado aquí.
  const estadoVista = d.tema.abierto === false ? null : estado;

  // Tres disposiciones: las dos tarjetas a la vez, una con conmutador, o el móvil.
  const disposicion = ancho >= 1180 ? "doble" : ancho >= 860 ? "una" : "movil";

  // Pantalla completa: la página de detrás no se mueve mientras se edita.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e) => { if (e.key === "Escape") setActivo(null); };
    const medida = () => setAncho(window.innerWidth);
    medida();
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", medida);
    return () => {
      document.body.style.overflow = antes;
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", medida);
    };
  }, []);

  const setTema = (k, v) => setD((p) => ({ ...p, tema: { ...p.tema, [k]: v } }));
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  // Con dos cartillas, la primera ES la meta y el premio de la tienda (lib/cartillas.js).
  const setCartilla = (i, k, v) => setD((p) => {
    const cartillas = p.cartillas.map((c, j) => (j === i ? { ...c, [k]: v } : c));
    return { ...p, cartillas, meta: cartillas[0].meta, premio: cartillas[0].premio };
  });
  // Otra plantilla: sus colores y su dibujo. El nombre, los sellos, el premio y
  // el logo propio se quedan. El fondo de Google, también, salvo que el diseño
  // traiga el suyo (los de un kit de marca).
  const plantilla = (estilo) => setD((p) => {
    const base = temaPorDefecto({ estilo, texto: p.tema.texto });
    return { ...p, tema: { ...base, logoImagen: p.tema.logoImagen ?? null, fondoFoto: p.tema.fondoFoto ?? null, abierto: p.tema.abierto, google: base.google ?? p.tema.google } };
  });

  // ---- una o dos cartillas
  function aDos() {
    setD((p) => {
      const t = p.tema;
      const marcaSellos = t.marca === "texto" ? "estrella" : t.marca;
      // La primera es la cartilla de siempre: su meta y su premio, los de ahora.
      const primera = { ...(p.cartillasAparcadas?.[0] || { nombre: "Sellos", marca: marcaSellos, modo: t.modo, forma: t.forma }), meta: Math.min(p.meta, 20), premio: p.premio };
      const segunda = p.cartillasAparcadas?.[1] || SEGUNDA_NUEVA;
      return { ...p, cartillas: [primera, segunda] };
    });
    setCual(0);
  }
  function aUna() {
    setD((p) => ({
      ...p,
      cartillas: null,
      cartillasAparcadas: p.cartillas,
      meta: p.cartillas[0].meta,
      premio: p.cartillas[0].premio,
      // La única cuenta como contaba la primera.
      tema: { ...p.tema, modo: p.cartillas[0].modo || p.tema.modo, forma: p.cartillas[0].forma || p.tema.forma },
    }));
  }

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
    // Tocar el campo de una cartilla ("CAFÉS · Faltan 4") la deja elegida en el panel.
    if (/premio2$/.test(clave)) setCual(1);
    else if (/\.premio$/.test(clave)) setCual(0);
  }

  // En "una" y en el móvil, el panel sale del lado del trozo tocado. En "doble",
  // del lado de su tarjeta: Apple a la izquierda, Google a la derecha.
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
            accent: t.accent, cardBg: t.cardBg, ink: t.ink, pageInk: t.pageInk, detalle: t.detalle || null,
            marca: t.marca, texto: t.texto || "", forma: t.forma, banda: t.banda, modo: t.modo, doble: t.doble,
            abierto: t.abierto !== false, google: t.google || "acento", logoImagen: logoImagenDe(t), fondoFoto: fotoDe(t),
          },
          contacto: d.contacto,
          ...(esCupon
            ? { premio: d.premio }
            : d.cartillas
              ? { cartillas: d.cartillas.map(({ nombre, marca, meta, premio, modo, forma }) => ({ nombre, marca, meta, premio, modo, forma })) }
              : { cartillas: null, cartillasAparcadas: d.cartillasAparcadas, meta: d.meta, premio: d.premio }),
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
  const kit = kitDe(slug);
  const ctx = { d, set, setTema, setCartilla, plantilla, esCupon, slug, elegida: cual, setElegida: setCual, aDos, aUna, inicial, estado, kit, cliente };
  const panelAbierto = seccion && (
    <aside className={`ed-panel ed-panel-${activo.lado}`} aria-label={TITULO[seccion]}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <strong style={{ flex: 1, fontSize: 15 }}>{TITULO[seccion]}</strong>
        <button type="button" onClick={() => setActivo(null)} style={cerrar} aria-label="Cerrar panel">×</button>
      </div>
      <Seccion cual={seccion} clave={activo.clave} {...ctx} />
    </aside>
  );

  const tarjetaDe = (plataforma) => (
    <PaseVista
      negocio={vista}
      cliente={cliente}
      qrTexto={`${origin}/w/${cliente.serial}`}
      estado={estadoVista}
      onCampo={abrir}
      campoActivo={activo?.clave || null}
      plataforma={plataforma}
    />
  );

  return (
    <div style={capa} role="dialog" aria-modal="true" aria-label="Editar tarjeta">
      <style>{CSS}</style>
      <header style={barra}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 16 }}>Editar tarjeta</strong>
          <div style={{ fontSize: 12, color: C.suave }}>Toca cualquier parte de la tarjeta para cambiarla.</div>
        </div>
        {cambiado && <button type="button" onClick={() => { setD(deInicio); setActivo(null); }} style={chip}>Deshacer todo</button>}
        <button type="button" onClick={salir} style={botonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={!listo || guardando} title={contactoLimpio.error || undefined}
          style={{ ...botonPrimario(d.tema.accent), opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "default" }}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </header>
      {error && <div style={{ background: C.malFondo, color: C.mal, padding: "8px 16px", fontSize: 14 }}>{error}</div>}

      {disposicion === "doble" ? (
        <div className="ed-cuerpo ed-doble">
          <div className="ed-lado">
            {activo?.lado === "izq" ? panelAbierto : <Pista lado="apple" />}
          </div>
          <div className="ed-centro" onPointerDownCapture={() => { lado.current = "izq"; }}>
            <div style={rotuloTel}>iPhone · Apple Wallet</div>
            {tarjetaDe("apple")}
          </div>
          <div className="ed-centro" onPointerDownCapture={() => { lado.current = "der"; }}>
            <div style={rotuloTel}>Android · Google Wallet</div>
            {tarjetaDe("google")}
          </div>
          <div className="ed-lado">
            {activo?.lado === "der" ? panelAbierto : <Pista lado="google" />}
          </div>
          <Abajo abrir={abrir} lado={lado} />
        </div>
      ) : (
        <div className="ed-cuerpo ed-una">
          <div className="ed-lado">{activo?.lado === "izq" && panelAbierto}</div>
          <div className="ed-centro">
            <div ref={tarjeta} onPointerDownCapture={apuntar}>{tarjetaDe(null)}</div>
            <Abajo abrir={abrir} lado={lado} />
          </div>
          <div className="ed-lado">
            {activo?.lado === "der" && panelAbierto}
            {!activo && disposicion !== "movil" && <Pista lado="las dos" />}
          </div>
        </div>
      )}
    </div>
  );
}

function Abajo({ abrir, lado }) {
  return (
    <div className="ed-abajo">
      <button type="button" onClick={() => { lado.current = "izq"; abrir("apple.fondo"); }} style={chip}>Colores y plantilla</button>
      <button type="button" onClick={() => { lado.current = "izq"; abrir("apple.banda"); }} style={chip}>Los sellos</button>
      <button type="button" onClick={() => { lado.current = "izq"; abrir("apple.logo"); }} style={chip}>Logo</button>
      <p style={{ fontSize: 12, color: C.tenue, textAlign: "center", margin: "8px 0 0", flexBasis: "100%" }}>
        Al guardar, la tarjeta cambia en todos los teléfonos. En Android (Google Wallet) puede tardar unos minutos.
      </p>
    </div>
  );
}

/** Lo que se ve en el hueco del panel cuando no hay ninguno abierto. */
function Pista({ lado }) {
  if (lado === "google") {
    return (
      <div className="ed-pista">
        <strong style={{ display: "block", marginBottom: 6 }}>Google Wallet, en Android</strong>
        Lleva lo mismo que la de Apple (logo, nombre, sellos, premio, textos), pero Google decide cómo se coloca:
        <ul style={lista}>
          <li>El fondo es <strong>un solo color</strong>; el texto lo pone Google en blanco o negro. Lo eliges en «Colores».</li>
          <li>La banda de sellos va <strong>abajo</strong>, siempre.</li>
          <li>«Abierto hasta…» va en los detalles, debajo.</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="ed-pista">
      <strong style={{ display: "block", marginBottom: 6 }}>¿Qué se puede cambiar?</strong>
      El logo (un dibujo o tu propia imagen), el nombre, los colores, una o dos cartillas y cómo cuenta cada
      una, cuántos sellos hacen falta y el premio. Y en su información (la i), «Cómo funciona», el teléfono, la web y el
      Instagram. Toca el trozo que quieras{lado === "las dos" ? ", en Apple o en Google" : ""}.
    </div>
  );
}

/** Lo que se guarda: para saber si hay algo que guardar. */
const lo = (n) => ({ nombre: n.nombre, meta: n.meta, premio: n.premio, cartillas: n.cartillas, tema: n.tema, contacto: n.contacto });

/** El contacto guardado, como textos de formulario (la web sin "https://"). */
const contactoEditable = (c) => ({
  telefono: c?.telefono || "",
  web: c?.web ? c.web.replace(/^https?:\/\//i, "") : "",
  instagram: c?.instagram ? `@${c.instagram}` : "",
});

// ------------------------------------------------------------ las secciones
function Seccion(props) {
  const { cual: seccion, clave, d, set, setTema, plantilla, esCupon, slug, estado } = props;
  const t = d.tema;

  if (seccion === "colores") return <PanelColores {...props} />;
  if (seccion === "logo") return <PanelLogo {...props} />;
  if (seccion === "sellos") return <PanelSellos {...props} />;
  if (seccion === "estado") return <PanelEstado d={d} setTema={setTema} estado={estado} slug={slug} />;

  if (seccion === "nombre") {
    return (
      <>
        <Nombre d={d} set={set} />
        <Color titulo="Color del texto (Apple)" valor={t.ink} onChange={(v) => setTema("ink", v)}
          ayuda="En Google el texto lo pone Google, blanco o negro según el fondo." />
      </>
    );
  }

  if (seccion === "premio") {
    if (d.cartillas) {
      return d.cartillas.map((c, i) => (
        <div key={i} style={{ marginTop: i ? 14 : 4 }}>
          <label style={{ ...etiqueta, marginTop: 0 }}>Premio · {c.nombre}</label>
          <input value={c.premio} maxLength={64} onChange={(e) => props.setCartilla(i, "premio", e.target.value)} style={campo} />
          <label style={etiqueta}>Sellos para conseguirlo</label>
          <Numero valor={c.meta} max={20} onChange={(v) => props.setCartilla(i, "meta", v)} />
        </div>
      ));
    }
    return (
      <>
        <label style={{ ...etiqueta, marginTop: 4 }}>{esCupon ? "Descuento" : "Qué se lleva el cliente"}</label>
        <input value={d.premio} maxLength={128} onChange={(e) => set("premio", e.target.value)}
          placeholder={esCupon ? "20% en la tarta" : "café gratis"} style={campo} />
        <p style={ayuda}>En el iPhone va en la fila de debajo de la banda: si es largo, encoge y acaba en «…». Mira cómo queda.</p>
        {!esCupon && (
          <>
            <label style={etiqueta}>Sellos para conseguirlo</label>
            <Numero valor={d.meta} max={50} onChange={(v) => set("meta", v)} />
          </>
        )}
      </>
    );
  }

  if (seccion === "reverso") {
    return (
      <>
        <p style={ayuda}>Lo que lee el cliente al tocar la (i) de la tarjeta (Apple) o al abrir los detalles (Google), en «Cómo funciona».</p>
        <textarea value={t.atras || ""} maxLength={200} rows={4} onChange={(e) => setTema("atras", e.target.value)}
          style={{ ...campo, resize: "vertical", fontFamily: "inherit" }} />
        <p style={{ ...ayuda, textAlign: "right" }}>{(t.atras || "").length}/200</p>
      </>
    );
  }

  if (seccion === "contacto") {
    const { error } = normalizarContacto(d.contacto);
    const poner = (k, v) => set("contacto", { ...d.contacto, [k]: v });
    return (
      <>
        <p style={ayuda}>Sale en la información de la tarjeta: la (i) en el iPhone, donde se toca para llamar o abrir; en Android son botones.</p>
        <label style={etiqueta}>Teléfono</label>
        <input value={d.contacto.telefono} onChange={(e) => poner("telefono", e.target.value)} inputMode="tel" placeholder="+34 960 00 00 00" maxLength={20} style={campo} />
        <label style={etiqueta}>Web</label>
        <input value={d.contacto.web} onChange={(e) => poner("web", e.target.value)} inputMode="url" placeholder="latienda.es" maxLength={120} style={campo} />
        <label style={etiqueta}>Instagram</label>
        <input value={d.contacto.instagram} onChange={(e) => poner("instagram", e.target.value)} placeholder="@latienda" maxLength={60} style={campo} />
        {error && <p style={{ ...ayuda, color: C.mal }}>{error}</p>}
        <p style={ayuda}>Lo que se deje vacío no sale.</p>
      </>
    );
  }

  if (seccion === "promo") {
    return (
      <p style={ayuda}>
        Lo que se les dice a los clientes (la promo, los avisos a un grupo, los programados) se escribe en{" "}
        <a href={`/${slug}/avisos`} style={{ color: d.tema.accent, fontWeight: 600 }}>Avisos</a>. Ahí también se
        ve a quién le llega.
      </p>
    );
  }

  if (seccion === "contador") {
    return (
      <>
        <p style={ayuda}>Cuenta los premios de cada cliente: lo pone la tarjeta sola. La etiqueta va en el color de los detalles.</p>
        <Color titulo="Color de las etiquetas" valor={colorDelPase(t)} onChange={colorDelPaseA(t, setTema)} />
      </>
    );
  }

  void clave;
  return (
    <p style={ayuda}>
      Esto es de cada cliente (su QR, su código, si el cupón está usado) y lo pone la tarjeta sola. Toca el fondo
      de la tarjeta para cambiar los colores.
    </p>
  );
}

// ------------------------------------------------------------- colores
/**
 * Cambiar "el color del logo, los sellos y las etiquetas": el de detalles si la
 * tarjeta lo tiene aparte; si no, el de la tienda, como siempre.
 */
const colorDelPaseA = (t, setTema) => (v) => setTema(t.detalle ? "detalle" : "accent", v);

function PanelColores({ d, setTema, plantilla, kit, slug, cliente }) {
  const t = d.tema;
  const google = t.google || "acento";
  const fondoG = fondoGoogle(t);
  const aparte = Boolean(t.detalle);
  return (
    <>
      <Cajones
        tuyosPrimero={Boolean(kit) && Object.hasOwn(kit.estilos, t.estilo)}
        tuyos={kit && (
          <>
            <p style={ayuda}>Tus diseños, hechos con tu manual de marca: tus colores y tu logo. Luego puedes retocar lo que quieras aquí debajo.</p>
            <DisenosDeMarca d={d} slug={slug} cliente={cliente} plantilla={plantilla} />
          </>
        )}
        vacio="Aquí salen los diseños hechos con tu manual de marca, cuando lo tengas. Los colores de abajo los eliges libres."
        predeterminados={(
          <>
            <p style={ayuda}>Plantillas para cualquier negocio. Cambian los colores y el dibujo; el nombre, los sellos, el premio y tu logo propio se quedan.</p>
            <Opciones opciones={ESTILOS_GENERALES} valor={t.estilo} rotulos={ROTULO_PLANTILLA} vista={vistaPlantilla} onChange={plantilla} ancho={120} />
          </>
        )}
      />
      <p style={{ ...ayuda, marginTop: 14 }}>
        Apple deja elegir tres colores. Google, <strong>solo el fondo</strong>: el texto lo pone él, en blanco o negro.
        Por eso las dos tarjetas pueden no verse del mismo color; aquí decides cómo.
      </p>

      <Bloque titulo="Las dos">
        <Color titulo="Color de la tienda"
          ayuda={aparte
            ? "Los botones de la caja y de tus pantallas. Y el fondo de Google, si no eliges otro."
            : "Logo, sellos y etiquetas (en las dos), y los botones de la caja. Y el fondo de Google, si no eliges otro."}
          valor={t.accent} onChange={(v) => setTema("accent", v)} />
        <label style={etiqueta}>Logo, sellos y etiquetas</label>
        <Segmentos
          valor={aparte ? "otro" : "tienda"}
          opciones={[["tienda", "El de la tienda"], ["otro", "Otro"]]}
          onChange={(v) => setTema("detalle", v === "otro" ? t.detalle || t.accent : null)}
        />
        {aparte && (
          <Color titulo="Color del logo, los sellos y las etiquetas" valor={t.detalle} onChange={(v) => setTema("detalle", v)}
            ayuda="Para cuando el fondo de la tarjeta es el color de la tienda: el logo y los sellos, en blanco." />
        )}
      </Bloque>

      <Bloque titulo="Apple Wallet">
        <Color titulo="Fondo de la tarjeta" valor={t.cardBg} onChange={(v) => setTema("cardBg", v)} />
        <Color titulo="Texto" valor={t.ink} onChange={(v) => setTema("ink", v)} />
        <Legible fondo={t.cardBg} texto={t.ink} accent={colorDelPase(t)} onArreglar={(v) => setTema("ink", v)} />
      </Bloque>

      <Bloque titulo="Google Wallet">
        <label style={{ ...etiqueta, marginTop: 4 }}>Fondo</label>
        <Segmentos
          valor={/^#/.test(google) ? "otro" : google}
          opciones={[["acento", "Color de la tienda"], ["tarjeta", "Igual que Apple"], ["otro", "Otro"]]}
          onChange={(v) => setTema("google", v === "otro" ? (/^#/.test(google) ? google : t.accent) : v)}
        />
        {/^#/.test(google) && <Color titulo="Color del fondo en Google" valor={google} onChange={(v) => setTema("google", v)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <span style={{ width: 54, height: 34, borderRadius: 8, background: fondoG, border: `1px solid ${C.borde}`, display: "grid", placeItems: "center", color: textoSobre(fondoG), fontSize: 12, fontWeight: 700 }}>Aa</span>
          <span style={{ ...ayuda, margin: 0 }}>Así se lee el texto en Google con este fondo.</span>
        </div>
      </Bloque>

    </>
  );
}

// ---------------------------------------------------------------- logo
function PanelLogo({ clave, d, set, setTema, kit }) {
  const t = d.tema;
  const { lista, setLista, slug } = useContext(Propios);
  const imagen = logoImagenDe(t);
  const [subiendo, setSubiendo] = useState(null);
  const [error, setError] = useState(null);
  const entradaLogo = useRef(null);
  const entradaIcono = useRef(null);
  const tc = conIconos(t, lista);

  async function subirLogo(fichero) {
    if (!fichero) return;
    setError(null);
    setSubiendo("logo");
    try {
      const cuerpo = await prepararImagen(fichero, { min: LOGO_MIN });
      const r = await fetch(`/api/logo?b=${slug}`, { method: "POST", headers: { "Content-Type": cuerpo.type || "image/png" }, body: cuerpo });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo subir");
      setTema("logoImagen", data.logoImagen);
      setLista((l) => ({ ...l, logos: [{ id: data.logoImagen.id, opaco: data.logoImagen.opaco }, ...l.logos.filter((x) => x.id !== data.logoImagen.id)] }));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubiendo(null);
      if (entradaLogo.current) entradaLogo.current.value = "";
    }
  }

  async function subirIcono(fichero) {
    if (!fichero) return;
    setError(null);
    setSubiendo("icono");
    try {
      const id = await subirPropio(slug, "iconos", fichero, setLista);
      setTema("marca", marcaDeIcono(id));
      if (imagen) setTema("logoImagen", null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubiendo(null);
      if (entradaIcono.current) entradaIcono.current.value = "";
    }
  }

  const elegirMarca = (m) => { setTema("marca", m); if (imagen) setTema("logoImagen", null); };
  const tuyas = marcasTuyas(kit, lista);
  const enTuyos = Boolean(imagen) || tuyas.includes(t.marca);

  return (
    <>
      {clave === "google.cabecera" && <Nombre d={d} set={set} />}
      <label style={{ ...etiqueta, marginTop: 4 }}>Logo</label>
      <Cajones
        tuyosPrimero={enTuyos}
        tuyos={(
          <>
            <div style={rejilla(78)}>
              {lista.logos.map((l) => {
                const elegido = imagen?.id === l.id;
                const temaLogo = { ...t, logoImagen: { id: l.id, b: slug, opaco: l.opaco } };
                return (
                  <Tuyo key={l.id} tipo="logos" id={l.id} elegido={elegido} onElegir={() => setTema("logoImagen", temaLogo.logoImagen)} rotulo="Tu imagen">
                    <LogoApple tema={temaLogo} tam={38} />
                  </Tuyo>
                );
              })}
              {tuyas.map((m) => (
                <Tuyo key={m} tipo={esMarcaPropia(m) ? "iconos" : null} id={idDeMarca(m)} elegido={!imagen && t.marca === m} onElegir={() => elegirMarca(m)}
                  rotulo={ROTULO[m] || lista.iconos.find((x) => marcaDeIcono(x.id) === m)?.nombre || "Tu icono"}>
                  <img src={comoDataUri(vistaMarca({ ...tc, texto: t.texto || "AB" }, m))} alt="" style={miniatura} />
                </Tuyo>
              ))}
              <Subir onClick={() => entradaLogo.current?.click()} texto={subiendo === "logo" ? "Subiendo…" : "Imagen de logo"} />
              <Subir onClick={() => entradaIcono.current?.click()} texto={subiendo === "icono" ? "Subiendo…" : "Icono propio"} />
            </div>
            <p style={ayuda}>
              <strong>Imagen de logo:</strong> tu logo tal cual (cuadrado, de al menos {LOGO_MIN}×{LOGO_MIN}). Los sellos siguen siendo un dibujo.{" "}
              <strong>Icono propio:</strong> un dibujo de un color (tu galleta, tu taza, tu mascota): vale de logo y dentro de los sellos,
              y se pinta del color que elijas. Mejor un PNG con el fondo transparente o un dibujo oscuro sobre blanco.
            </p>
          </>
        )}
        predeterminados={(
          <Opciones opciones={PREDETERMINADAS} valor={imagen ? null : t.marca} rotulos={ROTULO}
            vista={(m) => vistaMarca({ ...t, texto: t.texto || "AB" }, m)} onChange={elegirMarca} ancho={78} />
        )}
      />
      <input ref={entradaLogo} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" hidden onChange={(e) => subirLogo(e.target.files?.[0])} />
      <input ref={entradaIcono} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => subirIcono(e.target.files?.[0])} />

      {imagen && (
        <div style={{ ...cajaSuave, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "center" }}>
              <LogoApple tema={t} tam={40} style={{ background: t.cardBg, padding: 4, borderRadius: 8 }} />
              <div style={miniRotulo}>Apple</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <LogoGoogle tema={t} tam={48} />
              <div style={miniRotulo}>Google</div>
            </div>
            <p style={{ ...ayuda, flex: 1, margin: 0 }}>
              {imagen.opaco
                ? "Es cuadrada y sin transparencias: en Google y en el icono va a sangre (Google la recorta en círculo)."
                : "Tiene transparencias: va centrada sobre el fondo de la tarjeta, con aire alrededor."}
            </p>
          </div>
        </div>
      )}
      {error && <p style={{ ...ayuda, color: C.mal }}>{error}</p>}

      {!imagen && t.marca === "texto" && (
        <>
          <label style={etiqueta}>Letras o números</label>
          <input value={t.texto || ""} onChange={(e) => setTema("texto", e.target.value.toUpperCase().slice(0, 4))}
            placeholder="68" style={{ ...campo, letterSpacing: 2 }} maxLength={4} />
          <p style={ayuda}>Hasta cuatro. Sin tildes: se dibujan letra a letra.</p>
        </>
      )}
      {!imagen && <Color titulo="Color del logo" ayuda="Cambia también las etiquetas y los sellos." valor={colorDelPase(t)} onChange={colorDelPaseA(t, setTema)} />}
    </>
  );
}

/**
 * Sube algo a «Tuyos» (/api/propios) y deja la lista al día.
 * @returns {Promise<string>} el id de lo subido
 */
async function subirPropio(slug, tipo, fichero, setLista) {
  const cuerpo = tipo === "fondos"
    ? await prepararImagen(fichero, { min: 600, lado: 2000, formato: "image/jpeg" })
    : await prepararImagen(fichero, { min: 64 });
  const nombre = encodeURIComponent(String(fichero.name || "").slice(0, 40));
  const r = await fetch(`/api/propios?b=${slug}&tipo=${tipo}&nombre=${nombre}`, { method: "POST", headers: { "Content-Type": cuerpo.type || "image/png" }, body: cuerpo });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "No se pudo subir");
  const { id, ...lista } = data;
  setLista(lista);
  return id;
}

/** Los dos cajones: lo de todos y lo tuyo. Abre en «Tuyos» si lo puesto es tuyo. */
function Cajones({ tuyos, predeterminados, tuyosPrimero = false, vacio = null }) {
  const [cual, setCual] = useState(tuyosPrimero ? "tuyos" : "predeterminados");
  return (
    <>
      <Segmentos valor={cual} opciones={[["predeterminados", "Predeterminados"], ["tuyos", "Tuyos"]]} onChange={setCual} />
      <div style={{ marginTop: 10 }}>
        {cual === "tuyos" ? (tuyos || <p style={ayuda}>{vacio}</p>) : predeterminados}
      </div>
    </>
  );
}

/** Una pieza de «Tuyos»: se elige tocándola; lo subido se puede quitar de la lista (si no está puesto). */
function Tuyo({ tipo, id, elegido, onElegir, rotulo, children }) {
  const { setLista, slug } = useContext(Propios);
  const [error, setError] = useState(null);
  async function quitar(e) {
    e.stopPropagation();
    if (!window.confirm("¿Quitarlo de «Tuyos»? Si lo quieres otra vez, tendrás que subirlo.")) return;
    const r = await fetch(`/api/propios?b=${slug}&tipo=${tipo}&id=${id}`, { method: "DELETE" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setError(data.error || "No se pudo quitar");
    setLista(data);
  }
  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button type="button" onClick={onElegir} aria-pressed={elegido} title={error || rotulo} style={{ ...opcion(elegido), width: "100%" }}>
        {children}
        <span style={{ fontSize: 11, lineHeight: 1.2, color: elegido ? C.texto : C.suave, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{error || rotulo}</span>
      </button>
      {tipo && !elegido && (
        <button type="button" onClick={quitar} aria-label={`Quitar ${rotulo}`} style={quitarTuyo}>×</button>
      )}
    </div>
  );
}

function Subir({ onClick, texto }) {
  return (
    <button type="button" onClick={onClick} style={{ ...opcion(false), border: `2px dashed ${C.bordeFuerte}`, background: "#fff" }}>
      <span style={{ height: 38, display: "grid", placeItems: "center", fontSize: 26, color: C.suave }}>+</span>
      <span style={{ fontSize: 11, lineHeight: 1.2, color: C.suave }}>{texto}</span>
    </button>
  );
}

/**
 * La foto del móvil puede pesar 8 MB y venir tumbada: aquí se gira según su
 * EXIF y se reduce a 1024 px antes de subirla (en PNG, para no perder la
 * transparencia). Si el navegador no sabe abrirla (HEIC en algunos), va tal cual
 * y que decida el servidor.
 */
async function prepararImagen(fichero, { min = LOGO_MIN, lado = 1024, formato = "image/png" } = {}) {
  let bmp;
  try {
    bmp = await createImageBitmap(fichero, { imageOrientation: "from-image" });
  } catch {
    if (fichero.size > 4 * 1024 * 1024) throw new Error("Esa imagen no se puede abrir aquí y pesa más de 4 MB. Prueba con un PNG o un JPG.");
    return fichero;
  }
  if (Math.max(bmp.width, bmp.height) < min) {
    throw new Error(`La imagen es muy pequeña (${bmp.width}×${bmp.height}). Hace falta al menos ${min} píxeles de lado.`);
  }
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bmp.width * k);
  lienzo.height = Math.round(bmp.height * k);
  lienzo.getContext("2d").drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  // Las fotos en JPG: un PNG de 2000 px pasaría de los 4 MB que admite el servidor.
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo preparar la imagen"))), formato, 0.9));
}

// -------------------------------------------------------------- sellos
function PanelSellos(props) {
  const { d, set, setTema, setCartilla, esCupon, elegida, setElegida, aDos, aUna, inicial, slug, kit } = props;
  const t = d.tema;
  const { lista } = useContext(Propios);
  const tc = conIconos(t, lista);

  if (esCupon) {
    return (
      <>
        <label style={{ ...etiqueta, marginTop: 4 }}>Dibujo de la banda</label>
        <ElegirDibujo kit={kit} tema={tc} valor={t.marca} onChange={(m) => setTema("marca", m)} ancho={78} />
        <Color titulo="Color" valor={colorDelPase(t)} onChange={colorDelPaseA(t, setTema)} />
      </>
    );
  }

  const dos = Boolean(d.cartillas);
  const c = dos ? d.cartillas[Math.min(elegida, 1)] : null;
  const i = Math.min(elegida, 1);
  // Lo que cada modo necesita, de la cartilla elegida o de la única.
  const temaDe = dos ? { ...tc, marca: c.marca, modo: c.modo || "casillas", forma: c.forma || t.forma } : tc;
  const meta = dos ? c.meta : d.meta;
  const modo = dos ? c.modo || (t.doble === "llenar" ? "relleno" : "casillas") : t.modo;
  const ponModo = (m) => (dos ? setCartilla(i, "modo", m) : setTema("modo", m));
  const ponForma = (f) => (dos ? setCartilla(i, "forma", f) : setTema("forma", f));
  const familia = familiaDeModo(modo);
  const variantes = modosDeFamilia(familia);

  return (
    <>
      <label style={{ ...etiqueta, marginTop: 4 }}>Cartillas en la tarjeta</label>
      <Segmentos valor={dos ? "dos" : "una"} opciones={[["una", "Una"], ["dos", "Dos"]]} onChange={(v) => (v === "dos" ? aDos() : aUna())} />
      <AvisoCartillas d={d} inicial={inicial} slug={slug} aDos={aDos} />

      {dos && (
        <>
          <label style={etiqueta}>Cómo se reparten</label>
          <Opciones opciones={MODOS_DOBLES} valor={t.doble === "llenar" ? "lados" : t.doble || "filas"} rotulos={ROTULO_DOBLE}
            vista={(m) => vistaDoble(tc, m, d.cartillas)} onChange={(m) => setTema("doble", m)} ancho={150} />

          {/* Un botón para cada una, no una lista larga con las dos debajo. */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.borde}` }}>
            <Segmentos valor={String(i)} opciones={d.cartillas.map((x, j) => [String(j), x.nombre || `Cartilla ${j + 1}`])} onChange={(v) => setElegida(Number(v))} fuerte accent={t.accent} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px", minWidth: 0 }}>
              <label style={etiqueta}>Nombre</label>
              <input value={c.nombre} maxLength={24} onChange={(e) => setCartilla(i, "nombre", e.target.value)} style={campo} />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <label style={etiqueta}>Sellos</label>
              <Numero valor={c.meta} max={20} onChange={(v) => setCartilla(i, "meta", v)} />
            </div>
          </div>
          <label style={etiqueta}>Premio</label>
          <input value={c.premio} maxLength={64} onChange={(e) => setCartilla(i, "premio", e.target.value)} style={campo} />
          <label style={etiqueta}>Dibujo de sus sellos</label>
          <ElegirDibujo key={i} kit={kit} tema={tc} valor={c.marca} onChange={(m) => setCartilla(i, "marca", m)} ancho={64} sinTexto />
        </>
      )}

      {!dos && (
        <>
          <label style={etiqueta}>Sellos para el premio</label>
          <Numero valor={d.meta} max={50} onChange={(v) => set("meta", v)} />
        </>
      )}

      <label style={etiqueta}>Cómo se cuentan{dos ? ` (${c.nombre})` : ""}</label>
      <Opciones opciones={NOMBRES_FAMILIA} valor={familia} rotulos={ROTULO_FAMILIA}
        vista={(f) => vistaFamilia(temaDe, f, meta)} onChange={(f) => ponModo(modosDeFamilia(f)[0])} ancho={132} />
      {variantes.length > 1 && (
        <>
          <label style={etiqueta}>Variante</label>
          <Opciones opciones={variantes} valor={modo} rotulos={ROTULO_MODO}
            vista={(m) => vistaModo(temaDe, m, meta)} onChange={ponModo} ancho={132} />
        </>
      )}
      {modo === "casillas" && (
        <>
          <label style={etiqueta}>Casilla del sello</label>
          <Opciones opciones={FORMAS} valor={dos ? c.forma || t.forma : t.forma} rotulos={ROTULO} vista={(f) => vistaForma(t, f)} onChange={ponForma} ancho={100} />
        </>
      )}

      <div style={{ marginTop: 16, paddingTop: 4, borderTop: `1px solid ${C.borde}` }}>
        <label style={etiqueta}>Fondo de la banda</label>
        <FondoBanda t={tc} setTema={setTema} />
        <Color titulo="Color de los sellos" ayuda="Cambia también las etiquetas y el logo." valor={colorDelPase(t)} onChange={colorDelPaseA(t, setTema)} />
        <InterruptorAbierto d={d} setTema={setTema} estado={props.estado} slug={slug} />
      </div>
    </>
  );
}

/** El dibujo de los sellos (o del cupón): los de todos o los tuyos (kit e iconos subidos). */
function ElegirDibujo({ kit, tema, valor, onChange, ancho, sinTexto = false }) {
  const { lista, setLista, slug } = useContext(Propios);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const entrada = useRef(null);
  const tuyas = marcasTuyas(kit, lista);

  async function subir(fichero) {
    if (!fichero) return;
    setError(null);
    setSubiendo(true);
    try {
      onChange(marcaDeIcono(await subirPropio(slug, "iconos", fichero, setLista)));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <>
      <Cajones
        tuyosPrimero={tuyas.includes(valor)}
        tuyos={(
          <div style={rejilla(ancho)}>
            {tuyas.map((m) => (
              <Tuyo key={m} tipo={esMarcaPropia(m) ? "iconos" : null} id={idDeMarca(m)} elegido={valor === m} onElegir={() => onChange(m)}
                rotulo={ROTULO[m] || lista.iconos.find((x) => marcaDeIcono(x.id) === m)?.nombre || "Tu icono"}>
                <img src={comoDataUri(vistaMarca(tema, m))} alt="" style={miniatura} />
              </Tuyo>
            ))}
            {lista.iconos.length < MAX_PROPIOS.iconos && (
              <Subir onClick={() => entrada.current?.click()} texto={subiendo ? "Subiendo…" : "Icono propio"} />
            )}
          </div>
        )}
        predeterminados={(
          <Opciones opciones={sinTexto ? PREDETERMINADAS.filter((m) => m !== "texto") : PREDETERMINADAS} valor={valor} rotulos={ROTULO}
            vista={(m) => vistaMarca(tema, m)} onChange={onChange} ancho={ancho} />
        )}
      />
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => subir(e.target.files?.[0])} />
      {error && <p style={{ ...ayuda, color: C.mal }}>{error}</p>}
    </>
  );
}

/** El fondo de la banda: los de siempre o una foto tuya, con un velo para que los sellos se lean. */
function FondoBanda({ t, setTema }) {
  const { lista, setLista, slug } = useContext(Propios);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const entrada = useRef(null);
  const foto = t.banda === "foto" ? fotoDe(t) : null;
  const ponerFoto = (id) => { setTema("fondoFoto", { id, b: slug }); setTema("banda", "foto"); };

  async function subir(fichero) {
    if (!fichero) return;
    setError(null);
    setSubiendo(true);
    try {
      ponerFoto(await subirPropio(slug, "fondos", fichero, setLista));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <>
      <Cajones
        tuyosPrimero={Boolean(foto)}
        tuyos={(
          <>
            <div style={rejilla(132)}>
              {lista.fondos.map((f) => (
                <Tuyo key={f.id} tipo="fondos" id={f.id} elegido={foto?.id === f.id} onElegir={() => ponerFoto(f.id)} rotulo={f.nombre}>
                  <img src={rutaFoto({ id: f.id, b: slug })} alt="" style={{ ...miniatura, width: "100%", objectFit: "cover", borderRadius: 4 }} />
                </Tuyo>
              ))}
              {lista.fondos.length < MAX_PROPIOS.fondos && (
                <Subir onClick={() => entrada.current?.click()} texto={subiendo ? "Subiendo…" : "Foto para la banda"} />
              )}
            </div>
            <p style={ayuda}>
              Una foto tuya (tu escaparate, tu producto) detrás de los sellos, con un velo del color de la tarjeta para que se lean.
              Se recorta sola a lo ancho de la banda. Mejor apaisada y de al menos 1200 píxeles de ancho.
            </p>
          </>
        )}
        predeterminados={(
          <Opciones opciones={BANDAS} valor={t.banda} rotulos={ROTULO} vista={(b) => vistaBanda(t, b)} onChange={(b) => setTema("banda", b)} ancho={132} />
        )}
      />
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" hidden onChange={(e) => subir(e.target.files?.[0])} />
      {error && <p style={{ ...ayuda, color: C.mal }}>{error}</p>}
    </>
  );
}

/**
 * Lo que pasa al cambiar de dos a una (o al revés), dicho antes de guardar:
 * nada se borra, y cuántos clientes tienen algo en la que se aparca.
 */
function AvisoCartillas({ d, inicial, slug, aDos }) {
  const [cuenta, setCuenta] = useState(null);
  const pasaAUna = !d.cartillas && Boolean(inicial.cartillas);
  const aparcada = !d.cartillas && d.cartillasAparcadas?.[1];

  useEffect(() => {
    if (!pasaAUna || cuenta) return;
    fetch(`/api/clientes?b=${slug}&segunda=1`).then((r) => (r.ok ? r.json() : null)).then(setCuenta).catch(() => {});
  }, [pasaAUna, slug, cuenta]);

  if (pasaAUna) {
    const nombre = inicial.cartillas[1].nombre;
    return (
      <div style={{ ...cajaAviso, marginTop: 10 }}>
        <strong>«{nombre}» no se borra.</strong> Los sellos de {nombre.toLowerCase()} de cada cliente se quedan guardados:
        no se ven en la tarjeta ni se pueden sumar, pero vuelven tal cual si pasas otra vez a dos.
        {cuenta && (cuenta.conSellos > 0 || cuenta.conGuardados > 0) && (
          <div style={{ marginTop: 6 }}>
            Ahora mismo: {cuenta.conSellos} {cuenta.conSellos === 1 ? "cliente tiene" : "clientes tienen"} sellos de {nombre.toLowerCase()}
            {cuenta.conGuardados > 0 && ` y ${cuenta.conGuardados} ${cuenta.conGuardados === 1 ? "tiene un premio guardado" : "tienen premios guardados"} que no podrán usar mientras tanto`}.
          </div>
        )}
        <button type="button" onClick={aDos} style={{ ...chip, marginTop: 8 }}>Volver a dos cartillas</button>
      </div>
    );
  }
  if (aparcada) {
    return (
      <div style={{ ...cajaSuave, marginTop: 10, fontSize: 12.5 }}>
        Tienes «{aparcada.nombre}» guardada, con los sellos de cada cliente.
        <button type="button" onClick={aDos} style={{ ...chip, marginLeft: 8, minHeight: 30, padding: "3px 10px" }}>Recuperarla</button>
      </div>
    );
  }
  return null;
}

function InterruptorAbierto({ d, setTema, estado, slug }) {
  const on = d.tema.abierto !== false;
  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 14 }}>
        <input type="checkbox" checked={on} onChange={(e) => setTema("abierto", e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          <strong style={{ fontWeight: 600 }}>«● Abierto hasta las…» en la tarjeta</strong>
          <span style={{ ...ayuda, display: "block" }}>
            {!d.horario
              ? <>Hace falta tu horario: ponlo en la pestaña <a href={`/${slug}/manager`} style={{ color: d.tema.accent }}>Tienda</a>.</>
              : !estado
                ? "Sale cuando el reloj de los avisos está en marcha (lo dice la pestaña Avisos)."
                : on
                  ? `En Apple va dibujado arriba de la banda (los sellos bajan un poco para dejarle sitio). En Google, el primero de los detalles. Ahora diría: «${estado.texto}».`
                  : "Apagado: la banda usa todo su alto y Google no lo lleva."}
          </span>
        </span>
      </label>
    </div>
  );
}

function PanelEstado({ d, setTema, estado, slug }) {
  return (
    <>
      <p style={ayuda}>
        Google no deja cambiar su imagen cada hora, así que en Android la línea va en los detalles, como «Ahora». La
        cambia el reloj de la tienda en todas las tarjetas a la vez.
      </p>
      <InterruptorAbierto d={d} setTema={setTema} estado={estado} slug={slug} />
    </>
  );
}

// ------------------------------------------------------------- piezas
function Nombre({ d, set }) {
  return (
    <>
      <label style={{ ...etiqueta, marginTop: 4 }}>Nombre de la tienda</label>
      <input value={d.nombre} maxLength={60} onChange={(e) => set("nombre", e.target.value)} style={campo} />
      <p style={ayuda}>Sale arriba en las dos tarjetas y en los avisos. En el iPhone, si es largo, se corta.</p>
    </>
  );
}

function Bloque({ titulo, children }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.borde}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.texto }}>{titulo}</div>
      {children}
    </div>
  );
}

/** Botones en fila para elegir uno (una/dos cartillas, cuál se edita…). */
function Segmentos({ valor, opciones, onChange, fuerte = false, accent = "#2563eb" }) {
  return (
    <div role="radiogroup" style={{ display: "flex", gap: 4, padding: 3, background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 10 }}>
      {opciones.map(([id, texto]) => {
        const on = id === valor;
        return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onChange(id)} style={{
            flex: 1, minWidth: 0, padding: "7px 8px", borderRadius: 8, border: 0, cursor: "pointer", fontSize: 13,
            fontWeight: on ? 650 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            background: on ? (fuerte ? accent : "#fff") : "transparent",
            color: on ? (fuerte ? "#fff" : C.texto) : C.suave,
            boxShadow: on ? "0 1px 3px rgba(16,20,28,.16)" : "none",
          }}>{texto}</button>
        );
      })}
    </div>
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
  const paleta = useContext(Paleta);
  return (
    <div>
      <label style={etiqueta}>{titulo}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={valor || "#000000"} onChange={(e) => onChange(e.target.value)}
          style={{ width: 52, height: 40, padding: 2, border: `1px solid ${C.borde}`, borderRadius: 8, background: "#fff", cursor: "pointer" }} />
        {/* Se escribe libre y solo cuenta al quedar un color entero ("#a1b2c3"). */}
        <input defaultValue={valor || ""} key={valor} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase()); }}
          maxLength={7} aria-label={`${titulo} en hexadecimal`}
          style={{ ...campo, fontFamily: "ui-monospace, Menlo, monospace", width: 110 }} />
        {/* Los de su manual de marca, a un toque. */}
        {paleta.map((m) => {
          const puesto = String(valor || "").toLowerCase() === m.hex;
          return (
            <button key={m.hex} type="button" onClick={() => onChange(m.hex)} title={m.nombre} aria-label={`${titulo}: ${m.nombre}`} aria-pressed={puesto}
              style={{ width: 30, height: 30, borderRadius: "50%", background: m.hex, cursor: "pointer", padding: 0, flexShrink: 0,
                border: `1px solid ${C.bordeFuerte}`, boxShadow: puesto ? "0 0 0 2px #fff, 0 0 0 4px #2563eb" : "none" }} />
          );
        })}
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

// Lo mismo que hace Google: texto blanco o negro según el fondo.
function textoSobre(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return "#fff";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#202124" : "#fff";
}

// ------------------------------------------------------------- estilos
// DOBLE: panel | Apple | Google | panel. UNA: panel | tarjeta | panel. En el
// móvil la tarjeta ocupa todo y el panel sube desde abajo (como mucho la mitad).
const CSS = `
.ed-cuerpo { flex: 1; overflow-y: auto; display: grid; gap: 20px; padding: 20px 20px 40px; align-items: start; }
.ed-doble { grid-template-columns: minmax(250px, 330px) minmax(0, 340px) minmax(0, 340px) minmax(250px, 330px); justify-content: center; }
.ed-una { grid-template-columns: minmax(0, 1fr) minmax(280px, 340px) minmax(0, 1fr); }
.ed-centro { min-width: 0; }
.ed-lado { min-width: 0; position: sticky; top: 0; }
.ed-abajo { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.ed-panel { background: #fff; border: 1px solid ${C.borde}; border-radius: 14px; padding: 16px; max-height: calc(100vh - 110px); overflow-y: auto; box-shadow: 0 12px 32px rgba(16,20,28,.12); max-width: 380px; }
.ed-una .ed-panel-izq { margin-left: auto; }
.ed-pista { color: ${C.suave}; font-size: 13px; line-height: 1.5; padding: 14px; border: 1px dashed ${C.bordeFuerte}; border-radius: 12px; }
.ed-una .ed-abajo { margin-top: 14px; }
@media (max-width: 859px) {
  .ed-una { grid-template-columns: minmax(0, 1fr); padding: 16px 16px 55vh; gap: 12px; }
  .ed-lado { position: static; }
  .ed-una .ed-lado:first-child { display: none; }
  .ed-una .ed-lado:has(.ed-panel-izq) { display: block; }
  .ed-panel { position: fixed; left: 0; right: 0; bottom: 0; max-width: none; max-height: 52vh; border-radius: 16px 16px 0 0; z-index: 2; margin: 0; }
}
`;

const capa = { position: "fixed", inset: 0, zIndex: 1200, background: C.fondo, display: "flex", flexDirection: "column", color: C.texto };
const barra = { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff", borderBottom: `1px solid ${C.borde}`, flexWrap: "wrap" };
const cerrar = { width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.borde}`, background: "#fff", fontSize: 20, lineHeight: 1, cursor: "pointer", color: C.suave };
const chip = { padding: "8px 14px", borderRadius: 999, border: `1px solid ${C.borde}`, background: "#fff", fontSize: 13, cursor: "pointer", color: C.texto, minHeight: 36 };
const ayuda = { fontSize: 12, color: C.suave, margin: "6px 0 0", lineHeight: 1.45 };
const lista = { margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 };
const rotuloTel = { fontSize: 12, fontWeight: 650, color: C.suave, textAlign: "center", marginBottom: 8, letterSpacing: 0.3 };
const miniRotulo = { fontSize: 10.5, color: C.tenue, marginTop: 4 };
const cajaSuave = { background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10 };
const cajaAviso = { background: "#fff8e6", border: "1px solid #f3d38a", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.45, color: "#5c4400" };
const rejilla = (ancho) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${ancho}px, 1fr))`, gap: 6 });
const miniatura = { height: 38, maxWidth: "100%", objectFit: "contain", display: "block" };
const quitarTuyo = {
  position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: 6, border: `1px solid ${C.borde}`,
  background: "#fff", color: C.suave, fontSize: 13, lineHeight: 1, cursor: "pointer", padding: 0,
};
const paso = { width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.borde}`, background: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 };
const opcion = (activa) => ({
  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  padding: 6, borderRadius: 10, cursor: "pointer", textAlign: "center", minWidth: 0,
  border: `2px solid ${activa ? "#2563eb" : "transparent"}`,
  background: activa ? "#eff4ff" : C.panelSuave,
});
