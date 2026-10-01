"use client";

import { useState } from "react";
import QrImagen from "@/app/QrImagen";
import { camposDelPase } from "@/lib/apple/pase";
import { svgLogo, svgLogoGoogle, svgBandaOpaca, stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { construirClase, construirObjeto } from "@/lib/google/pase";
import { enlacesDeContacto } from "@/lib/contacto";
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
// Lo que no se puede copiar es la tipografía de iOS y su espaciado exacto, así
// que la disposición es la de Apple (cabecera, banda a sangre, secundarios,
// auxiliares y código) pero con tipos del sistema.
// ============================================================================

/**
 * @param {object} props
 * @param {object} [props.notas]       { "apple.premio": "esto debería ser X" }
 * @param {Function} [props.onCampo]   (clave, etiqueta) => void. Si viene, cada
 *                                     campo se puede tocar para comentarlo.
 * @param {string} [props.campoActivo] clave del campo que se está comentando
 */
// `estado`: la línea "● Abierto hasta las 14:00" en lo alto de la banda, cuando el
// pase de verdad la lleva (estadoParaPase, solo con el reloj en marcha). Lo
// decide quien la usa.
// `cara`/`onCara`: si quien la usa quiere mandar en qué lado se ve; si no, lo
// lleva ella sola.
export default function PaseVista({ negocio, cliente, qrTexto, pie = null, notas = {}, onCampo = null, campoActivo = null, estado = null, cara: caraFuera, onCara }) {
  const [cual, setCual] = useState("apple");
  const [caraDentro, setCaraDentro] = useState("delante");
  const cara = caraFuera || caraDentro;
  const setCara = onCara || setCaraDentro;
  const anota = { notas, onCampo, campoActivo };
  const detras = cara === "detras";

  return (
    <div>
      <div style={conmutador}>
        {[
          ["apple", " Apple Wallet"],
          ["google", "Google Wallet"],
        ].map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCual(id)}
            aria-pressed={cual === id}
            style={opcion(cual === id)}
          >
            {texto}
          </button>
        ))}
      </div>

      {/* Delante y detrás: en Apple se le da la vuelta con (i); en Google, los
          detalles salen al tocar la tarjeta. Los dos se pueden ver y editar. */}
      <div style={{ ...conmutador, maxWidth: 220, padding: 3, margin: "-6px auto 14px" }}>
        {[["delante", "Delante"], ["detras", cual === "apple" ? "Detrás" : "Detalles"]].map(([id, texto]) => (
          <button key={id} type="button" onClick={() => setCara(id)} aria-pressed={cara === id} style={{ ...opcion(cara === id), fontSize: 12, padding: "0.3rem 0.5rem" }}>
            {texto}
          </button>
        ))}
      </div>

      {cual === "apple"
        ? (detras ? <ReversoApple negocio={negocio} cliente={cliente} anota={anota} /> : <TarjetaApple negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={anota} estado={estado} />)
        : (detras ? <DetallesGoogle negocio={negocio} cliente={cliente} anota={anota} /> : <TarjetaGoogle negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={anota} />)}

      {pie && <p style={{ fontSize: 12, color: C.tenue, margin: "10px 0 0", textAlign: "center" }}>{pie}</p>}
    </div>
  );
}

