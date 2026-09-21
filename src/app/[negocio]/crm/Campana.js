"use client";

import { useEffect, useState } from "react";
import PaseVista from "@/app/PaseVista";
import { C, campo, etiqueta, h2, botonPrimario, botonSecundario } from "@/app/ui";

// ============================================================================
// AVISAR A UN GRUPO
// ----------------------------------------------------------------------------
// Elegir un bloque de clientes, escribir una línea y mandársela. El texto se
// escribe en el pase de cada uno, y ese cambio es lo que dispara el aviso en la
// pantalla de bloqueo: Apple no tiene mensajes propios.
//
// La vista previa usa PaseVista, o sea las MISMAS funciones que arman el
// .pkpass. Lo que se ve aquí es lo que va a aparecer en el teléfono, incluido
// el recorte si el texto es largo.
// ============================================================================

const MAX = 120;

export default function Campana({ negocio, grupo, catalogo, onEnviada, flash }) {
  const def = catalogo.find((g) => g.key === grupo);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Al cambiar de grupo, la idea de partida de ESE grupo. Es un punto de partida
  // para no mirar un campo vacío, no una plantilla: se reescribe encima.
  useEffect(() => {
    setTexto(def ? def.idea.replace("{premio}", negocio.premio) : "");
  }, [grupo, def, negocio.premio]);

  if (!def) return null;

  const clienteVista = {
    serial: "ejemplo-0000-0000-0000-000000000000",
    codigo: "ABC",
    nombre: "Cliente",
    sellos: Math.max(1, Math.round((negocio.meta || 1) * 0.6)),
    premios: 0,
    mensaje: texto.trim() || null,
  };

  async function enviar(cuerpo) {
    setEnviando(true);
    try {
      const r = await fetch("/api/crm/campana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b: negocio.slug, grupo, texto: cuerpo }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo enviar");
      if (!cuerpo) {
        flash(`Mensaje quitado de ${d.quitado} pase(s)`);
      } else {
        flash(
          d.proveedor === "apple"
            ? `Enviado a ${d.destinatarios} · ${d.avisados} aviso(s) en pantalla`
            : `Guardado en ${d.destinatarios} pase(s) · sin Apple no hay empujón`,
        );
      }
      onEnviada();
    } finally {
      setEnviando(false);
    }
  }

  const sinNadie = def.contactables === 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
      <div>
        <h2 style={h2}>{def.icon} {def.label}</h2>
        <p style={{ fontSize: 13, color: C.suave, margin: "0 0 4px" }}>{def.descripcion}</p>
        <p style={{ fontSize: 13, margin: "0 0 14px" }}>
          <strong>{def.total}</strong> cliente{def.total === 1 ? "" : "s"} ·{" "}
          <strong style={{ color: def.contactables ? C.ok : C.mal }}>{def.contactables}</strong> con el pase instalado
          {def.total !== def.contactables && (
            <span style={{ color: C.tenue }}>
              {" "}· a {def.total - def.contactables} no se les puede avisar
            </span>
          )}
        </p>

        <label style={{ ...etiqueta, marginTop: 0 }}>Lo que leerán en el pase</label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX))}
          rows={3}
          style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 12, color: texto.length > MAX - 20 ? C.mal : C.tenue, marginTop: 4 }}>
          {texto.length}/{MAX} · una línea corta se lee de un vistazo en la pantalla de bloqueo
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => enviar(texto.trim())}
            disabled={enviando || sinNadie || !texto.trim()}
            style={{
              ...botonPrimario(negocio.tema.accent),
              opacity: enviando || sinNadie || !texto.trim() ? 0.45 : 1,
              cursor: enviando || sinNadie || !texto.trim() ? "default" : "pointer",
            }}
          >
            {enviando ? "Enviando…" : `Enviar a ${def.contactables}`}
          </button>
          <button onClick={() => enviar("")} disabled={enviando} style={botonSecundario} title="Deja el pase como estaba">
            Quitar el mensaje
          </button>
        </div>

        {sinNadie && (
          <p style={{ fontSize: 13, color: C.mal, marginTop: 12 }}>
            Nadie de este grupo tiene el pase en el teléfono, así que no hay a dónde mandarlo.
          </p>
        )}
      </div>

      <div>
        <label style={{ ...etiqueta, marginTop: 0 }}>Cómo lo verán</label>
        <PaseVista
          negocio={negocio}
          cliente={clienteVista}
          qrTexto={`/w/${clienteVista.serial}`}
          pie="El mensaje ocupa el sitio de la promo: mientras esté puesto, tapa la de la tienda."
        />
      </div>
    </div>
  );
}
