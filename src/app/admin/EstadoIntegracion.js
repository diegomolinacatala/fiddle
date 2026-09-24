"use client";

import { useEffect, useState } from "react";
import { C } from "@/app/ui";

// Panel "¿está todo conectado?" del manager. Lee /api/estado, que comprueba de
// verdad certificado de Apple, base de datos, avisos de Android, Google Wallet y
// el cifrado de los datos de clientes, y dice qué tocar si algo falla. Se abre
// solo cuando hay algo mal.
export default function EstadoIntegracion({ accent }) {
  const [estado, setEstado] = useState(null);
  const [cifrando, setCifrando] = useState(false);
  const [errorCifrar, setErrorCifrar] = useState(null);

  const cargar = () => fetch("/api/estado").then((r) => (r.ok ? r.json() : null)).then(setEstado).catch(() => {});
  useEffect(() => { cargar(); }, []);

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

  const { apple, push, google } = estado;
  const filas = [
    {
      ok: estado.proveedor === "apple" && apple.ok,
      aviso: estado.proveedor === "walletwallet" || (apple.ok && apple.avisos.length > 0),
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
      accion: estado.esAdmin && estado.cifrado?.pendientes > 0
        && <button type="button" onClick={cifrarPendientes} disabled={cifrando} style={botonCifrar(accent)}>{cifrando ? "Cifrando…" : "Cifrar ahora"}</button>,
    },
    { ok: estado.authSecret, titulo: "Login seguro", detalle: estado.authSecret ? "AUTH_SECRET configurado" : "Secreto de demo: configura AUTH_SECRET" },
  ];
  const todoBien = filas.every((f) => f.ok || f.aviso);

  return (
    <details open={!todoBien} style={{ ...panel, borderColor: todoBien ? "#bfe5cd" : `${accent}66` }}>
      <summary style={{ cursor: "pointer", fontSize: 14 }}>
        Estado de la integración · {filas.filter((f) => f.ok).length}/{filas.length} listo
      </summary>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {filas.map((f) => (
          <div key={f.titulo} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline", flexWrap: "wrap" }}>
            <span aria-label={f.ok && !f.aviso ? "bien" : f.ok || f.aviso ? "opcional" : "falla"} style={punto(f.ok && !f.aviso ? C.ok : f.ok || f.aviso ? "#c26b04" : C.mal)} />
            <strong style={{ fontWeight: 600, minWidth: 170 }}>{f.titulo}</strong>
            <span style={{ color: C.suave, wordBreak: "break-word", flex: "1 1 220px" }}>{f.detalle}</span>
            {f.accion}
          </div>
        ))}
      </div>
    </details>
  );
}

function detalleApple({ proveedor, apple }) {
  if (proveedor === "walletwallet") return "Usando WalletWallet (plan B). Configura APPLE_* para firmar con tu cuenta.";
  if (!apple.ok) return apple.problemas.join(" · ");
  const base = `Firma propia · ${apple.passTypeId} (compartido) · caduca ${apple.caduca}`;
  return apple.avisos.length ? `${base} · ${apple.avisos.join(" · ")}` : base;
}

const panel = { marginTop: 16, padding: "10px 14px", borderRadius: 14, border: "1px solid", background: C.panel };
const botonCifrar = (accent) => ({
  border: 0, borderRadius: 10, padding: "0.4rem 0.8rem", background: accent, color: "#fff",
  fontWeight: 600, fontSize: 13, cursor: "pointer",
});
const punto = (color) => ({ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0, alignSelf: "center" });