/**
 * Envuelve un trozo del pase. Fuera del modo comentarios no pinta nada (un
 * div normal); dentro, se vuelve un botón con marco de puntos y un punto de
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
      // y la banda va sin margen; antes lo pisaba el 100 % y el logo se comía la fila.
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        padding: 2,
        margin: -2,
        borderRadius: 6,
        ...estilo,
        border: `1px dashed ${activo ? "#2563eb" : tiene ? "#16a34a" : "rgba(127,127,127,.45)"}`,
        background: activo ? "rgba(37,99,235,.10)" : tiene ? "rgba(22,163,74,.08)" : "transparent",
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

const puntoNota = {
  position: "absolute", top: -4, right: -4, width: 9, height: 9,
  borderRadius: "50%", background: "#16a34a", border: "2px solid #fff",
};

// ---------------------------------------------------------------- Apple
// Orden real de un pase: cabecera (logo + nombre | headerFields), banda a
// sangre, secundarios, auxiliares y el código abajo. En los cupones los
// primaryFields van ENCIMA de la banda (por eso su dibujo deja hueco a la
// izquierda); en las cartillas no hay primarios y la banda se ve entera.
function TarjetaApple({ negocio, cliente, qrTexto, anota, estado }) {
  const t = negocio.tema;
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = camposDelPase(cliente, negocio);
  const strip = stripDelPase(negocio, cliente, { estado });

  return (
    <div style={{ ...marco, background: t.cardBg, color: t.ink, overflow: "hidden", ...tocable(anota) }} onClick={fondo(anota, "apple.fondo")}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <Anotable clave="apple.logo" etiqueta="Logo" anota={anota} estilo={{ width: "auto", flexShrink: 0 }}>
          <img src={comoDataUri(svgLogo(t))} alt="" width={26} height={26} style={{ display: "block" }} />
        </Anotable>
        <Anotable clave="apple.nombre" etiqueta="Nombre del negocio" anota={anota} estilo={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 13, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {negocio.nombre}
          </strong>
        </Anotable>
        {headerFields.map((f) => (
          <Anotable key={f.key} clave={`apple.${f.key}`} etiqueta={f.label} anota={anota} estilo={{ width: "auto", textAlign: "right", minWidth: 0 }}>
            <div style={etiquetaPase(t.accent)}>{f.label}</div>
            <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</div>
          </Anotable>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <Anotable clave="apple.banda" etiqueta="Banda (los sellos)" anota={anota} estilo={{ padding: 0, margin: 0, borderRadius: 0 }}>
          <img
            src={comoDataUri(strip.svg)}
            alt={`Banda del pase, ${strip.ancho}×${strip.alto} puntos`}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </Anotable>
        {primaryFields.length > 0 && (
          <div style={sobreLaBanda}>
            <Anotable clave={`apple.${primaryFields[0].key}`} etiqueta={primaryFields[0].label} anota={anota} estilo={{ width: "auto", maxWidth: "62%" }}>
              <div style={{ ...etiquetaPase("#ffffff"), opacity: 0.9 }}>{primaryFields[0].label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.1, textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
                {primaryFields[0].value}
              </div>
            </Anotable>
          </div>
        )}
      </div>

      {/* Secundarios y auxiliares van en UNA fila, como los pinta iOS cuando el
          pase lleva banda. Si algún día vuelven a ser cuatro, aquí se verá
          igual de apretado que en el teléfono: esa es la gracia. */}
      <div style={{ padding: "12px 12px 0" }}>
        <Fila campos={[...secondaryFields, ...auxiliaryFields]} accent={t.accent} anota={anota} />
      </div>

      <div style={{ display: "grid", placeItems: "center", padding: "16px 12px 14px" }}>
        <Anotable clave="apple.codigo" etiqueta="QR y código corto" anota={anota} estilo={{ width: "auto" }}>
          <div style={{ background: "#fff", padding: 8, borderRadius: 6 }}>
            <QrImagen texto={qrTexto} lado={104} />
          </div>
          <div style={{ fontSize: 12, letterSpacing: 2, marginTop: 6, textAlign: "center", fontFamily: "ui-monospace, Menlo, monospace" }}>
            {cliente.codigo || "—"}
          </div>
        </Anotable>
      </div>

    </div>
  );
}

// El reverso de Apple: la hoja que sale con (i). Fondo del sistema, no el de la
// tarjeta, y cada campo como una fila de Ajustes: etiqueta pequeña y valor.
function ReversoApple({ negocio, cliente, anota }) {
  const t = negocio.tema;
  const { backFields } = camposDelPase(cliente, negocio);
  const contactos = new Set(enlacesDeContacto(negocio.contacto).map((e) => e.id));
  return (
    <div style={{ ...marco, background: "#f2f2f7", color: "#1c1c1e", overflow: "hidden", fontFamily: "-apple-system, system-ui, sans-serif", ...tocable(anota) }} onClick={fondo(anota, "apple.fondo")}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px" }}>
        <img src={comoDataUri(svgLogo(t))} alt="" width={30} height={30} style={{ display: "block", borderRadius: 7, background: t.cardBg }} />
        <strong style={{ fontSize: 15 }}>{negocio.nombre}</strong>
      </div>
      <div style={hojaApple}>
        {["Actualizaciones automáticas", "Sugerir en la pantalla bloqueada"].map((x) => (
          <div key={x} style={{ ...filaApple, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14 }}>{x}</span><span style={interruptor} aria-hidden />
          </div>
        ))}
      </div>
      <div style={{ ...hojaApple, marginBottom: 14 }}>
        {backFields.map((f) => (
          <Anotable key={f.key} clave={`apple.reverso.${f.key}`} etiqueta={f.label} anota={anota} estilo={{ margin: 0 }}>
            <div style={filaApple}>
              <div style={{ fontSize: 12, color: "#8e8e93" }}>{f.label}</div>
              <div style={{ fontSize: 14, whiteSpace: "pre-line", color: contactos.has(f.key) ? "#007aff" : "inherit" }}>{f.value}</div>
            </div>
          </Anotable>
        ))}
        {anota?.onCampo && !contactos.size && (
          <Anotable clave="apple.reverso.contacto" etiqueta="Teléfono, web e Instagram" anota={anota} estilo={{ margin: 0 }}>
            <div style={{ ...filaApple, color: "#007aff", fontSize: 14 }}>+ Añadir teléfono, web o Instagram</div>
          </Anotable>
        )}
        <div style={filaApple}>
          <div style={{ fontSize: 12, color: "#8e8e93" }}>Privacidad</div>
          <div style={{ fontSize: 14, color: "#007aff" }}>Qué guardamos y para qué</div>
        </div>
      </div>
    </div>
  );
}

