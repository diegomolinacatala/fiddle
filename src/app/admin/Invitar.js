"use client";

import { useEffect, useState } from "react";
import Icono from "@/app/Icono";
import { C, campo, botonPequeno, botonPrimario, aviso } from "@/app/ui";
import { confirmar, ensenarParaCopiar } from "@/app/Dialogo";

// ============================================================================
// INVITAR AL DUEÑO POR CORREO (ficha de la tienda en /admin)
// ----------------------------------------------------------------------------
// Crea un enlace de un solo uso (lib/invitaciones.js) y abre TU correo con el
// mensaje ya escrito (mailto): lo envías tú, desde tu cuenta. Sin proveedor de
// correo que contratar ni dominio que verificar, y el dueño recibe el mensaje
// de alguien a quien conoce. El correo del dueño no se guarda en ningún sitio.
//
// Antes de ofrecer «crear», pregunta al servidor cómo está el enlace de la
// tienda (GET /api/admin/invitacion): si hay uno pendiente lo dice, con su
// fecha, y crear otro avisa de que el pendiente deja de valer. Este botón está
// en dos sitios (la ficha y el panel de «tienda creada») y lo pueden pulsar dos
// admins: sin esto, uno mataba el enlace que el otro ya había mandado sin
// enterarse (docs/AUDITORIA-ACCESOS.md, A3).
//
// Dos usos del mismo enlace (`alcance`): el alta de una tienda (las dos
// contraseñas) y recuperar la del dueño sin tocar la caja. Un enlace nuevo anula
// el pendiente de la tienda, sea del uso que sea: la situación del enlace se pinta
// una vez, en el bloque del alta, que va primero.
// ============================================================================

const AZUL = "#2563eb";
const fecha = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

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
  const [estado, setEstado] = useState(null); // { pendiente, caducada, ultimaUsada, fiable, base }
  const [inv, setInv] = useState(null); // { url, token, caduca, alcance, nombre, usuarios }
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const textos = TEXTOS[alcance];

  const cargar = () => fetch(`/api/admin/invitacion?slug=${encodeURIComponent(slug)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudo leer el estado del enlace"))))
    .then(setEstado)
    .catch((e) => setError(e.message));
  useEffect(() => { setInv(null); cargar(); }, [slug]);

  async function crear() {
    // Sin estado (el GET falló) se pregunta igual: crear a ciegas es justo lo que anulaba el enlace del dueño.
    const pregunta = inv || estado?.pendiente
      ? "¿Crear otro enlace? El pendiente dejará de valer: si el dueño ya lo tiene, le fallará."
      : !estado ? "No se ha podido comprobar si hay un enlace pendiente. ¿Crear uno igualmente? Si lo había, dejará de valer." : null;
    if (pregunta && !(await confirmar({ titulo: pregunta, si: "Crear el enlace" }))) return;
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
      cargar();
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
      ensenarParaCopiar({ titulo: "Copia el enlace", valor: inv.url });
    }
  }

  const fiable = (inv ?? estado)?.fiable !== false;

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borde}` }}>
      {!fiable && (
        <div role="alert" style={{ ...aviso(false), marginBottom: 12 }}>
          Esto es la web de pruebas, sin base de datos: el enlace que se cree aquí no le va a servir
          al dueño (vive en una sola función de Vercel y caduca al momento). Créalo desde producción.
        </div>
      )}

      {!inv && (
        <>
          {estado && alcance === "alta" && <Situacion estado={estado} />}
          {/* Hasta saber cómo está el enlace, el botón espera: no se crea uno sin mirar. */}
          <button type="button" onClick={crear} disabled={busy || (!estado && !error)} aria-busy={busy || undefined} style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {!busy && <Icono nombre="correo" tam={16} />}
            {" "}
            {busy ? "Creando…" : !estado && !error ? "Mirando el enlace…" : estado?.pendiente ? "Crear otro (el pendiente dejará de valer)" : textos.boton}
          </button>
          <p style={nota}>{textos.nota}</p>
        </>
      )}

      {inv && (
        <div>
          <strong style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Icono nombre="correo" tam={16} /> {textos.listo}
          </strong>
          {/* El enlace entero, a la vista: que se vea a qué web apunta (APP_URL) antes de mandarlo. */}
          <code style={enlace}>{inv.url}</code>
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
          <p style={nota}>
            Vale hasta el {fecha(inv.caduca)}. No se vuelve a ver: si el dueño lo pierde, crea otro (el anterior
            deja de funcionar). Que lo cree una sola persona, una sola vez.
          </p>
        </div>
      )}

      {error && <p style={{ color: C.mal, fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

// Cómo está el enlace de esta tienda, antes de tocar nada.
function Situacion({ estado }) {
  const { pendiente, caducada, ultimaUsada } = estado;
  const frases = [];
  if (pendiente) frases.push(`Hay un enlace pendiente, creado el ${fecha(pendiente.creado)}: vale hasta el ${fecha(pendiente.caduca)}.`);
  else if (caducada) frases.push(`El último enlace, del ${fecha(caducada.creado)}, caducó el ${fecha(caducada.caduca)} sin usarse.`);
  if (ultimaUsada) frases.push(`El dueño usó su enlace el ${fecha(ultimaUsada)}: ya eligió sus contraseñas.`);
  if (!frases.length) return null;
  return (
    <p style={{ ...nota, margin: "0 0 10px", color: pendiente ? C.texto : C.suave }}>
      {frases.join(" ")}
    </p>
  );
}

// El correo, ya escrito. Corto: lo importante es el enlace y qué va a pasar. El
// código va también suelto, debajo: algún correo recorta lo que va tras `#`, y
// la página lo acepta pegado (lib/tokenInvitacion.js).
function mailto(email, { url, token, caduca, alcance, nombre, usuarios }) {
  const soloManager = alcance === "manager";
  const asunto = soloManager ? `Tu nueva contraseña para las tarjetas de ${nombre}` : `Tu acceso a las tarjetas de ${nombre}`;
  const cuerpo = [
    "Hola:",
    "",
    soloManager
      ? `Abre este enlace y elige tu nueva contraseña para entrar en las tarjetas de fidelización de ${nombre}.`
      : `Ya está lista la tarjeta de fidelización de ${nombre}. Para entrar, abre este enlace y elige dos contraseñas: la tuya (para ver clientes, lanzar promos y cambiar la tarjeta) y la del móvil de la caja (solo para sumar puntos).`,
    "",
    url,
    "",
    `Si al abrirlo te pide el código, es este: ${token}`,
    "",
    soloManager
      ? `Tu usuario sigue siendo «${usuarios.manager}». La contraseña de la caja no cambia.`
      : `Tu usuario será «${usuarios.manager}» y el de la caja «${usuarios.caja}».`,
    `El enlace sirve una vez y caduca el ${fecha(caduca)}. Puedes recargar la página o volver más tarde: no se pierde.`,
    "",
    "Un saludo",
  ].join("\n");
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

const nota = { fontSize: 12, color: C.tenue, margin: "8px 0 0", lineHeight: 1.45 };
const enlace = {
  display: "block", marginTop: 8, padding: "8px 10px", borderRadius: 10, background: C.panelSuave,
  border: `1px solid ${C.borde}`, fontSize: 12, wordBreak: "break-all", lineHeight: 1.4,
};
