"use client";

import { useEffect, useRef, useState } from "react";
import QrImagen from "@/app/QrImagen";
import { camposDelPase } from "@/lib/apple/pase";
import { svgBandaOpaca, stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { LogoApple, LogoGoogle } from "@/app/LogoTienda";
import { construirClase, construirObjeto } from "@/lib/google/pase";
import { enlacesDeContacto } from "@/lib/contacto";
import { encajar, repartir, medirAprox } from "@/lib/vistaWallet";
import { C } from "@/app/ui";

// ============================================================================
// VISTA PREVIA DEL PASE (Apple / Google)
// ----------------------------------------------------------------------------
// Lo que el manager ve mientras configura su cartilla. No es un pase de verdad,
// pero tampoco es una maqueta inventada: todo lo que sale aquí viene de las
// mismas funciones que arman el pase real.
//
//   texto  -> camposDelPase()             (el mismo que llena pass.json)
//   dibujo -> stripDelPase() y svgLogo()  (el mismo SVG que va dentro del .pkpass)
//   Google -> construirClase() y construirObjeto() (lo mismo que se manda a Google)
//
// Lo que NO decidimos nosotros es cómo lo coloca el teléfono. Eso se ha copiado
// de capturas de pases de verdad (octubre 2026):
//   APPLE   tarjeta de alto fijo; la fila bajo la banda reparte el sitio como
//           iOS (lib/vistaWallet.js: encoge, pasa a dos líneas, acaba en "…");
//           el reverso es la hoja de (i), en oscuro.
//   GOOGLE  una sola pantalla que se desplaza: logo, nombre enorme, QR, puntos,
//           la banda abajo y luego los detalles en tarjetitas.
// Todo a escala de un iPhone/Android de ~390 pt, con la tarjeta a 300 px.
// ============================================================================

const ANCHO = 300; // ancho de la tarjeta en la vista previa (las medidas salen de aquí)
const FUENTE_APPLE = '-apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const FUENTE_GOOGLE = '"Google Sans", Roboto, system-ui, sans-serif';

/**
 * @param {object} props
 * @param {object} [props.notas]       { "apple.premio": "esto debería ser X" }
 * @param {Function} [props.onCampo]   (clave, etiqueta) => void. Si viene, cada
 *                                     campo se puede tocar (comentar o editar).
 * @param {string} [props.campoActivo] clave del campo que se está tocando
 * @param {object} [props.estado]      la línea "● Abierto hasta las 14:00" (estadoParaPase)
 * @param {"delante"|"detras"} [props.cara]  si quien la usa quiere mandar en el lado de Apple
 */
// `plataforma`: "apple" o "google" para enseñar solo esa (el editor pone las dos
// una al lado de otra); sin ella, un conmutador.
export default function PaseVista({ negocio, cliente, qrTexto, pie = null, notas = {}, onCampo = null, campoActivo = null, estado = null, cara: caraFuera, onCara, plataforma = null }) {
  const [cualDentro, setCual] = useState("apple");
  const cual = plataforma || cualDentro;
  const [caraDentro, setCaraDentro] = useState("delante");
  const cara = caraFuera || caraDentro;
  const setCara = onCara || setCaraDentro;
  const anota = { notas, onCampo, campoActivo };
  const medir = useMedir();
  const origen = String(qrTexto || "").split("/w/")[0];
  const [caja, escala] = useEscala();

  return (
    <div ref={caja}>
      {!plataforma && <div style={conmutador}>
        {[["apple", " Apple Wallet"], ["google", "Google Wallet"]].map(([id, texto]) => (
          <button key={id} type="button" onClick={() => setCual(id)} aria-pressed={cual === id} style={opcion(cual === id)}>
            {texto}
          </button>
        ))}
      </div>}

      {/* En Apple se le da la vuelta con (i). Google no tiene "detrás": todo va
          en la misma pantalla, desplazándose hacia abajo. */}
      {cual === "apple" && (
        <div style={{ ...conmutador, maxWidth: 220, padding: 3, margin: "-6px auto 14px" }}>
          {[["delante", "Delante"], ["detras", "Detrás"]].map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setCara(id)} aria-pressed={cara === id} style={{ ...opcion(cara === id), fontSize: 12, padding: "0.3rem 0.5rem" }}>
              {texto}
            </button>
          ))}
        </div>
      )}

      {/* En una columna estrecha la pantalla se ENCOGE entera (zoom), no se
          recoloca: las medidas de iOS y Google están hechas para 300 px. */}
      <div style={{ zoom: escala }}>
      {cual === "apple"
        ? (cara === "detras"
          ? <ReversoApple negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={anota} medir={medir} origen={origen} estado={estado} onHecho={() => setCara("delante")} />
          : (
            // Sin marco de teléfono: la tarjeta sola, como se la imagina el dueño.
            <div style={{ width: ANCHO, margin: "0 auto" }}>
              <TarjetaApple negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={anota} estado={estado} medir={medir} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" onClick={() => setCara("detras")} aria-label="Ver el reverso" style={botonInfo}>i</button>
              </div>
            </div>
          ))
        // La línea de abierto/cerrado, en Google, es un módulo de la clase (ver google/pase.js).
        : <PantallaGoogle negocio={{ ...negocio, estadoPase: estado?.texto ?? null }} cliente={cliente} qrTexto={qrTexto} anota={anota} />}
      </div>

      {pie && <p style={{ fontSize: 12, color: C.tenue, margin: "10px 0 0", textAlign: "center" }}>{pie}</p>}
    </div>
  );
}