function Fila({ campos, accent, margen = 0, anota }) {
  if (!campos.length) return null;
  return (
    <div style={{ display: "flex", gap: 14, marginTop: margen }}>
      {campos.map((f) => (
        <Anotable key={f.key} clave={`apple.${f.key}`} etiqueta={f.label} anota={anota} estilo={{ flex: 1, minWidth: 0 }}>
          <div style={etiquetaPase(accent)}>{f.label}</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 1 }}>{f.value}</div>
        </Anotable>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Google
// Lo que manda googlewallet.js: la clase (color, logo, nombre) y el objeto del
// cliente (puntos, código, banda, texto del premio, mensajes). Se pinta a partir
// de construirClase() y construirObjeto(), los mismos que viajan a Google, y la
// banda es la misma imagen que la de Apple en el formato ancho de Google.
const OPCIONES_VISTA = { issuerId: "vista", appUrl: "" };

function TarjetaGoogle({ negocio, cliente, qrTexto, anota }) {
  const clase = construirClase(negocio, OPCIONES_VISTA);
  const objeto = construirObjeto(cliente, negocio, OPCIONES_VISTA);
  const banda = stripDelPase(negocio, cliente);
  const fondoClase = clase.hexBackgroundColor;
  const tinta = textoSobre(fondoClase);

  return (
    <div style={{ ...marco, overflow: "hidden", fontFamily: "Roboto, system-ui, sans-serif", ...tocable(anota) }} onClick={fondo(anota, "google.fondo")}>
      <div style={{ background: fondoClase, color: tinta, opacity: objeto.state === "INACTIVE" ? 0.55 : 1 }}>
        <Anotable clave="google.cabecera" etiqueta="Logo y nombre" anota={anota} estilo={{ padding: "14px 16px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={comoDataUri(svgLogoGoogle(negocio.tema, 96))} alt="" width={32} height={32} style={{ borderRadius: "50%", display: "block" }} />
            <strong style={{ fontSize: 15, fontWeight: 500 }}>{clase.programName}</strong>
          </div>
        </Anotable>

        <div style={{ display: "flex", gap: 16, padding: "10px 16px 4px" }}>
          <Anotable clave="google.puntos" etiqueta={objeto.loyaltyPoints.label} anota={anota} estilo={{ flex: 1 }}>
            <div style={etiquetaGoogle(tinta)}>{objeto.loyaltyPoints.label}</div>
            <div style={{ fontSize: 24, lineHeight: 1.2 }}>{objeto.loyaltyPoints.balance.string}</div>
          </Anotable>
          {objeto.secondaryLoyaltyPoints && (
            <div style={{ flex: 1 }}>
              <div style={etiquetaGoogle(tinta)}>{objeto.secondaryLoyaltyPoints.label}</div>
              <div style={{ fontSize: 24, lineHeight: 1.2 }}>{objeto.secondaryLoyaltyPoints.balance.int}</div>
            </div>
          )}
        </div>

        <Anotable clave="google.titular" etiqueta="Titular y código" anota={anota} estilo={{ padding: "6px 16px 10px" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {objeto.accountName && (
              <div style={{ flex: 1 }}>
                <div style={etiquetaGoogle(tinta)}>{clase.accountNameLabel}</div>
                <div style={{ fontSize: 15 }}>{objeto.accountName}</div>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={etiquetaGoogle(tinta)}>{clase.accountIdLabel}</div>
              <div style={{ fontSize: 15, letterSpacing: 1 }}>{objeto.accountId}</div>
            </div>
          </div>
        </Anotable>

        <Anotable clave="google.codigo" etiqueta="QR y código corto" anota={anota} estilo={{ display: "grid", placeItems: "center", padding: "6px 16px 14px" }}>
          <div style={{ background: "#fff", padding: 8, borderRadius: 10 }}>
            <QrImagen texto={qrTexto} lado={104} />
            <div style={{ fontSize: 12, letterSpacing: 2, marginTop: 4, textAlign: "center", color: "#3c4043" }}>{objeto.barcode.alternateText}</div>
          </div>
        </Anotable>

        <Anotable clave="google.banda" etiqueta="Banda (los sellos)" anota={anota} estilo={{ padding: 0, margin: 0, borderRadius: 0 }}>
          <img src={comoDataUri(svgBandaOpaca(banda.svg, negocio.tema.cardBg))} alt={objeto.heroImage.contentDescription.defaultValue.value} style={{ display: "block", width: "100%", height: "auto" }} />
        </Anotable>
      </div>

    </div>
  );
}

// Lo que Google enseña al tocar la tarjeta: los mensajes, los textos (premio,
// cómo funciona) y los enlaces. Todo sale de construirClase/construirObjeto.
function DetallesGoogle({ negocio, cliente, anota }) {
  const clase = construirClase(negocio, OPCIONES_VISTA);
  const objeto = construirObjeto(cliente, negocio, OPCIONES_VISTA);
  const mensajes = [...(clase.messages || []), ...(objeto.messages || [])];
  const enlaces = [...(clase.linksModuleData?.uris || []), ...(objeto.linksModuleData?.uris || [])];
  return (
    <div style={{ ...marco, background: "#fff", color: "#202124", fontFamily: "Roboto, system-ui, sans-serif", overflow: "hidden", ...tocable(anota) }} onClick={fondo(anota, "google.fondo")}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: clase.hexBackgroundColor, color: textoSobre(clase.hexBackgroundColor) }}>
        <img src={comoDataUri(svgLogoGoogle(negocio.tema, 96))} alt="" width={28} height={28} style={{ borderRadius: "50%", display: "block" }} />
        <strong style={{ fontSize: 15, fontWeight: 500 }}>{clase.programName}</strong>
      </div>
      <div style={{ padding: "12px 16px 16px", display: "grid", gap: 12 }}>
        {mensajes.map((m) => (
          <Anotable key={m.id} clave={`google.mensaje.${m.id}`} etiqueta={m.header} anota={anota}>
            <div style={{ padding: "8px 10px", background: "#f1f3f4", borderRadius: 8 }}>
              <div style={etiquetaGoogle("#5f6368")}>{m.header}</div>
              <div style={{ fontSize: 14 }}>{m.body}</div>
            </div>
          </Anotable>
        ))}
        {[...objeto.textModulesData, ...clase.textModulesData].map((t) => (
          <Anotable key={t.id} clave={`google.${t.id}`} etiqueta={t.header} anota={anota}>
            <div style={etiquetaGoogle("#5f6368")}>{t.header}</div>
            <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>{t.body}</div>
          </Anotable>
        ))}
        <div style={{ borderTop: "1px solid #e8eaed", paddingTop: 4 }}>
          {enlaces.map((u) => (
            <Anotable key={u.id} clave={`google.enlace.${u.id}`} etiqueta={u.description} anota={anota}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 14, color: "#1a73e8" }}>
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: "50%", background: "#e8f0fe", flexShrink: 0 }} />
                {u.description}
              </div>
            </Anotable>
          ))}
          {anota?.onCampo && !clase.linksModuleData && (
            <Anotable clave="google.enlace.contacto" etiqueta="Teléfono, web e Instagram" anota={anota}>
              <div style={{ padding: "8px 0", fontSize: 14, color: "#1a73e8" }}>+ Añadir teléfono, web o Instagram</div>
            </Anotable>
          )}
        </div>
      </div>
    </div>
  );
}

// Google elige solo el color del texto según el fondo; aquí, la misma idea.
function textoSobre(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return "#fff";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#202124" : "#fff";
}

const marco = {
  width: "100%",
  maxWidth: 320,
  margin: "0 auto",
  borderRadius: 16,
  border: `1px solid ${C.borde}`,
  boxShadow: "0 8px 24px rgba(16,20,28,.12)",
};

const sobreLaBanda = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "0 14px",
};

const etiquetaPase = (accent) => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: accent,
});

const hojaApple = { background: "#fff", borderRadius: 10, margin: "0 12px 12px", overflow: "hidden" };
const filaApple = { padding: "9px 12px", borderBottom: "1px solid #e5e5ea" };
const interruptor = { width: 34, height: 20, borderRadius: 10, background: "#34c759", flexShrink: 0 };

const etiquetaGoogle = (color) => ({ fontSize: 11, letterSpacing: 0.4, color, opacity: 0.85 });

const conmutador = {
  display: "flex",
  gap: 4,
  padding: 4,
  background: C.fondo,
  border: `1px solid ${C.borde}`,
  borderRadius: 10,
  margin: "0 auto 14px",
  maxWidth: 320,
};

const opcion = (activo) => ({
  flex: 1,
  padding: "0.45rem 0.5rem",
  borderRadius: 7,
  border: 0,
  background: activo ? "#fff" : "transparent",
  color: activo ? C.texto : C.suave,
  fontSize: 13,
  fontWeight: activo ? 600 : 500,
  cursor: "pointer",
  boxShadow: activo ? "0 1px 3px rgba(16,20,28,.16)" : "none",
});
