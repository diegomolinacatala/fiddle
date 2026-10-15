"use client";

import { useEffect, useState } from "react";
import MarcaTienda from "@/app/MarcaTienda";
import { Clave, Coinciden, Ayuda, revisar, lista } from "@/app/ClaveElegida";
import { C, paginaCentrada, panel, etiqueta, aviso, botonSecundario, legible } from "@/app/ui";

// ============================================================================
// INVITACIÓN — el dueño elige sus contraseñas
// ----------------------------------------------------------------------------
// Llega aquí desde el enlace del correo (/invitacion#<token>). Según el alcance
// del enlace (lib/invitaciones.js):
//   "alta"     la tienda nueva: dos pasos, la suya (manager) y la del móvil de la
//              caja, cada una escrita dos veces (lo pidió La Delicantería: con una
//              sola no sabes si la has tecleado bien, y el enlace no se repite).
//   "manager"  perdió la suya: un solo paso, la nueva dos veces. La caja no cambia.
// Al terminar entra directo a su manager. El token vive detrás de `#`: se lee
// aquí y viaja en el cuerpo de la petición, nunca en una URL que quede en un log.
// ============================================================================

export default function Invitacion() {
  const [token, setToken] = useState(null);
  const [info, setInfo] = useState(null); // { nombre, tema, alcance, usuarios }
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

  const soloManager = info?.alcance === "manager";

  // Al volver a escribir se quita el aviso: si no, «No son iguales» sigue ahí
  // debajo de un «Son iguales.» recién arreglado.
  const escribir = (set) => (v) => { set(v); setError(null); };

  async function enviar(cuerpo) {
    setBusy(true);
    try {
      const r = await fetch("/api/invitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...cuerpo }),
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

  // Paso 1: la suya. Con alcance "manager" es también el último: se guarda ya.
  function siguiente(e) {
    e.preventDefault();
    setError(null);
    const problema = revisar(manager, manager2, info.usuarios.manager);
    if (problema) return setError(problema);
    if (soloManager) return enviar({ manager });
    setPaso(2);
  }

  function terminar(e) {
    e.preventDefault();
    setError(null);
    const problema = revisar(caja, caja2, info.usuarios.caja) || (caja.trim() === manager.trim() ? "Tiene que ser distinta de la tuya: la sabrá quien use la caja." : null);
    if (problema) return setError(problema);
    enviar({ manager, caja });
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
  const listaManager = lista(manager, manager2) && !busy;

  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(420px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {info.tema && <MarcaTienda tema={info.tema} tam={44} icono />}
          <div>
            <h1 style={{ ...titulo, margin: 0 }}>{info.nombre}</h1>
            <p style={{ ...texto, margin: 0 }}>
              {soloManager ? "Elige tu nueva contraseña y sigues donde estabas." : "Te damos la bienvenida. Dos contraseñas y listo."}
            </p>
          </div>
        </div>

        {!soloManager && (
          <ol style={pasos} aria-label="Pasos">
            <li style={pasoEstilo(paso === 1, paso > 1, accent)}>1 · La tuya</li>
            <li style={pasoEstilo(paso === 2, false, accent)}>2 · La de la caja</li>
          </ol>
        )}

        {paso === 1 && (
          <form onSubmit={siguiente} style={panel}>
            <p style={texto}>
              {soloManager
                ? <>La de antes deja de valer en cuanto guardes. La del <strong style={{ color: C.texto }}>móvil de la caja</strong> no cambia.</>
                : <>Con ella entras al <strong style={{ color: C.texto }}>manager</strong>: la tarjeta, las promos y tus clientes.</>}
            </p>
            <label style={etiqueta}>Tu usuario</label>
            <div style={usuarioFijo}>{usuarios.manager}</div>
            {/* Para que el gestor de contraseñas la guarde con su usuario. */}
            <input type="text" name="username" autoComplete="username" value={usuarios.manager} readOnly hidden />
            <label style={etiqueta} htmlFor="clave-manager">{soloManager ? "Elige tu nueva contraseña" : "Elige tu contraseña"}</label>
            <Clave id="clave-manager" valor={manager} onChange={escribir(setManager)} ver={ver} setVer={setVer} autoFocus />
            <Ayuda valor={manager} />
            <label style={etiqueta} htmlFor="clave-manager-2">Repítela</label>
            <Clave id="clave-manager-2" valor={manager2} onChange={escribir(setManager2)} ver={ver} />
            <Coinciden clave={manager} repetida={manager2} />
            {error && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error}</div>}
            <button type="submit" disabled={busy} style={principal(accent, listaManager)}>
              {soloManager ? (busy ? "Guardando…" : "Guardar y entrar") : "Siguiente"}
            </button>
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
          {soloManager
            ? "Este enlace solo sirve una vez. Tu contraseña de antes dejará de valer; la de la caja sigue igual."
            : "Este enlace solo sirve una vez. Las contraseñas que te hayan dado antes dejarán de valer."}
        </p>
      </div>
    </main>
  );
}

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
