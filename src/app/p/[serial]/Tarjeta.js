"use client";

import QrImagen from "@/app/QrImagen";
import Icono from "@/app/Icono";
import { camposDelPase } from "@/lib/apple/pase";
import { svgLogo, stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { estadoDe } from "@/lib/resumen";
import { describirBanda } from "@/lib/cartillas";
import { useTarjetaEnVivo } from "./telefono";
import Acciones from "./Acciones";

// ============================================================================
// LA TARJETA WEB
// ----------------------------------------------------------------------------
// Misma regla que la vista previa del manager: nada inventado. Los campos salen
// de camposDelPase() y el dibujo de stripDelPase() y svgLogo(), los mismos que
// arman el .pkpass. Así la tarjeta de un Android y el pase de un iPhone dicen
// lo mismo y se ven de la misma familia, y un tema nuevo sale solo en las dos.
//
// La disposición es la del pase de Apple (cabecera, banda a sangre, campos y
// código), con la tipografía del sistema y un QR grande: esto se enseña en caja.
// ============================================================================

const TITULOS = { sello: "Sello añadido", completa: "Cartilla completa", canje: "Premio canjeado" };

export default function Tarjeta({ serial, inicial, qrTexto, plataforma, appleUrl, googleUrl, clavePush, demo }) {
  const { datos, novedad, cerrarNovedad } = useTarjetaEnVivo(serial, inicial);
  const { cliente, negocio } = datos;
  const t = negocio.tema;
  const e = estadoDe(cliente, negocio);
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = camposDelPase(cliente, negocio);
  const banda = stripDelPase(negocio, cliente);
  const campos = [...secondaryFields, ...auxiliaryFields];

  return (
    <main style={{ ...pagina, background: t.pageBg, color: t.pageInk }}>
      <style>{css}</style>

      {novedad && (
        <div role="status" className="novedad" key={novedad.id} style={{ background: t.accent }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 15 }}>
              {e.esCupon && novedad.tipo === "canje" ? "Cupón usado" : TITULOS[novedad.tipo] || negocio.nombre}
            </strong>
            <span style={{ fontSize: 14, opacity: 0.92 }}>{novedad.cuerpo}</span>
          </div>
          <button type="button" onClick={cerrarNovedad} aria-label="Cerrar" style={cerrar}>
            <Icono nombre="cerrar" tam={18} />
          </button>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 400 }}>
        <article className="tarjeta" style={{ background: t.cardBg, color: t.ink }} aria-label={`Tarjeta de ${negocio.nombre}`}>
          <header style={cabecera}>
            <img src={comoDataUri(svgLogo(t))} alt="" width={30} height={30} style={{ display: "block", flexShrink: 0 }} />
            <strong style={nombreTienda}>{negocio.nombre}</strong>
            {headerFields.map((f) => (
              <div key={f.key} style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={etiqueta(t.accent)}>{f.label}</div>
                <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.15 }}>{f.value}</div>
              </div>
            ))}
          </header>

          <div style={{ position: "relative" }}>
            {/* key: cada sello nuevo vuelve a montar la banda y la animación se ve */}
            <img
              key={`${cliente.sellos}-${cliente.sellos2}-${cliente.premios}`}
              className={novedad ? "banda nueva" : "banda"}
              src={comoDataUri(banda.svg)}
              alt={e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, negocio)}
              style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${banda.ancho} / ${banda.alto}` }}
            />
            {primaryFields.length > 0 && (
              <div style={sobreLaBanda}>
                <div style={{ ...etiqueta("#fff"), opacity: 0.9 }}>{primaryFields[0].label}</div>
                <div style={descuento}>{primaryFields[0].value}</div>
              </div>
            )}
          </div>

          {campos.length > 0 && (
            <div style={{ display: "flex", gap: 16, padding: "14px 18px 0" }}>
              {campos.map((f) => (
                <div key={f.key} style={{ flex: 1, minWidth: 0 }}>
                  <div style={etiqueta(t.accent)}>{f.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2, overflowWrap: "anywhere" }}>{f.value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", placeItems: "center", padding: "20px 18px 22px" }}>
            <div style={cajaQr}>
              <QrImagen texto={qrTexto} lado={196} />
            </div>
            <div style={{ ...codigo, color: t.ink }} aria-label={`Código ${cliente.codigo.split("").join(" ")}`}>{cliente.codigo}</div>
          </div>

          {e.usado && <div className="sello-usado" aria-hidden>Usado</div>}
        </article>

        <p style={{ fontSize: 13, textAlign: "center", margin: "14px 8px 0", opacity: 0.8, lineHeight: 1.45 }}>
          Enseña el QR en caja. Si no se deja leer, di tu código: <strong style={{ letterSpacing: 1 }}>{cliente.codigo}</strong>
        </p>

        <Acciones
          serial={serial}
          negocio={negocio}
          plataforma={plataforma}
          appleUrl={appleUrl}
          googleUrl={googleUrl}
          clavePush={clavePush}
        />

        {demo && (
          <p style={{ textAlign: "center", fontSize: 13, marginTop: 18 }}>
            <a href={`/w/${serial}`} style={{ color: "inherit", fontWeight: 600 }}>Abrir la vista de caja (modo demo)</a>
          </p>
        )}
      </div>
    </main>
  );
}

const pagina = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "max(22px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom))",
};

const cabecera = { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px" };
const nombreTienda = { flex: 1, minWidth: 0, fontSize: 16, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const etiqueta = (color) => ({
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color,
});

const sobreLaBanda = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "0 18px",
  maxWidth: "64%",
};

const descuento = { fontSize: 26, fontWeight: 750, color: "#fff", lineHeight: 1.1, textShadow: "0 1px 3px rgba(0,0,0,.3)" };

const cajaQr = { background: "#fff", padding: 12, borderRadius: 14, boxShadow: "0 0 0 1px rgba(0,0,0,.06)" };

const codigo = {
  marginTop: 10,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 6,
  paddingLeft: 6, // compensa el espaciado de la última letra
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const cerrar = {
  border: 0,
  background: "rgba(255,255,255,.18)",
  color: "inherit",
  width: 32,
  height: 32,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const css = `
.tarjeta{position:relative;border-radius:22px;overflow:hidden;
  box-shadow:0 22px 44px -18px rgba(0,0,0,.45),0 4px 14px rgba(0,0,0,.1),inset 0 0 0 1px rgba(255,255,255,.06)}
.banda.nueva{animation:banda .7s cubic-bezier(.2,.9,.3,1.3)}
@keyframes banda{0%{transform:scale(.96);filter:brightness(1.25)}100%{transform:none;filter:none}}
.novedad{position:fixed;z-index:10;top:max(12px,env(safe-area-inset-top));left:12px;right:12px;margin:0 auto;max-width:420px;
  display:flex;align-items:center;gap:12px;padding:12px 12px 12px 16px;border-radius:16px;color:#fff;
  box-shadow:0 12px 30px -8px rgba(0,0,0,.45);animation:baja .35s ease-out}
@keyframes baja{from{transform:translateY(-120%);opacity:0}to{transform:none;opacity:1}}
.sello-usado{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-12deg);
  padding:6px 22px;border:3px solid currentColor;border-radius:10px;font-size:28px;font-weight:800;
  letter-spacing:4px;text-transform:uppercase;opacity:.55;pointer-events:none}
@media (prefers-reduced-motion: reduce){.banda.nueva,.novedad{animation:none}}
`;
