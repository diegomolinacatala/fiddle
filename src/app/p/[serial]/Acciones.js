"use client";

import Icono from "@/app/Icono";
import { BotonAppleWallet, BotonGoogleWallet } from "@/app/BotonesWallet";
import { useAvisos } from "./telefono";
import { useInstalar } from "@/app/instalable";

// ============================================================================
// QUÉ PUEDE HACER EL CLIENTE CON SU TARJETA, SEGÚN SU TELÉFONO
// ----------------------------------------------------------------------------
//   iPhone   Apple Wallet (ahí se actualiza y avisa sola)
//   Android  Google Wallet si está activo · avisos del navegador · instalarla
//   otro     las dos Wallet, por si es un iPad o un portátil
// ============================================================================

export default function Acciones({ serial, negocio, plataforma, appleUrl, googleUrl, clavePush }) {
  const avisos = useAvisos(serial, clavePush);
  const instalar = useInstalar();
  const accent = negocio.tema.accent;
  const esIOS = plataforma === "ios";
  const esAndroid = plataforma === "android";
  const esCupon = negocio.tipo === "descuento";

  const conApple = Boolean(appleUrl) && !esAndroid;
  const conGoogle = Boolean(googleUrl) && !esIOS;

  // En iPhone la tarjeta vive en Wallet: los avisos del navegador sobran.
  const conAvisos = !esIOS && avisos.estado !== "no-soportado";
  const conInstalar = !esIOS && !instalar.instalada;

  if (!conApple && !conGoogle && !conAvisos && !conInstalar) return null;

  return (
    <section style={panel} aria-label="Guardar la tarjeta">
      {conApple && <BotonAppleWallet href={appleUrl} />}
      {conGoogle && <BotonGoogleWallet href={googleUrl} />}

      {conAvisos && (
        <Fila icono={avisos.estado === "bloqueado" ? "campanaNo" : "campana"} accent={accent}
          titulo={esCupon ? `Avisos de ${negocio.nombre}` : "Avisos de tus sellos"}
          texto={textoAvisos(avisos.estado, esCupon)}
          error={avisos.error}
        >
          {avisos.estado === "apagado" && <button type="button" onClick={avisos.activar} style={botonAccion(accent)}>Activar</button>}
          {avisos.estado === "encendido" && <button type="button" onClick={avisos.desactivar} style={botonSuave}>Quitar</button>}
          {(avisos.estado === "cargando" || avisos.estado === "trabajando") && <span style={{ fontSize: 13, opacity: 0.6 }}>…</span>}
        </Fila>
      )}

      {conInstalar && (instalar.puede ? (
        <Fila icono="instalar" accent={accent} titulo="Tenla en la pantalla de inicio" texto="Se abre como una app, sin buscar el enlace.">
          <button type="button" onClick={instalar.instalar} style={botonAccion(accent)}>Instalar</button>
        </Fila>
      ) : esAndroid && (
        <Fila icono="instalar" accent={accent} titulo="Tenla a mano"
          texto="En el menú de Chrome (los tres puntos), toca «Añadir a pantalla de inicio»." />
      ))}
    </section>
  );
}

function textoAvisos(estado, esCupon) {
  if (estado === "encendido") return `Activados en este móvil. Te llegará ${esCupon ? "cada promo" : "cada sello y cada promo"}.`;
  if (estado === "bloqueado") return "Están bloqueados. Actívalos en los ajustes del navegador, en Notificaciones.";
  return esCupon
    ? "Te avisamos cuando la tienda tenga una promo."
    : "Te avisamos al sumar un sello y cuando la tienda tenga una promo.";
}

function Fila({ icono, accent, titulo, texto, error, children }) {
  return (
    <div style={fila}>
      <span style={{ ...burbuja, color: accent, background: `${accent}1a` }}><Icono nombre={icono} tam={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
        <div style={{ fontSize: 13, color: "#5c6371", marginTop: 2, lineHeight: 1.35 }}>{texto}</div>
        {error && <div role="alert" style={{ fontSize: 13, color: "#b42318", marginTop: 4 }}>{error}</div>}
      </div>
      {children}
    </div>
  );
}

const panel = {
  marginTop: 18,
  padding: 14,
  borderRadius: 20,
  background: "rgba(255,255,255,.94)",
  color: "#1b1e23",
  boxShadow: "0 10px 30px -14px rgba(0,0,0,.35)",
  display: "grid",
  gap: 10,
};

const fila = { display: "flex", alignItems: "center", gap: 12, padding: "6px 2px" };
const burbuja = { width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0 };

const botonAccion = (accent) => ({
  border: 0,
  borderRadius: 12,
  padding: "0.55rem 1rem",
  minHeight: 40,
  background: accent,
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  flexShrink: 0,
});

const botonSuave = {
  border: "1px solid #cbd1d9",
  borderRadius: 12,
  padding: "0.5rem 0.9rem",
  minHeight: 40,
  background: "#fff",
  color: "#1b1e23",
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
  flexShrink: 0,
};