/** Cuánto hay que encoger la pantalla para que quepa en su columna. */
function useEscala() {
  const caja = useRef(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ver = () => setEscala(Math.min(1, el.clientWidth / (ANCHO + 24)) || 1);
    ver();
    const ro = new ResizeObserver(ver);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [caja, escala];
}

/**
 * Medir texto de verdad necesita un canvas, y en el servidor no hay. Hasta
 * montarse se usa una regla de tres; así el HTML del servidor y el primer
 * pintado del navegador coinciden (nada de avisos de hidratación).
 */
let lienzo = null;
function useMedir() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return (texto, tam) => medirAprox(texto, tam);
  return (texto, tam, peso = 400, familia = FUENTE_APPLE) => {
    lienzo ||= document.createElement("canvas").getContext("2d");
    lienzo.font = `${peso} ${tam}px ${familia}`;
    return lienzo.measureText(String(texto ?? "")).width;
  };
}

/**
 * Envuelve un trozo del pase. Fuera del modo edición/comentarios no pinta nada
 * (un div normal); dentro, se vuelve un botón con marco de puntos y un punto de
 * color si ya tiene nota. Así la vista previa es la misma en los dos modos.
 */
function Anotable({ clave, etiqueta, anota, children, estilo = {} }) {
  const { notas, onCampo, campoActivo } = anota || {};
  if (!onCampo) return <div style={estilo}>{children}</div>;

  const tiene = Boolean(notas?.[clave]);
  const activo = campoActivo === clave;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCampo(clave, etiqueta); }}
      title={tiene ? notas[clave] : etiqueta}
      // El estilo del trozo va DESPUÉS de lo de partida: el logo pide `width: auto`
      // y la banda va sin margen; si no, lo pisaría el 100 %.
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        // Relleno 2 + borde 1 = margen -3: editando, nada se mueve de su sitio.
        padding: 2,
        margin: -3,
        borderRadius: 6,
        ...estilo,
        border: `1px dashed ${activo ? "#2563eb" : tiene ? "#16a34a" : "rgba(127,127,127,.55)"}`,
        background: activo ? "rgba(37,99,235,.14)" : tiene ? "rgba(22,163,74,.10)" : "transparent",
      }}
    >
      {children}
      {tiene && <span style={puntoNota} aria-label="tiene comentario" />}
    </button>
  );
}

// Tocar la tarjeta fuera de cualquier campo es tocar su FONDO (los colores).
// Los campos paran el clic, así que aquí solo llega el que cae en hueco.
const fondo = (anota, clave) => (anota?.onCampo ? () => anota.onCampo(clave, "Colores de la tarjeta") : undefined);
const tocable = (anota) => (anota?.onCampo ? { cursor: "pointer" } : {});

