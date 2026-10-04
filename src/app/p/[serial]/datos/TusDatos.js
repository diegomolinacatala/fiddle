"use client";

import { useCallback, useEffect, useState } from "react";
import Icono from "@/app/Icono";
import MarcaTienda from "@/app/MarcaTienda";
import { Interruptor } from "@/app/Interruptor";
import { colorDelPase } from "@/lib/apple/dibujo";

// Lo que ve el cliente en "Tu tarjeta y tus datos". Con los colores de su
// tienda, como la tarjeta web, y en un panel blanco: son ajustes, no la tarjeta.
//
// Las promos se cambian con un interruptor y se deshacen igual: decir que no
// tiene que ser tan fácil como decir que sí (LSSI 21.2), pero no es el botón
// grande de la página. Borrar sí pide confirmar: no se puede deshacer.

const llaveDeLaUrl = () => {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return /^[A-Za-z0-9_-]{16,64}$/.test(h) ? h : null;
};

export default function TusDatos({ serial, tienda }) {
  const t = tienda.tema;
  const accent = colorDelPase(t);
  const [estado, setEstado] = useState({ fase: "cargando" });
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState(null);

  const pedir = useCallback(async (cuerpo) => {
    const r = await fetch(`/api/tarjeta/${serial}/datos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ llave: llaveDeLaUrl(), ...cuerpo }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      const e = new Error(d.error || "No se ha podido. Prueba otra vez.");
      e.status = r.status;
      throw e;
    }
    return r;
  }, [serial]);

  useEffect(() => {
    pedir({ accion: "ver" })
      .then((r) => r.json())
      .then((d) => setEstado({ fase: "lista", ...d }))
      .catch((e) => setEstado({ fase: e.status === 403 ? "sin-acceso" : e.status === 410 ? "borrada" : "error", mensaje: e.message }));
  }, [pedir]);

  async function hacer(fn) {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof TypeError ? "Sin conexión. Prueba otra vez." : e.message);
    } finally {
      setOcupado(false);
    }
  }

  const cambiarPromos = () => hacer(async () => {
    const d = await (await pedir({ accion: "promos", quiere: !estado.promos })).json();
    setEstado((x) => ({ ...x, promos: d.promos }));
  });

  const descargar = () => hacer(async () => {
    const blob = await (await pedir({ accion: "descargar" })).blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `datos-tarjeta-${estado.codigo || tienda.slug}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const borrar = () => hacer(async () => {
    await pedir({ accion: "borrar" });
    setEstado({ fase: "borrada-ahora" });
  });

  return (
    <main style={{ ...pagina, background: t.pageBg, color: t.pageInk }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <MarcaTienda tema={t} tam={56} icono style={{ margin: "0 auto", borderRadius: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 650, margin: "16px 0 4px", letterSpacing: "-0.015em" }}>Tu tarjeta y tus datos</h1>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 15 }}>{tienda.nombre}{estado.codigo ? ` · ${estado.codigo}` : ""}</p>
        </header>

        <section style={panel}>
          {estado.fase === "cargando" && <p style={texto}>Un momento…</p>}

          {estado.fase === "sin-acceso" && (
            <>
              <p style={{ ...texto, fontWeight: 600, color: "#1b1e23" }}>No podemos comprobar que esta tarjeta es tuya</p>
              <p style={texto}>
                Ábrelo desde tu tarjeta: en Apple Wallet, toca la (i) y «Promos, descargar o borrar»;
                en Google Wallet, «Tu tarjeta y tus datos». O desde el móvil con el que la sacaste.
              </p>
              <p style={{ ...texto, marginBottom: 0 }}>También puedes pedirlo en {tienda.nombre} con el código de tu tarjeta.</p>
            </>
          )}

          {estado.fase === "error" && <p role="alert" style={{ ...texto, color: "#b42318", marginBottom: 0 }}>{estado.mensaje}</p>}

          {(estado.fase === "borrada" || estado.fase === "borrada-ahora") && (
            <>
              <p style={{ ...texto, fontWeight: 600, color: "#1b1e23" }}>Tarjeta borrada</p>
              <p style={{ ...texto, marginBottom: 0 }}>
                Hemos borrado tu tarjeta de {tienda.nombre} y sus datos. En unos minutos saldrá como caducada
                en tu Wallet: ya puedes quitarla. Si vuelves, te damos una nueva.
              </p>
            </>
          )}

          {estado.fase === "lista" && (
            <div style={{ display: "grid", gap: 12 }}>
              <Fila icono={estado.promos ? "campana" : "campanaNo"} accent={accent} titulo="Promos de la tienda"
                texto={estado.promos
                  ? "Te llegan sus ofertas y avisos. Los de tus sellos y premios, siempre."
                  : "No te llegan ofertas ni avisos de la tienda. Los de tus sellos y premios, sí."}>
                <Interruptor on={estado.promos} onClick={cambiarPromos} accent={accent} disabled={ocupado} etiqueta="Promos de la tienda" />
              </Fila>

              <Fila icono="descargar" accent={accent} titulo="Descargar mis datos" texto="Todo lo que guardamos de ti: tu tarjeta, tu historial y los avisos que te llegaron.">
                <button type="button" onClick={descargar} disabled={ocupado} style={botonSuave}>Descargar</button>
              </Fila>

              <div style={{ borderTop: "1px solid #e4e7ec", paddingTop: 12 }}>
                {!confirmar ? (
                  <Fila icono="papelera" accent="#b42318" titulo="Borrar mi tarjeta" texto="Se borran tus sellos, tus premios y tus datos. No se puede deshacer.">
                    <button type="button" onClick={() => setConfirmar(true)} disabled={ocupado} style={{ ...botonSuave, color: "#b42318" }}>Borrar</button>
                  </Fila>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <p style={{ ...texto, margin: 0, color: "#1b1e23" }}>
                      <strong>¿Seguro?</strong> Pierdes los sellos y premios que tengas en {tienda.nombre}, y no se pueden recuperar.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={borrar} disabled={ocupado} style={botonPeligro}>{ocupado ? "Borrando…" : "Sí, borrar mi tarjeta"}</button>
                      <button type="button" onClick={() => setConfirmar(false)} disabled={ocupado} style={botonSuave}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
              {error && <p role="alert" style={{ ...texto, color: "#b42318", margin: 0 }}>{error}</p>}
            </div>
          )}
        </section>

        <p style={{ textAlign: "center", fontSize: 13, marginTop: 20, display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
          {estado.fase !== "borrada-ahora" && estado.fase !== "borrada" && (
            <a href={`/p/${serial}`} style={{ color: "inherit", opacity: 0.75 }}>Volver a mi tarjeta</a>
          )}
          <a href={`/privacidad?b=${tienda.slug}`} style={{ color: "inherit", opacity: 0.75 }}>Privacidad</a>
        </p>
      </div>
    </main>
  );
}

function Fila({ icono, accent, titulo, texto: cuerpo, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0, color: accent, background: `${accent}1a` }}>
        <Icono nombre={icono} tam={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1b1e23" }}>{titulo}</div>
        <div style={{ fontSize: 13, color: "#5c6371", marginTop: 2, lineHeight: 1.35 }}>{cuerpo}</div>
      </div>
      {children}
    </div>
  );
}

const pagina = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "max(28px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom))",
};
const panel = {
  padding: 16,
  borderRadius: 20,
  background: "rgba(255,255,255,.96)",
  color: "#1b1e23",
  boxShadow: "0 10px 30px -14px rgba(0,0,0,.35)",
};
const texto = { fontSize: 14, lineHeight: 1.5, color: "#5c6371", margin: "0 0 10px" };
const botonSuave = {
  border: "1px solid #cbd1d9", borderRadius: 12, padding: "0.5rem 0.9rem", minHeight: 40,
  background: "#fff", color: "#1b1e23", fontWeight: 500, fontSize: 14, cursor: "pointer", flexShrink: 0,
};
const botonPeligro = { ...botonSuave, background: "#b42318", borderColor: "#b42318", color: "#fff", fontWeight: 600 };
