"use client";

import QrImagen from "@/app/QrImagen";
import Icono from "@/app/Icono";
import CaraDelPase from "@/app/CaraDelPase";
import { estadoDe } from "@/lib/resumen";
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

const TITULOS = { sello: "Sello añadido", completa: "Cartilla completa", canje: "Premio canjeado", guardado: "Premio guardado" };

export default function Tarjeta({ serial, inicial, qrTexto, plataforma, appleUrl, googleUrl, clavePush, demo }) {
  const { datos, novedad, cerrarNovedad } = useTarjetaEnVivo(serial, inicial);
  const { cliente, negocio } = datos;
  const t = negocio.tema;
  const e = estadoDe(cliente, negocio);

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
        <CaraDelPase cliente={cliente} negocio={negocio} horario={negocio.horario} claseBanda={novedad ? "banda nueva" : "banda"}>
          <div style={{ display: "grid", placeItems: "center", padding: "20px 18px 22px" }}>
            <div style={cajaQr}>
              <QrImagen texto={qrTexto} lado={196} />
            </div>
            <div style={{ ...codigo, color: t.ink }} aria-label={`Código ${cliente.codigo.split("").join(" ")}`}>{cliente.codigo}</div>
          </div>

          {e.usado && <div className="sello-usado" aria-hidden>Usado</div>}
        </CaraDelPase>

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
        <p style={{ textAlign: "center", fontSize: 12, marginTop: 18, opacity: 0.7 }}>
          <a href={`/privacidad?b=${negocio.slug}`} style={{ color: "inherit" }}>Privacidad</a>
        </p>
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
