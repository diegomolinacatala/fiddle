"use client";

import { useEffect, useState } from "react";
import { FilaInterruptor } from "@/app/Interruptor";
import { IDS_PLAN, FUNCIONES } from "@/lib/planes";
import { C, panel, h2, campo, etiqueta, botonPrimario, botonSecundario } from "@/app/ui";

// ============================================================================
// PLATAFORMA → PLANES (lib/planes.js)
// ----------------------------------------------------------------------------
// Lo que lleva cada plan, para TODAS las tiendas: el límite de tarjetas con su
// margen y qué funciones van dentro. Se edita aquí y se guarda junto (PUT
// /api/admin/planes). El plan de cada tienda se elige en su ficha.
//
// Ojo con lo que dice la web (/home, app/home/datos.js): es estática y no lee
// esto. Si un plan cambia aquí, cambiar también lo que la web promete.
// ============================================================================

export default function Planes({ accent, flash }) {
  const [guardados, setGuardados] = useState(null);
  const [planes, setPlanes] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/planes").then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudieron cargar");
      setGuardados(d);
      setPlanes(d);
    }).catch((e) => setError(String(e?.message || e)));
  }, []);

  if (error) return <p style={{ color: C.mal }}>{error}</p>;
  if (!planes) return <p style={{ color: C.suave }}>Cargando…</p>;

  const cambiado = JSON.stringify(planes) !== JSON.stringify(guardados);
  const poner = (id, cambio) => setPlanes((p) => ({ ...p, [id]: { ...p[id], ...cambio } }));
  const ponerFuncion = (id, f, valor) => setPlanes((p) => ({ ...p, [id]: { ...p[id], funciones: { ...p[id].funciones, [f]: valor } } }));

  async function guardar() {
    setGuardando(true);
    try {
      const cuerpo = Object.fromEntries(IDS_PLAN.map((id) => [id, {
        maxTarjetas: planes[id].maxTarjetas, margen: planes[id].margen, funciones: planes[id].funciones,
      }]));
      const r = await fetch("/api/admin/planes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "No se pudo guardar");
      setGuardados(d);
      setPlanes(d);
      flash("Planes guardados. Las tarjetas lo recogen la próxima vez que se pongan al día.");
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div id="planes" style={{ display: "grid", gap: 14 }}>
      <p style={{ fontSize: 13.5, color: C.suave, margin: 0, lineHeight: 1.5 }}>
        Lo que lleva cada plan, para todas las tiendas. El plan de cada una se elige en su ficha; una tienda sin plan
        elegido cuenta como Pro. Apagar algo aquí no borra nada en ninguna tienda: vuelve al encenderlo.
        Lo que dice la web de precios no cambia solo: si cambias un plan, cámbialo también allí.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14, alignItems: "start" }}>
        {IDS_PLAN.map((id) => {
          const p = planes[id];
          const conLimite = p.maxTarjetas !== null;
          return (
            <section key={id} style={panel}>
              <h2 style={h2}>{p.nombre}</h2>
              <FilaInterruptor
                on={conLimite} accent={accent} icono="credencial"
                titulo={conLimite ? "Con límite de tarjetas" : "Tarjetas sin límite"}
                texto={conLimite ? "Avisa al dueño al 90 % y al llegar. Con el margen, se siguen dando unas pocas." : "Las que hagan falta."}
                onClick={() => poner(id, conLimite ? { maxTarjetas: null, margen: 0 } : { maxTarjetas: 500, margen: 50 })}
              />
              {conLimite && (
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <label style={etiqueta} htmlFor={`max-${id}`}>Límite</label>
                    <input id={`max-${id}`} type="number" min={1} step={1} value={p.maxTarjetas ?? ""} style={campo}
                      onChange={(e) => poner(id, { maxTarjetas: e.target.value === "" ? 0 : Math.floor(Number(e.target.value)) })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={etiqueta} htmlFor={`margen-${id}`}>Margen</label>
                    <input id={`margen-${id}`} type="number" min={0} step={1} value={p.margen} style={campo}
                      onChange={(e) => poner(id, { margen: e.target.value === "" ? 0 : Math.floor(Number(e.target.value)) })} />
                  </div>
                </div>
              )}
              {conLimite && p.maxTarjetas > 0 && (
                <p style={{ fontSize: 12.5, color: C.tenue, margin: "8px 0 0", lineHeight: 1.4 }}>
                  A partir de {p.maxTarjetas + p.margen} tarjetas, quien escanea ve «pregunta en el mostrador». Las que ya existen siguen funcionando.
                </p>
              )}
              <div style={{ marginTop: 12, display: "grid", gap: 2 }}>
                {FUNCIONES.map((f) => (
                  <FilaInterruptor
                    key={f.id} on={p.funciones[f.id]} accent={accent} titulo={f.nombre} texto={f.texto}
                    onClick={() => ponerFuncion(id, f.id, !p.funciones[f.id])}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={guardar} disabled={!cambiado || guardando} aria-busy={guardando || undefined}
          style={{ ...botonPrimario(accent), opacity: cambiado ? 1 : 0.45 }}>
          {guardando ? "Guardando…" : "Guardar los planes"}
        </button>
        {cambiado && <button type="button" onClick={() => setPlanes(guardados)} style={botonSecundario}>Descartar</button>}
      </div>
    </div>
  );
}
