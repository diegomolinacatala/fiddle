"use client";

import Icono from "@/app/Icono";
import { useEffect, useState } from "react";
import PaseVista from "@/app/PaseVista";
import { C, campo, etiqueta, h2, botonPrimario, botonSecundario } from "@/app/ui";

// ============================================================================
// MANDAR UN MENSAJE AHORA, A TODOS O A UN GRUPO
// ----------------------------------------------------------------------------
// Dos cosas que para el dueño son lo mismo ("decirles algo") y por dentro no:
//   TODOS   la PROMO de la tienda (/api/promo): sale en todas las tarjetas,
//           también en las que se emitan mañana, hasta que se quite.
//   GRUPO   un MENSAJE en el pase de cada uno de ese grupo (/api/crm/campana):
//           tapa la promo y se va solo cuando el cliente vuelve.
// Por eso están en la misma pantalla con una frase que dice cuál es cuál.
//
// La vista previa usa PaseVista, o sea las MISMAS funciones que arman el
// .pkpass: lo que se ve aquí es lo que va a aparecer en el teléfono.
// ============================================================================

const MAX = { todos: 200, grupo: 120 };
export const TODOS = "todos";

export default function Campana({ negocio, destino, onEnviada, flash }) {
  const esTodos = destino.key === TODOS;
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const max = esTodos ? MAX.todos : MAX.grupo;

  // Al cambiar de destino, su idea de partida: un punto de partida para no mirar
  // un campo vacío, no una plantilla. Para todos, la promo que ya esté puesta.
  useEffect(() => {
    setTexto(esTodos ? negocio.promo || "" : destino.idea?.replace("{premio}", negocio.premio) || "");
  }, [destino.key, esTodos, destino.idea, negocio.promo, negocio.premio]);

  const clienteVista = {
    serial: "ejemplo-0000-0000-0000-000000000000",
    codigo: "ABC",
    nombre: "Cliente",
    sellos: Math.max(1, Math.round((negocio.meta || 1) * 0.6)),
    premios: 0,
    mensaje: esTodos ? null : texto.trim() || null,
  };
  const negocioVista = esTodos ? { ...negocio, promo: texto.trim() || null } : negocio;

  async function enviar(cuerpo) {
    setEnviando(true);
    try {
      const r = await fetch(esTodos ? "/api/promo" : "/api/crm/campana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esTodos ? { b: negocio.slug, texto: cuerpo } : { b: negocio.slug, grupo: destino.key, texto: cuerpo }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo enviar");
      flash(resumen(d, cuerpo, esTodos));
      onEnviada();
    } catch {
      flash("Sin conexión: no se ha enviado");
    } finally {
      setEnviando(false);
    }
  }

  const sinNadie = destino.contactables === 0;
  const bloqueado = enviando || sinNadie || !texto.trim();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
      <div>
        <h2 style={{ ...h2, display: "flex", alignItems: "center", gap: 8 }}><Icono nombre={destino.icon} tam={18} /> {destino.label}</h2>
        <p style={{ fontSize: 13, color: C.suave, margin: "0 0 4px" }}>{destino.descripcion}</p>
        <p style={{ fontSize: 13, margin: "0 0 14px" }}>
          <strong>{destino.total}</strong> cliente{destino.total === 1 ? "" : "s"} ·{" "}
          <strong style={{ color: destino.contactables ? C.ok : C.mal }}>{destino.contactables}</strong> con la tarjeta en el teléfono
          {destino.total !== destino.contactables && (
            <span style={{ color: C.tenue }}> · a {destino.total - destino.contactables} no se les puede avisar</span>
          )}
        </p>

        <label style={{ ...etiqueta, marginTop: 0 }} htmlFor="texto-campana">Lo que leerán en el pase</label>
        <textarea
          id="texto-campana" value={texto} rows={3} placeholder={esTodos ? "Hoy 2x1 en cafés…" : ""}
          onChange={(e) => setTexto(e.target.value.slice(0, max))}
          style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 12, color: texto.length > max - 20 ? C.mal : C.tenue, marginTop: 4 }}>
          {texto.length}/{max} · una línea corta se lee de un vistazo en la pantalla de bloqueo
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={() => enviar(texto.trim())} disabled={bloqueado} style={{ ...botonPrimario(negocio.tema.accent), opacity: bloqueado ? 0.45 : 1, cursor: bloqueado ? "default" : "pointer" }}>
            {enviando ? "Enviando…" : esTodos ? "Poner en todas las tarjetas" : `Enviar a ${destino.contactables}`}
          </button>
          {(!esTodos || negocio.promo) && (
            <button onClick={() => enviar("")} disabled={enviando} style={botonSecundario} title="Deja el pase como estaba">
              {esTodos ? "Quitar la promo" : "Quitar el mensaje"}
            </button>
          )}
        </div>

        <p style={{ fontSize: 12.5, color: C.tenue, marginTop: 12 }}>
          {esTodos
            ? "Se queda en todas las tarjetas, también en las nuevas, hasta que la quites."
            : "Se queda en el pase de cada uno hasta que vuelva a la tienda; entonces se quita solo."}
        </p>
        {sinNadie && (
          <p style={{ fontSize: 13, color: C.mal, marginTop: 8 }}>
            Nadie {esTodos ? "" : "de este grupo "}tiene la tarjeta en el teléfono (Wallet o avisos de Android), así que no hay a dónde mandarlo.
          </p>
        )}
      </div>

      <div>
        <label style={{ ...etiqueta, marginTop: 0 }}>Cómo lo verán</label>
        <PaseVista
          negocio={negocioVista}
          cliente={clienteVista}
          qrTexto={`/w/${clienteVista.serial}`}
          pie={esTodos
            ? "Si a alguien le llega un mensaje de un grupo o un aviso automático, ese le tapa la promo."
            : "El mensaje ocupa el sitio de la promo: mientras esté puesto, tapa la de la tienda."}
        />
      </div>
    </div>
  );
}

/** Cuántos teléfonos sonaron, por canal: iPhone (Wallet) y Android (avisos + Google Wallet). */
function resumen(d, cuerpo, esTodos) {
  if (!cuerpo) return esTodos ? "Promo quitada de todas las tarjetas" : `Mensaje quitado de ${d.quitado} ${d.quitado === 1 ? "tarjeta" : "tarjetas"}`;
  const android = (d.web || 0) + (d.google || 0);
  const iphone = esTodos ? d.enviadas : d.avisados;
  const sonaron = [d.proveedor === "apple" && `${iphone} iPhone`, android && `${android} Android`].filter(Boolean);
  const base = esTodos ? `Promo puesta en ${d.total} tarjetas` : `Enviado a ${d.destinatarios}`;
  return `${base}${sonaron.length ? ` · avisados: ${sonaron.join(", ")}` : ""}`;
}
