"use client";

import { useEffect, useRef, useState } from "react";
import { C, RADIO, botonPequeno, tinte } from "@/app/ui";

// ============================================================================
// ¿ESTÁ TODO CONECTADO? — un piloto en la esquina del admin
// ----------------------------------------------------------------------------
// Lee /api/estado, que comprueba de verdad el certificado de Apple, la base de
// datos, los avisos de Android, Google Wallet y el cifrado de los clientes, y dice
// qué tocar si algo falla. Casi siempre está bien, así que no ocupa la pantalla:
// un punto verde «Todo funciona» junto a «Salir». Si algo falla, se pone rojo y
// dice cuántos; al tocarlo, la lista entera.
//
// El desplegable se coloca contra el contenedor posicionado de la cabecera (el
// grupo de la derecha), no contra el piloto: así en el móvil no se sale por la
// izquierda.
// ============================================================================

export default function EstadoIntegracion({ accent }) {
  const [estado, setEstado] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [cifrando, setCifrando] = useState(false);
  const [errorCifrar, setErrorCifrar] = useState(null);
  const caja = useRef(null);

  const cargar = () => fetch("/api/estado").then((r) => (r.ok ? r.json() : null)).then(setEstado).catch(() => {});
  useEffect(() => { cargar(); }, []);

  // Se cierra al tocar fuera o con Escape, como cualquier menú.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    const escape = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  // Los nombres y notas que se guardaron antes de tener la clave: una vez y ya.
  async function cifrarPendientes() {
    setCifrando(true);
    setErrorCifrar(null);
    try {
      const r = await fetch("/api/admin/cifrar", { method: "POST" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`);
      await cargar();
    } catch (e) {
      setErrorCifrar(e.message);
    } finally {
      setCifrando(false);
    }
  }

  if (!estado) return null;

  const filas = filasDe(estado, { errorCifrar, accion: estado.cifrado?.pendientes > 0 && (
    <button type="button" onClick={cifrarPendientes} disabled={cifrando} aria-busy={cifrando || undefined} style={botonCifrar(accent)}>
      {cifrando ? "Cifrando…" : "Cifrar ahora"}
    </button>
  ) });
  const fallos = filas.filter((f) => !f.ok && !f.aviso).length;
  const avisos = filas.filter((f) => f.aviso).length;
  const tono = fallos ? C.mal : avisos ? C.ojo : C.ok;
  const texto = fallos ? `${fallos} ${fallos === 1 ? "fallo" : "fallos"}` : avisos ? `${avisos} ${avisos === 1 ? "aviso" : "avisos"}` : "Todo funciona";

  return (
    <div ref={caja}>
      {/* En un móvil estrecho, «Todo funciona» no cabe junto a «Salir»: basta el punto verde. */}
      <style>{"@media (max-width: 479px) { .estado-texto { display: none } }"}</style>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="estado-integracion"
        aria-label={`Estado de la integración: ${texto}`}
        title="Estado de la integración"
        style={{
          ...botonPequeno,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          // Bien: discreto, como «Salir». Mal: se tiñe para que se vea al entrar.
          ...(fallos ? { borderColor: C.malBorde, background: C.malFondo, color: C.mal, fontWeight: 600 } : {}),
        }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tono, boxShadow: `0 0 0 3px ${tinte(tono, 18)}` }} />
        <span className={fallos || avisos ? undefined : "estado-texto"}>{texto}</span>
      </button>

      {abierto && (
        <div
          id="estado-integracion"
          role="region"
          aria-label="Estado de la integración"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 30,
            width: "min(440px, calc(100vw - 32px))",
            background: C.panel, border: `1px solid ${C.borde}`, borderRadius: RADIO.panel,
            boxShadow: "0 14px 40px rgb(0 0 0 / 0.18)", padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 10 }}>
            Estado de la integración · {filas.filter((f) => f.ok).length}/{filas.length} listo
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {filas.map((f) => (
              <div key={f.titulo} style={{ display: "grid", gridTemplateColumns: "9px minmax(0, 1fr)", columnGap: 10, fontSize: 13 }}>
                <span
                  aria-label={f.ok && !f.aviso ? "bien" : f.ok || f.aviso ? "opcional" : "falla"}
                  style={{ ...punto(f.ok && !f.aviso ? C.ok : f.ok || f.aviso ? C.ojo : C.mal), marginTop: 5 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{f.titulo}</div>
                  <div style={{ color: C.suave, overflowWrap: "anywhere", lineHeight: 1.4 }}>{f.detalle}</div>
                  {f.accion && <div style={{ marginTop: 6 }}>{f.accion}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function filasDe(estado, { errorCifrar, accion }) {
  const { apple, push, google } = estado;
  return [
    {
      ok: estado.proveedor === "apple" && apple.ok,
      aviso: apple.ok && apple.avisos.length > 0,
      titulo: "iPhone · Apple Wallet",
      detalle: detalleApple(estado),
    },
    // Una fila por tienda con Pass Type ID propio: sus tarjetas van aparte en el Wallet.
    ...(estado.appleTiendas || []).map((t) => ({
      ok: t.ok,
      aviso: t.ok && t.avisos.length > 0,
      titulo: `iPhone · ${t.slug}`,
      detalle: t.ok
        ? [`${t.passTypeId} (solo de esta tienda) · caduca ${t.caduca}`, ...t.avisos].join(" · ")
        : t.problemas.join(" · "),
    })),
    { ok: Boolean(push?.ok), titulo: "Android · avisos", detalle: push?.detalle || "Sin datos" },
    {
      ok: Boolean(google?.ok),
      // Sin configurar no es un fallo: Android ya tiene su tarjeta web con avisos.
      aviso: google && !google.configurado,
      titulo: "Android · Google Wallet",
      detalle: google?.detalle || "Sin datos",
    },
    {
      ok: estado.httpsPublico,
      titulo: "URL pública HTTPS",
      detalle: estado.httpsPublico
        ? estado.appUrl
        : `${estado.appUrl} — Apple solo actualiza pases contra HTTPS. Pon APP_URL del deploy.`,
    },
    { ok: estado.supabase.ok, titulo: "Base de datos", detalle: estado.supabase.detalle },
    {
      ok: Boolean(estado.cifrado?.ok),
      titulo: "Datos de clientes cifrados",
      detalle: errorCifrar ? `${estado.cifrado?.detalle} · ${errorCifrar}` : estado.cifrado?.detalle || "Sin datos",
      accion,
    },
    { ok: estado.authSecret, titulo: "Login seguro", detalle: estado.authSecret ? "AUTH_SECRET configurado" : "Secreto de demo: configura AUTH_SECRET" },
  ];
}

function detalleApple({ apple }) {
  if (!apple.ok) return apple.problemas.join(" · ");
  const base = `Firma propia · ${apple.passTypeId} (compartido) · caduca ${apple.caduca}`;
  return apple.avisos.length ? `${base} · ${apple.avisos.join(" · ")}` : base;
}

const botonCifrar = (accent) => ({
  border: 0, borderRadius: RADIO.boton, padding: "0.4rem 0.8rem", background: accent, color: "#fff",
  fontWeight: 600, fontSize: 13, cursor: "pointer",
});
const punto = (color) => ({ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 });
