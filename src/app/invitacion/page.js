"use client";

import { useEffect, useState } from "react";
import MarcaTienda from "@/app/MarcaTienda";
import { C, paginaCentrada, panel, campo, etiqueta, aviso, botonSecundario, legible } from "@/app/ui";

// ============================================================================
// INVITACIÓN — el dueño de una tienda nueva elige sus contraseñas
// ----------------------------------------------------------------------------
// Llega aquí desde el enlace del correo (/invitacion#<token>). Dos pasos: la
// suya (manager) y la del móvil de la caja, cada una escrita dos veces (lo pidió
// La Delicantería: con una sola no sabes si la has tecleado bien, y no se puede
// volver a usar el enlace). Al terminar entra directo a su manager. El token
// vive detrás de `#`: se lee aquí y viaja en el cuerpo de la petición, nunca en
// una URL que quede en un log (ver lib/invitaciones.js).
// ============================================================================

const MIN = 10; // el mismo mínimo que lib/claves.js (problemaClaveElegida)

export default function Invitacion() {
  const [token, setToken] = useState(null);
  const [info, setInfo] = useState(null); // { nombre, tema, usuarios }
  const [error, setError] = useState(null);
  const [paso, setPaso] = useState(1);
  const [manager, setManager] = useState("");
  const [manager2, setManager2] = useState("");
  const [caja, setCaja] = useState("");
  const [caja2, setCaja2] = useState("");
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.location.hash.slice(1);
    setToken(t);
    // Fuera de la barra de direcciones: si enseña la pantalla, no enseña el enlace.
    window.history.replaceState(null, "", "/invitacion");
    fetch("/api/invitacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Este enlace no vale");
        setInfo(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Al volver a escribir se quita el aviso: si no, «No son iguales» sigue ahí
  // debajo de un «Son iguales.» recién arreglado.
  const escribir = (set) => (v) => { set(v); setError(null); };

  function siguiente(e) {
    e.preventDefault();
    setError(null);
    const problema = revisar(manager, manager2, info.usuarios.manager);
    if (problema) return setError(problema);
    setPaso(2);
  }

  async function terminar(e) {
    e.preventDefault();
    setError(null);
    const problema = revisar(caja, caja2, info.usuarios.caja) || (caja.trim() === manager.trim() ? "Tiene que ser distinta de la tuya: la sabrá quien use la caja." : null);
    if (problema) return setError(problema);
    setBusy(true);
    try {
      const r = await fetch("/api/invitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, manager, caja }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.campo === "manager") setPaso(1);
        throw new Error(d.error || "No se pudo guardar");
      }
      window.location.assign(d.destino);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!info) {
    return (
      <main style={paginaCentrada}>
        <div style={{ width: "min(420px, 100%)" }}>
          {error
            ? <div style={panel}>
                <h1 style={titulo}>Este enlace no sirve</h1>
                <p style={{ ...texto, marginBottom: 16 }}>{error}</p>
                <a href="/login" style={{ ...botonSecundario, textDecoration: "none", display: "inline-block" }}>Ir a entrar</a>
              </div>
            : <p style={{ color: C.suave, textAlign: "center" }}>Comprobando el enlace…</p>}
        </div>
      </main>
    );
  }

  const { usuarios } = info;
  const accent = info.tema?.accent || C.texto;

  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(420px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {info.tema && <MarcaTienda tema={info.tema} tam={44} icono />}
          <div>
            <h1 style={{ ...titulo, margin: 0 }}>{info.nombre}</h1>
            <p style={{ ...texto, margin: 0 }}>Te damos la bienvenida. Dos contraseñas y listo.</p>
          </div>
        </div>

        <ol style={pasos} aria-label="Pasos">
          <li style={pasoEstilo(paso === 1, paso > 1, accent)}>1 · La tuya</li>
          <li style={pasoEstilo(paso === 2, false, accent)}>2 · La de la caja</li>
        </ol>

        {paso === 1 && (
          <form onSubmit={siguiente} style={panel}>
            <p style={texto}>
              Con ella entras al <strong style={{ color: C.texto }}>manager</strong>: la tarjeta, las promos y tus clientes.
            </p>
            <label style={etiqueta}>Tu usuario</label>
            <div style={usuarioFijo}>{usuarios.manager}</div>
            {/* Para que el gestor de contraseñas la guarde con su usuario. */}
            <input type="text" name="username" autoComplete="username" value={usuarios.manager} readOnly hidden />
            <label style={etiqueta} htmlFor="clave-manager">Elige tu contraseña</label>
            <Clave id="clave-manager" valor={manager} onChange={escribir(setManager)} ver={ver} setVer={setVer} autoFocus />
            <Ayuda valor={manager} />
            <label style={etiqueta} htmlFor="clave-manager-2">Repítela</label>
            <Clave id="clave-manager-2" valor={manager2} onChange={escribir(setManager2)} ver={ver} />
            <Coinciden clave={manager} repetida={manager2} />
            {error && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
            <button type="submit" style={principal(accent, lista(manager, manager2))}>Siguiente</button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={terminar} style={panel}>
            <p style={texto}>
              La usará el <strong style={{ color: C.texto }}>móvil de la caja</strong> para sellar. Solo sirve para eso:
              quien la sepa no ve tus clientes ni cambia la tarjeta. Apúntala: la vas a escribir allí.
            </p>
            <label style={etiqueta}>Usuario de la caja</label>
            <div style={usuarioFijo}>{usuarios.caja}</div>
            <label style={etiqueta} htmlFor="clave-caja">Contraseña de la caja</label>
            <Clave id="clave-caja" valor={caja} onChange={escribir(setCaja)} ver={ver} setVer={setVer} autoFocus />
            <Ayuda valor={caja} />
            <label style={etiqueta} htmlFor="clave-caja-2">Repítela</label>
            <Clave id="clave-caja-2" valor={caja2} onChange={escribir(setCaja2)} ver={ver} />
            <Coinciden clave={caja} repetida={caja2} />
            {error && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
            <button type="submit" disabled={busy} style={principal(accent, lista(caja, caja2) && !busy)}>
              {busy ? "Guardando…" : "Guardar y entrar"}
            </button>
            <button type="button" onClick={() => { setPaso(1); setError(null); }} style={{ ...botonSecundario, width: "100%", marginTop: 8 }}>
              Volver
            </button>
          </form>
        )}

        <p style={{ fontSize: 12, color: C.tenue, textAlign: "center", marginTop: 14 }}>
          Este enlace solo sirve una vez. Las contraseñas que te hayan dado antes dejarán de valer.
        </p>
      </div>
    </main>
  );
}

function Clave({ id, valor, onChange, ver, setVer, autoFocus }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        type={ver ? "text" : "password"}
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus={autoFocus}
        style={{ ...campo, minWidth: 0 }}
      />
      {/* Un solo «Ver», en la primera: enseña las dos, que es cuando se ve en qué no coinciden. */}
      {setVer && (
        <button type="button" onClick={() => setVer((v) => !v)} style={{ ...botonSecundario, flexShrink: 0 }}>
          {ver ? "Ocultar" : "Ver"}
        </button>
      )}
    </div>
  );
}

function Coinciden({ clave, repetida }) {
  const a = clave.trim();
  const b = repetida.trim();
  const [color, frase] =
    b && a === b ? [C.ok, "Son iguales."]
    : b.length >= a.length && b ? [C.mal, "No es igual que la de arriba."]
    : [C.tenue, "Otra vez, para saber que está bien escrita."];
  return <div style={{ fontSize: 12, color, marginTop: 6 }}>{frase}</div>;
}

function Ayuda({ valor }) {
  const faltan = MIN - valor.trim().length;
  return (
    <div style={{ fontSize: 12, color: faltan > 0 ? C.tenue : C.ok, marginTop: 6 }}>
      {faltan > 0 ? `Al menos ${MIN} caracteres${valor ? ` (faltan ${faltan})` : ""}. Mejor una frase que una palabra rara.` : "Vale."}
    </div>
  );
}

// Lo mismo que comprueba el servidor, para avisar antes de enviar. Que las dos sean
// iguales solo se mira aquí: al servidor llega una. Se comparan sin los espacios de
// los lados, que el servidor también quita (normalizarClave en lib/claves.js).
function revisar(clave, repetida, usuario) {
  const s = clave.trim();
  if (s.length < MIN) return `Tiene que tener al menos ${MIN} caracteres.`;
  if (s.toLowerCase() === usuario.toLowerCase()) return "No puede ser igual que el usuario.";
  if (/^(.)\1+$/.test(s)) return "No puede ser el mismo carácter repetido.";
  if (!repetida.trim()) return "Escríbela otra vez en «Repítela».";
  if (repetida.trim() !== s) return "Las dos no son iguales. Con «Ver» puedes mirarlas.";
  return null;
}

const lista = (clave, repetida) => clave.trim().length >= MIN && repetida.trim() === clave.trim();

const titulo = { fontSize: "1.35rem", fontWeight: 650, margin: "0 0 6px", letterSpacing: "-0.01em" };
const texto = { color: C.suave, fontSize: 14, lineHeight: 1.5, margin: "0 0 4px" };
const usuarioFijo = {
  padding: "0.6rem 0.75rem", borderRadius: 10, background: C.panelSuave, border: `1px solid ${C.borde}`,
  fontFamily: "ui-monospace, Menlo, monospace", fontSize: 15,
};
const pasos = { display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "0 0 12px" };
const pasoEstilo = (activo, hecho, accent) => ({
  flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600, padding: "8px 6px", borderRadius: 10,
  border: `1px solid ${activo ? accent : C.borde}`, background: activo ? `${accent}14` : C.panel,
  color: activo ? legible(accent) : hecho ? C.ok : C.tenue,
});
const principal = (accent, listo) => ({
  marginTop: 18, width: "100%", padding: "0.75rem 1.2rem", borderRadius: 10, border: 0,
  background: accent, color: "#fff", fontWeight: 600, fontSize: 15,
  opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "default",
});
