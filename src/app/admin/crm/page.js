"use client";

import MarcaTienda from "@/app/MarcaTienda";
import { useEffect, useState } from "react";
import LogoutButton from "@/app/LogoutButton";
import { cadenciaTexto } from "@/lib/crm";
import { C, pagina, panel, h2, titulo, botonPequeno } from "@/app/ui";

// ============================================================================
// CRM DE LA PLATAFORMA — las tiendas, comparadas
// ----------------------------------------------------------------------------
// El manager de cada tienda mira la suya; aquí se miran todas juntas, que es
// otra pregunta: cuál crece, cuál se apaga y cuál no consigue que la gente
// llegue a instalar el pase. Desde cada fila se entra a su CRM.
// ============================================================================

const AZUL = "#2563eb";

export default function AdminCRM() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/crm")
      .then((r) => r.json().then((x) => (r.ok ? x : Promise.reject(new Error(x.error)))))
      .then(setD)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  if (error) return <main style={pagina}><p style={{ color: C.mal }}>{error}</p></main>;
  if (!d) return <main style={pagina}><p style={{ color: C.suave }}>Cargando…</p></main>;

  const t = d.totales;

  return (
    <main style={pagina}>
      <div style={{ width: "min(1060px, 96vw)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={titulo}>Clientes de la plataforma</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/admin" style={{ ...botonPequeno, textDecoration: "none" }}>← Tiendas</a>
            <LogoutButton />
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, margin: "18px 0" }}>
          <Total label="Clientes" valor={t.total} />
          <Total label="Activos" valor={t.activos} color={C.ok} />
          <Total label="En riesgo" valor={t.enRiesgo} color={t.enRiesgo ? "#c26b04" : C.texto} />
          <Total label="Altas (30 d)" valor={t.nuevos30} />
          <Total label="Visitas (30 d)" valor={t.visitas30} />
          <Total label="Instalan el pase" valor={`${t.tasaInstalacion}%`} />
        </div>

        <section style={panel}>
          <h2 style={h2}>Tienda por tienda</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Tienda", "Clientes", "Activos", "En riesgo", "Altas 30d", "Visitas 30d", "Instalan", "Vuelven", "Ritmo", ""].map((x) => (
                    <th key={x} style={th}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.tiendas.map((s) => (
                  <tr key={s.slug}>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {s.tema && <MarcaTienda tema={s.tema} tam={22} icono />}
                        <strong style={{ fontWeight: 600 }}>{s.nombre}</strong>
                      </span>
                      <div style={{ fontSize: 11, color: C.tenue }}>/{s.slug}</div>
                    </td>
                    <td style={td}>{s.metricas.total}</td>
                    <td style={{ ...td, color: C.ok, fontWeight: 600 }}>{s.metricas.activos}</td>
                    <td style={{ ...td, color: s.metricas.enRiesgo ? "#c26b04" : C.suave }}>{s.metricas.enRiesgo}</td>
                    <td style={td}>{s.metricas.nuevos30}</td>
                    <td style={td}>{s.metricas.visitas30}</td>
                    <td style={td}><Barra pct={s.metricas.tasaInstalacion} color={s.accent} /></td>
                    <td style={td}><Barra pct={s.metricas.tasaVuelta} color={s.accent} /></td>
                    <td style={{ ...td, color: C.suave }}>{cadenciaTexto(s.metricas.cadenciaMedia)}</td>
                    <td style={td}>
                      <a href={`/${s.slug}/crm`} style={{ ...botonPequeno, textDecoration: "none", whiteSpace: "nowrap" }}>Ver</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.tiendas.length && <p style={{ color: C.suave, fontSize: 14 }}>Todavía no hay tiendas.</p>}
        </section>

        <p style={{ fontSize: 13, color: C.suave, marginTop: 14 }}>
          «Instalan»: pases emitidos que acabaron en un Wallet. «Vuelven»: clientes con más de una visita.
        </p>
      </div>
    </main>
  );
}

function Total({ label, valor, color }) {
  return (
    <div style={{ ...panel, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 650, color: color || AZUL, marginTop: 6, lineHeight: 1 }}>{valor}</div>
    </div>
  );
}

function Barra({ pct, color }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 46, height: 7, background: C.borde, borderRadius: 4, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: color }} />
      </span>
      <span style={{ fontSize: 12, color: C.suave }}>{pct}%</span>
    </span>
  );
}

const th = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase",
  letterSpacing: 0.6, padding: "0 10px 8px 0", borderBottom: `1px solid ${C.borde}`, whiteSpace: "nowrap",
};
const td = { padding: "10px 10px 10px 0", borderBottom: `1px solid ${C.borde}`, verticalAlign: "middle" };
