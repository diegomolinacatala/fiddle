"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { C, campo, botonPequeno, botonPrimario } from "@/app/ui";

// ============================================================================
// INVITAR AL DUEÑO POR CORREO (ficha de la tienda en /admin)
// ----------------------------------------------------------------------------
// Crea un enlace de un solo uso (lib/invitaciones.js) y abre TU correo con el
// mensaje ya escrito (mailto): lo envías tú, desde tu cuenta. Sin proveedor de
// correo que contratar ni dominio que verificar, y el dueño recibe el mensaje
// de alguien a quien conoce. El correo del dueño no se guarda en ningún sitio.
// ============================================================================

const AZUL = "#2563eb";
const fecha = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

// Dos usos del mismo enlace (lib/invitaciones.js, `alcance`): el alta de una tienda
// (las dos contraseñas) y recuperar la del dueño sin tocar la caja. Un enlace nuevo
// anula el pendiente de la tienda, sea del uso que sea.
const TEXTOS = {
  alta: {
    boton: "Invitar al dueño por correo",
    nota: "Le llega un enlace para elegir su contraseña y la de la caja. Caduca en 7 días y sirve una vez; las contraseñas de arriba dejan de valer cuando lo use.",
    listo: "Invitación lista",
  },
  manager: {
    boton: "Enlace para que el dueño elija su contraseña",
    nota: "Para cuando la pierde: elige una nueva él mismo, sin que nadie se la dicte. Solo cambia la suya; la caja sigue igual. Caduca en 7 días y sirve una vez.",
    listo: "Enlace para su contraseña listo",
  },
};

/** `onCreado(alcance)`: avisa a quien pinte otro bloque de enlace de que el suyo acaba de quedar anulado. */
export default function Invitar({ slug, alcance = "alta", onCreado = null }) {
  const [inv, setInv] = useState(null); // { url, caduca, alcance, nombre, usuarios }
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const textos = TEXTOS[alcance];

  async function crear() {
    if (inv && !window.confirm("¿Crear un enlace nuevo? El anterior dejará de valer.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/invitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, alcance }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo crear la invitación");
      setInv(d);
      setCopiado(false);
      onCreado?.(alcance);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(inv.url);
      setCopiado(true);
    } catch {
      window.prompt("Copia el enlace:", inv.url);
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borde}` }}>
      {!inv && (
        <>
          <button type="button" onClick={crear} disabled={busy} style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icono nombre="correo" tam={16} /> {busy ? "Creando…" : textos.boton}
          </button>
          <p style={nota}>{textos.nota}</p>
        </>
      )}

      {inv && (
        <div>
          <strong style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Icono nombre="correo" tam={16} /> {textos.listo}
          </strong>
          <label style={{ display: "block", fontSize: 12, color: C.suave, margin: "10px 0 4px" }} htmlFor={`email-dueno-${alcance}`}>
            Correo del dueño (opcional, no se guarda)
          </label>
          <input
            id={`email-dueno-${alcance}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dueno@sutienda.com"
            autoComplete="off"
            style={campo}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <a href={mailto(email, inv)} style={{ ...botonPrimario(AZUL), textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icono nombre="correo" tam={16} /> Abrir en mi correo
            </a>
            <button type="button" onClick={copiar} style={botonPequeno}>{copiado ? "Copiado" : "Copiar enlace"}</button>
            <button type="button" onClick={crear} disabled={busy} style={botonPequeno}>Otro enlace</button>
          </div>
          <p style={nota}>Vale hasta el {fecha(inv.caduca)}. Si lo pierde, crea otro: el anterior deja de funcionar.</p>
        </div>
      )}

      {error && <p style={{ color: C.mal, fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

// El correo, ya escrito. Corto: lo importante es el enlace y qué va a pasar.
function mailto(email, { url, caduca, alcance, nombre, usuarios }) {
  const soloManager = alcance === "manager";
  const asunto = soloManager ? `Tu nueva contraseña para las tarjetas de ${nombre}` : `Tu acceso a las tarjetas de ${nombre}`;
  const cuerpo = [
    "Hola:",
    "",
    soloManager
      ? `Abre este enlace y elige tu nueva contraseña para entrar en las tarjetas de fidelización de ${nombre}.`
      : `Ya está lista la tarjeta de fidelización de ${nombre}. Para entrar, abre este enlace y elige dos contraseñas: la tuya (para ver clientes, lanzar promos y cambiar la tarjeta) y la del móvil de la caja (solo para sellar).`,
    "",
    url,
    "",
    soloManager
      ? `Tu usuario sigue siendo «${usuarios.manager}». La contraseña de la caja no cambia.`
      : `Tu usuario será «${usuarios.manager}» y el de la caja «${usuarios.caja}».`,
    `El enlace sirve una vez y caduca el ${fecha(caduca)}.`,
    "",
    "Un saludo",
  ].join("\n");
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

const nota = { fontSize: 12, color: C.tenue, margin: "8px 0 0", lineHeight: 1.45 };
