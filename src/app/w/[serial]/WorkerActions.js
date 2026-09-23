"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icono from "@/app/Icono";
import { C, aviso } from "@/app/ui";

// Botones de acción del trabajador. Cada uno llama a /api/accion y refresca.
// Vibra al terminar (en Android): la caja va rápida y no siempre mira la pantalla.
export default function WorkerActions({ serial, acciones, premios = [], accent = C.texto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  async function ejecutar(accion) {
    setBusy(accion);
    setToast(null);
    try {
      const res = await fetch("/api/accion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, accion }),
      });
      const data = await res.json();
      const ok = res.ok && data.ok !== false;
      setToast({ ok, msg: data.mensaje || data.error || "Hecho", detalle: ok ? resumenAviso(data.aviso) : null });
      navigator.vibrate?.(ok ? 50 : [80, 60, 80]);
      router.refresh();
    } catch (e) {
      setToast({ ok: false, msg: "Sin conexión. No se ha guardado: vuelve a intentarlo." });
    } finally {
      setBusy(null);
    }
  }

  if (!acciones.length && !premios.length) {
    return <p style={{ color: C.suave, fontSize: 14, marginTop: 18 }}>El manager no ha activado ninguna acción.</p>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      {premios.map((p) => (
        <Premio key={p.indice} p={p} accent={accent} busy={busy} ejecutar={ejecutar} />
      ))}
      <div style={{ display: "grid", gridTemplateColumns: acciones.length > 1 ? "1fr 1fr" : "1fr", gap: 10 }}>
        {acciones.map((a) => (
          <button key={a.key} onClick={() => ejecutar(a.key)} disabled={busy !== null} style={btn(busy === a.key, accent, a.correccion)}>
            <Icono nombre={a.icon} tam={24} grosor={2.2} />
            <span>{busy === a.key ? "Guardando…" : a.label}</span>
          </button>
        ))}
      </div>
      {toast && (
        <div role="status" style={{ ...aviso(toast.ok), marginTop: 12 }}>
          {toast.msg}
          {toast.detalle && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{toast.detalle}</div>}
        </div>
      )}
    </div>
  );
}

// EL PREMIO. Solo aparece cuando hay algo que dar, y pregunta lo que hay que
// preguntarle al cliente con las mismas palabras: "¿lo quieres ahora o te lo
// guardo?". Cada botón dice debajo qué pasa con la tarjeta, para que nadie
// tenga que saberse las reglas.
function Premio({ p, accent, busy, ejecutar }) {
  const de = p.nombre ? ` de ${p.nombre.toLowerCase()}` : "";
  const boton = (key, texto, detalle, principal) => (
    <button
      type="button"
      onClick={() => ejecutar(key)}
      disabled={busy !== null}
      style={botonPremio(principal, accent, busy === key)}
    >
      <span style={{ fontSize: 16, fontWeight: 700 }}>{busy === key ? "Guardando…" : texto}</span>
      <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>{detalle}</span>
    </button>
  );

  return (
    <section style={cajaPremio(accent)} aria-label={`Premio${de}`}>
      {p.completa && (
        <>
          <div style={cabeceraPremio}>
            <span style={insignia(accent)}><Icono nombre="regalo" tam={22} grosor={2.2} /></span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Cartilla{de} completa</div>
              <div style={{ fontSize: 14, color: C.suave }}>Premio: {p.premio}. ¿Lo quiere ahora o se lo guardas?</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {boton(p.acciones.dar, "Dárselo ahora", "La cartilla vuelve a empezar", true)}
            {boton(p.acciones.guardar, "Guardarlo para otro día", "Queda en su tarjeta y sigue sumando sellos", false)}
          </div>
        </>
      )}
      {p.guardados > 0 && (
        <div style={p.completa ? { borderTop: `1px solid ${accent}33`, marginTop: 12, paddingTop: 12 } : null}>
          <div style={cabeceraPremio}>
            <span style={insignia(accent)}><Icono nombre="cartera" tam={22} grosor={2.2} /></span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {p.guardados === 1 ? "Tiene 1 premio guardado" : `Tiene ${p.guardados} premios guardados`}
              </div>
              <div style={{ fontSize: 14, color: C.suave }}>{p.premio}{p.nombre ? ` (${p.nombre.toLowerCase()})` : ""}</div>
            </div>
          </div>
          {boton(
            p.acciones.usar,
            "Usar un premio guardado",
            p.guardados > 1 ? `Le quedarán ${p.guardados - 1}` : "Sus sellos no se tocan",
            !p.completa,
          )}
        </div>
      )}
    </section>
  );
}

// "Le ha llegado al iPhone" / "…al Android": que la caja sepa que el cliente se ha enterado.
function resumenAviso(a) {
  if (!a) return null;
  const donde = [
    a.avisados > 0 && "iPhone",
    (a.web > 0 || a.google > 0) && "Android",
  ].filter(Boolean);
  return donde.length ? `Aviso enviado a su ${donde.join(" y su ")}.` : null;
}

const cajaPremio = (accent) => ({
  border: `2px solid ${accent}`, background: `${accent}12`, borderRadius: 16,
  padding: 14, marginBottom: 12,
});
const cabeceraPremio = { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 };
const insignia = (accent) => ({
  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
  display: "grid", placeItems: "center", background: accent, color: "#fff",
});
const botonPremio = (principal, accent, activo) => ({
  width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  minHeight: 60, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
  border: principal ? 0 : `1.5px solid ${accent}`,
  background: principal ? accent : "#fff", color: principal ? "#fff" : accent,
  opacity: activo ? 0.6 : 1,
});

const btn = (activo, accent, correccion) => ({
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
  minHeight: 76, padding: "14px 10px", borderRadius: 14,
  border: correccion ? `1.5px solid ${accent}` : 0,
  background: correccion ? "#fff" : accent, color: correccion ? accent : "#fff", opacity: activo ? 0.6 : 1,
  fontWeight: 650, fontSize: 15, cursor: "pointer",
});