// ---------------------------------------------------------------- Apple
// Medidas sacadas de una captura de iPhone, pasadas a una tarjeta de 300 px.
const A = {
  alto: 422, margen: 12, logo: 32, nombre: 14.5,
  etiqueta: 9.5, valor: 20, valorMin: 11, cabecera: 17, hueco: 12, qr: 112,
};

// Orden real: cabecera (logo + nombre | headerFields), banda a sangre (con la
// línea de abierto/cerrado dibujada dentro), UNA fila de campos y el código
// abajo. En los cupones el primario va ENCIMA de la banda.
function TarjetaApple({ negocio, cliente, qrTexto, anota, estado, medir }) {
  const t = negocio.tema;
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = camposDelPase(cliente, negocio);
  const strip = stripDelPase(negocio, cliente, { estado });
  const fila = [...secondaryFields, ...auxiliaryFields];

  return (
    <div
      style={{
        width: ANCHO, height: A.alto, margin: "0 auto", borderRadius: 11, overflow: "hidden",
        background: t.cardBg, color: t.ink, fontFamily: FUENTE_APPLE, display: "flex", flexDirection: "column",
        boxShadow: "0 0 0 1px rgba(255,255,255,.08)", ...tocable(anota),
      }}
      onClick={fondo(anota, "apple.fondo")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: `10px ${A.margen}px 8px` }}>
        <Anotable clave="apple.logo" etiqueta="Logo" anota={anota} estilo={{ width: "auto", flexShrink: 0 }}>
          <LogoApple tema={t} tam={A.logo} />
        </Anotable>
        <Anotable clave="apple.nombre" etiqueta="Nombre del negocio" anota={anota} estilo={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: A.nombre, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {negocio.nombre}
          </div>
        </Anotable>
        {headerFields.map((f) => (
          <Anotable key={f.key} clave={`apple.${f.key}`} etiqueta={f.label} anota={anota} estilo={{ width: "auto", textAlign: "right", flexShrink: 0, maxWidth: "40%" }}>
            <div style={etiquetaApple(t.accent)}>{f.label}</div>
            <div style={{ fontSize: A.cabecera, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</div>
          </Anotable>
        ))}
      </div>

      <div style={{ position: "relative", flexShrink: 0 }}>
        <Anotable clave="apple.banda" etiqueta="Banda (los sellos)" anota={anota} estilo={{ padding: 0, margin: 0, borderRadius: 0 }}>
          <img src={comoDataUri(strip.svg)} alt={`Banda del pase, ${strip.ancho}×${strip.alto} puntos`} style={{ display: "block", width: "100%", height: "auto" }} />
        </Anotable>
        {primaryFields.length > 0 && (
          <div style={sobreLaBanda}>
            <Anotable clave={`apple.${primaryFields[0].key}`} etiqueta={primaryFields[0].label} anota={anota} estilo={{ width: "auto", maxWidth: "62%" }}>
              <div style={{ ...etiquetaApple("#ffffff"), opacity: 0.9 }}>{primaryFields[0].label}</div>
              <div style={{ fontSize: 26, fontWeight: 500, color: "#fff", lineHeight: 1.1, textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
                {primaryFields[0].value}
              </div>
            </Anotable>
          </div>
        )}
      </div>

      <FilaApple campos={fila} accent={t.accent} anota={anota} medir={medir} />

      <div style={{ marginTop: "auto", display: "grid", placeItems: "center", padding: "8px 0 14px" }}>
        <Anotable clave="apple.codigo" etiqueta="QR y código corto" anota={anota} estilo={{ width: "auto" }}>
          <div style={{ background: "#fff", padding: "9px 9px 5px", borderRadius: 6, color: "#000", textAlign: "center" }}>
            <QrImagen texto={qrTexto} lado={A.qr} />
            <div style={{ fontSize: 11.5, marginTop: 3 }}>{cliente.codigo || "—"}</div>
          </div>
        </Anotable>
      </div>
    </div>
  );
}

/**
 * La fila bajo la banda, como la pinta iOS: cada campo mide lo que su texto,
 * el primero a la izquierda y el último a la derecha (space-between). Un valor
 * largo encoge, pasa a dos líneas y acaba en "…" (lib/vistaWallet.js).
 */
function FilaApple({ campos, accent, anota, medir }) {
  if (!campos.length) return null;
  const total = ANCHO - A.margen * 2;
  const mide = (texto, tam, peso) => medir(texto, tam, peso, FUENTE_APPLE);
  const naturales = campos.map((f) => Math.ceil(Math.max(mide(f.label, A.etiqueta, 600) * 1.08, mide(f.value, A.valor))) + 1);
  const anchos = repartir(naturales, total, A.hueco);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: A.hueco, padding: `11px ${A.margen}px 0` }}>
      {campos.map((f, i) => {
        const ancho = anchos[i];
        const v = encajar(f.value, ancho, (x, tam) => mide(x, tam), { max: A.valor, min: A.valorMin });
        const derecha = campos.length > 1 && i === campos.length - 1;
        return (
          <Anotable key={f.key} clave={`apple.${f.key}`} etiqueta={f.label} anota={anota}
            estilo={{ width: ancho, flex: "0 0 auto", minWidth: 0, boxSizing: "content-box", textAlign: derecha ? "right" : "left" }}>
            <div style={{ ...etiquetaApple(accent), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</div>
            <div style={{ fontSize: v.tam, lineHeight: 1.18, marginTop: 1 }} title={v.cortado ? String(f.value) : undefined}>
              {v.lineas.map((l, j) => <div key={j} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
            </div>
          </Anotable>
        );
      })}
    </div>
  );
}

// El reverso de Apple: la hoja que sale con (i), en modo oscuro como en el
// iPhone. Una miniatura de la tarjeta, sus interruptores y los campos: el valor
// corto va a la derecha de la etiqueta; el largo, debajo.
function ReversoApple({ negocio, cliente, qrTexto, anota, medir, origen, estado, onHecho }) {
  const { backFields } = camposDelPase(cliente, negocio);
  const contactos = new Set(enlacesDeContacto(negocio.contacto).map((e) => e.id));
  const titulo = negocio.tipo === "descuento" ? `Cupón de ${negocio.nombre}` : `Tarjeta de fidelización de ${negocio.nombre}`;
  const filas = [...backFields, { key: "privacidad", label: "Privacidad", value: `${origen}/privacidad?b=${negocio.slug}`, fija: true }];
  const anchoFila = ANCHO + 24 - 2 * 14 - 2 * 14; // pantalla - márgenes del grupo - relleno de la fila

  return (
    <div style={{ ...pantalla, height: 600, overflowY: "auto", background: "#1c1c1e", color: "#fff", fontFamily: FUENTE_APPLE, ...tocable(anota) }} onClick={fondo(anota, "apple.fondo")}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 6px" }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onHecho(); }} style={{ background: "none", border: 0, color: "#0a84ff", fontSize: 15, padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
          Hecho
        </button>
        <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</strong>
      </div>

      {/* La miniatura es la tarjeta de delante, encogida: si cambia, cambia aquí. */}
      <div style={{ width: ANCHO * 0.26, height: 62, margin: "8px auto 0", overflow: "hidden", borderRadius: 4, pointerEvents: "none" }} aria-hidden>
        <div style={{ transform: "scale(0.26)", transformOrigin: "top left", width: ANCHO }}>
          <TarjetaApple negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={null} estado={estado} medir={medir} />
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "8px 16px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: "#8e8e93", marginTop: 2 }}>Actualizado hace un momento</div>
      </div>

      <div style={{ ...grupoApple, marginTop: 16 }}>
        {["Actualizaciones automáticas", "Permitir notificaciones", "Sugerir en pantalla bloqueada"].map((x, i) => (
          <div key={x} style={{ ...filaApple(i === 2), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14 }}>{x}</span><span style={interruptor} aria-hidden><span style={bolita} /></span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#8e8e93", margin: "6px 28px 0" }}>Mostrar según la hora o la ubicación.</div>

      <div style={{ ...grupoApple, margin: "18px 14px 20px" }}>
        {filas.map((f, i) => {
          const lineas = String(f.value).split("\n");
          const corto = lineas.every((l) => medir(l, 14, 400, FUENTE_APPLE) <= anchoFila * 0.62)
            && medir(f.label, 14, 400, FUENTE_APPLE) <= anchoFila * 0.36;
          const color = contactos.has(f.key) ? "#0a84ff" : "#8e8e93";
          const contenido = corto ? (
            <div style={{ ...filaApple(i === filas.length - 1), display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>{f.label}</span>
              <span style={{ fontSize: 14, color, textAlign: "right", whiteSpace: "pre-line" }}>{f.value}</span>
            </div>
          ) : (
            <div style={filaApple(i === filas.length - 1)}>
              <div style={{ fontSize: 14 }}>{f.label}</div>
              <div style={{ fontSize: 14, color, whiteSpace: "pre-line", wordBreak: "break-word", marginTop: 2 }}>{f.value}</div>
            </div>
          );
          return f.fija
            ? <div key={f.key}>{contenido}</div>
            : <Anotable key={f.key} clave={`apple.reverso.${f.key}`} etiqueta={f.label} anota={anota} estilo={{ margin: 0, padding: 0, borderRadius: 0 }}>{contenido}</Anotable>;
        })}
        {anota?.onCampo && !contactos.size && (
          <Anotable clave="apple.reverso.contacto" etiqueta="Teléfono, web e Instagram" anota={anota} estilo={{ margin: 0, padding: 0, borderRadius: 0 }}>
            <div style={{ ...filaApple(true), color: "#0a84ff", fontSize: 14 }}>+ Añadir teléfono, web o Instagram</div>
          </Anotable>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Google
// Lo que manda googlewallet.js: la clase (color, logo, nombre) y el objeto del
// cliente (puntos, código, banda, textos, mensajes, enlaces), pintados como los
// pinta la app de Google Wallet: una pantalla del color de la tienda que se
// desplaza. La banda es la misma imagen que la de Apple, en el hueco de abajo
// ("heroImage"), que es donde Google la pone siempre.
const OPCIONES_VISTA = { issuerId: "vista", appUrl: "" };

function PantallaGoogle({ negocio, cliente, qrTexto, anota }) {
  const clase = construirClase(negocio, OPCIONES_VISTA);
  const objeto = construirObjeto(cliente, negocio, OPCIONES_VISTA);
  const banda = stripDelPase(negocio, cliente);
  const color = clase.hexBackgroundColor;
  const tinta = textoSobre(color);
  const caja = tinta === "#fff" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)";
  const oscuro = mezclar(color, "#000000", 0.28);
  const mensajes = [...(clase.messages || []), ...(objeto.messages || [])];
  const textos = [...clase.textModulesData, ...objeto.textModulesData];
  const enlaces = [...(clase.linksModuleData?.uris || []), ...(objeto.linksModuleData?.uris || [])];
  const cerca = (clase.merchantLocations || []).length > 0;

  return (
    <div style={{ ...pantalla, height: 600, overflowY: "auto", background: oscuro, color: tinta, fontFamily: FUENTE_GOOGLE, ...tocable(anota) }} onClick={fondo(anota, "google.fondo")}>
      <div style={{ background: `linear-gradient(${color}, ${mezclar(color, "#000000", 0.14)})`, borderRadius: "0 0 26px 26px", padding: "22px 16px 18px", position: "relative", zIndex: 1, opacity: objeto.state === "INACTIVE" ? 0.6 : 1 }}>
        <Anotable clave="google.cabecera" etiqueta="Logo y nombre" anota={anota} estilo={{ textAlign: "center" }}>
          <LogoGoogle tema={negocio.tema} tam={66} style={{ margin: "0 auto" }} />
          <div style={{ fontSize: 11.5, marginTop: 10, opacity: 0.9 }}>{clase.issuerName}</div>
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.12, marginTop: 6, overflowWrap: "anywhere" }}>{clase.programName}</div>
        </Anotable>

        <Anotable clave="google.codigo" etiqueta="QR y código corto" anota={anota} estilo={{ width: "auto", margin: "16px auto 0", textAlign: "center" }}>
          <div style={{ background: "#fff", borderRadius: 9, padding: 13, display: "inline-block" }}>
            <QrImagen texto={qrTexto} lado={116} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{objeto.barcode.alternateText}</div>
        </Anotable>

        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 18 }}>
          <Anotable clave="google.puntos" etiqueta={objeto.loyaltyPoints.label} anota={anota} estilo={{ width: "auto", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, opacity: 0.9 }}>{objeto.loyaltyPoints.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{objeto.loyaltyPoints.balance.string}</div>
          </Anotable>
          {objeto.secondaryLoyaltyPoints && (
            <Anotable clave="google.canjeados" etiqueta={objeto.secondaryLoyaltyPoints.label} anota={anota} estilo={{ width: "auto", textAlign: "center" }}>
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>{objeto.secondaryLoyaltyPoints.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{objeto.secondaryLoyaltyPoints.balance.int}</div>
            </Anotable>
          )}
        </div>

        {cerca && (
          <div style={{ background: caja, borderRadius: 14, padding: "14px 16px", marginTop: 20, fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>
            Recibe una notificación cuando estés cerca de {negocio.nombre}
            <div style={{ fontSize: 12, marginTop: 8, fontWeight: 500 }}>Configurar notificaciones cercanas</div>
          </div>
        )}
      </div>

      {/* La banda, entre las dos curvas: Google la mete por detrás de las esquinas. */}
      <div style={{ margin: "-26px 0" }}>
        <Anotable clave="google.banda" etiqueta="Banda (los sellos)" anota={anota} estilo={{ padding: 0, margin: 0, borderRadius: 0 }}>
          <img src={comoDataUri(svgBandaOpaca(banda.svg, negocio.tema.cardBg))} alt={objeto.heroImage.contentDescription.defaultValue.value}
            style={{ display: "block", width: "100%", height: "auto", paddingTop: 26, paddingBottom: 26, background: negocio.tema.cardBg, boxSizing: "content-box" }} />
        </Anotable>
      </div>

      <div style={{ background: oscuro, borderRadius: "26px 26px 0 0", padding: "16px 14px 18px", position: "relative", zIndex: 1, display: "grid", gap: 3 }}>
        <Anotable clave="google.titular" etiqueta="Titular y código" anota={anota} estilo={{ display: "grid", gap: 3 }}>
          {objeto.accountName && <Modulo caja={caja} titulo={clase.accountNameLabel} cuerpo={objeto.accountName} primero />}
          <Modulo caja={caja} titulo={clase.accountIdLabel} cuerpo={objeto.accountId} primero={!objeto.accountName} />
        </Anotable>
        {mensajes.map((m) => (
          <Anotable key={m.id} clave={`google.mensaje.${m.id}`} etiqueta={m.header} anota={anota}>
            <Modulo caja={caja} titulo={`Mensaje: ${m.header}`} cuerpo={m.body} nuevo />
          </Anotable>
        ))}
        {textos.map((x, i) => (
          <Anotable key={x.id} clave={`google.${x.id}`} etiqueta={x.header} anota={anota}>
            <Modulo caja={caja} titulo={x.header} cuerpo={x.body} ultimo={i === textos.length - 1} />
          </Anotable>
        ))}

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {enlaces.map((u) => (
            <Anotable key={u.id} clave={`google.enlace.${u.id}`} etiqueta={u.description} anota={anota}>
              <Boton caja={caja} icono={u.id}>{u.description}</Boton>
            </Anotable>
          ))}
          {anota?.onCampo && !clase.linksModuleData && (
            <Anotable clave="google.enlace.contacto" etiqueta="Teléfono, web e Instagram" anota={anota}>
              <Boton caja={caja} icono="mas">Añadir teléfono, web o Instagram</Boton>
            </Anotable>
          )}
          <div style={{ height: 4 }} />
          <Boton caja={caja} icono="ajustes">Ajustes</Boton>
          <div style={{ display: "grid", gap: 3 }}>
            <Boton caja={caja} icono="archivar" arriba>Archivar</Boton>
            <Boton caja={caja} icono="quitar" abajo>Quitar</Boton>
          </div>
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.35, margin: "14px 4px 0", opacity: 0.9 }}>
          El proveedor del pase o el comercio donde lo has adquirido son responsables de la información de ese pase y
          pueden enviarte notificaciones.
        </p>
      </div>
    </div>
  );
}

/** Una tarjetita de los detalles de Google. Van pegadas: solo la primera y la última, redondas. */
function Modulo({ caja, titulo, cuerpo, nuevo = false, primero = false, ultimo = false }) {
  return (
    <div style={{ background: caja, padding: "13px 16px", borderRadius: `${primero ? 18 : 4}px ${primero ? 18 : 4}px ${ultimo ? 18 : 4}px ${ultimo ? 18 : 4}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{titulo}</div>
        {nuevo && <span style={{ fontSize: 11, fontWeight: 700, background: "#c4eed0", color: "#0d652d", borderRadius: 999, padding: "2px 9px" }}>Nuevo</span>}
      </div>
      <div style={{ fontSize: 13, marginTop: 3, whiteSpace: "pre-line", lineHeight: 1.35 }}>{cuerpo}</div>
    </div>
  );
}

function Boton({ caja, icono, children, arriba = false, abajo = false }) {
  const r = arriba ? "18px 18px 4px 4px" : abajo ? "4px 4px 18px 18px" : "18px";
  return (
    <div style={{ background: caja, borderRadius: r, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, fontSize: 13.5, fontWeight: 700 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
        {ICONOS_GOOGLE[icono] || ICONOS_GOOGLE.tarjeta}
      </svg>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

const ICONOS_GOOGLE = {
  tarjeta: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
  telefono: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  archivar: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M12 12v5M9.5 14.5L12 17l2.5-2.5" /></>,
  quitar: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  mas: <path d="M12 5v14M5 12h14" />,
};

// Google elige solo el color del texto según el fondo; aquí, la misma idea.
function textoSobre(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return "#fff";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#202124" : "#fff";
}

/** Mezcla dos #rrggbb: Google oscurece el color de la tienda hacia abajo. */
function mezclar(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a)) return a;
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------- estilos
const pantalla = {
  width: ANCHO + 24, margin: "0 auto", borderRadius: 22, overflow: "hidden",
  boxSizing: "border-box", border: "1px solid #2a2a2e", boxShadow: "0 10px 30px rgba(16,20,28,.18)",
};

const etiquetaApple = (color) => ({ fontSize: A.etiqueta, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color, lineHeight: 1.3 });

const sobreLaBanda = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 14px" };

const grupoApple = { background: "#2c2c2e", borderRadius: 11, margin: "0 14px", overflow: "hidden" };
const filaApple = (ultima) => ({ padding: "10px 14px", borderBottom: ultima ? "none" : "1px solid #3a3a3c" });
const interruptor = { width: 38, height: 23, borderRadius: 12, background: "#34c759", flexShrink: 0, position: "relative" };
const bolita = { position: "absolute", right: 2, top: 2, width: 19, height: 19, borderRadius: "50%", background: "#fff" };

const botonInfo = {
  width: 26, height: 26, borderRadius: "50%", border: `1.6px solid ${C.suave}`, background: "#fff", color: C.suave,
  fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 14, lineHeight: 1, cursor: "pointer",
};

const puntoNota = {
  position: "absolute", top: -4, right: -4, width: 9, height: 9,
  borderRadius: "50%", background: "#16a34a", border: "2px solid #fff",
};

const conmutador = {
  display: "flex", gap: 4, padding: 4, background: C.fondo, border: `1px solid ${C.borde}`,
  borderRadius: 10, margin: "0 auto 14px", maxWidth: 320,
};

const opcion = (activo) => ({
  flex: 1, padding: "0.45rem 0.5rem", borderRadius: 7, border: 0,
  background: activo ? "#fff" : "transparent", color: activo ? C.texto : C.suave,
  fontSize: 13, fontWeight: activo ? 600 : 500, cursor: "pointer",
  boxShadow: activo ? "0 1px 3px rgba(16,20,28,.16)" : "none",
});
