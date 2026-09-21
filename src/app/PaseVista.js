"use client";

import { useState } from "react";
import QrImagen from "@/app/QrImagen";
import { camposDelPase } from "@/lib/apple/pase";
import { svgLogo, svgLogoGoogle, svgBandaOpaca, stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { construirClase, construirObjeto } from "@/lib/google/pase";
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
export default function PaseVista({ negocio, cliente, qrTexto, pie = null, notas = {}, onCampo = null, campoActivo = null }) {
  const [cual, setCual] = useState("apple");
  const anota = { notas, onCampo, campoActivo };

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

      {cual === "apple"
        ? <TarjetaApple negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={anota} />
        : <TarjetaGoogle negocio={negocio} cliente={cliente} qrTexto={qrTexto} anota={anota} />}

      <p style={{ fontSize: 12, color: C.tenue, margin: "10px 0 0", textAlign: "center" }}>
        {pie || "Parecido, no idéntico: la banda y el logo son los del pase real; la tipografía la pone iOS."}
      </p>
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
      title={tiene ? notas[clave] : `Comentar "${etiqueta}"`}
      style={{
        ...estilo,
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
        border: `1px dashed ${activo ? "#2563eb" : tiene ? "#16a34a" : "rgba(127,127,127,.45)"}`,
        background: activo ? "rgba(37,99,235,.10)" : tiene ? "rgba(22,163,74,.08)" : "transparent",
      }}
    >
      {children}
      {tiene && <span style={puntoNota} aria-label="tiene comentario" />}
    </button>
  );
}

const puntoNota = {
  position: "absolute", top: -4, right: -4, width: 9, height: 9,
  borderRadius: "50%", background: "#16a34a", border: "2px solid #fff",
};

// ---------------------------------------------------------------- Apple
// Orden real de un pase: cabecera (logo + nombre | headerFields), banda a
// sangre, secundarios, auxiliares y el código abajo. En los cupones los
// primaryFields van ENCIMA de la banda (por eso su dibujo deja hueco a la
// izquierda); en las cartillas no hay primarios y la banda se ve entera.
function TarjetaApple({ negocio, cliente, qrTexto, anota }) {
  const t = negocio.tema;
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields, backFields } =
    camposDelPase(cliente, negocio);
  const strip = stripDelPase(negocio, cliente);

  return (
    <div style={{ ...marco, background: t.cardBg, color: t.ink, overflow: "hidden" }}>
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

      <div style={{ margin: "0 12px 12px", paddingTop: 10, borderTop: `1px solid ${t.accent}33`, opacity: 0.75 }}>
        <div style={{ ...etiquetaPase(t.accent), marginBottom: 4 }}>Reverso</div>
        {backFields.map((f) => (
          <Anotable key={f.key} clave={`apple.reverso.${f.key}`} etiqueta={`Reverso · ${f.label}`} anota={anota} estilo={{ marginTop: 2 }}>
            <div style={{ fontSize: 11 }}>
              <span style={{ opacity: 0.7 }}>{f.label}: </span>{f.value}
            </div>
          </Anotable>
        ))}
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
  const mensajes = [...(clase.messages || []), ...(objeto.messages || [])];
  const fondo = clase.hexBackgroundColor;
  const tinta = textoSobre(fondo);

  return (
    <div style={{ ...marco, overflow: "hidden", fontFamily: "Roboto, system-ui, sans-serif" }}>
      <div style={{ background: fondo, color: tinta, opacity: objeto.state === "INACTIVE" ? 0.55 : 1 }}>
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

      <div style={{ background: "#fff", color: "#202124", padding: "12px 16px 14px", display: "grid", gap: 10 }}>
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
            <div style={{ fontSize: 14 }}>{t.body}</div>
          </Anotable>
        ))}
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
