"use client";

import { camposDelPase } from "@/lib/apple/pase";
import { stripDelPase, comoDataUri, colorDelPase } from "@/lib/apple/dibujo";
import { temaPorDefecto, estilosDelKit } from "@/lib/negocios";
import { ROTULO_PLANTILLA } from "@/app/admin/vistas";
import { LogoApple } from "@/app/LogoTienda";
import { C } from "@/app/ui";

// ============================================================================
// LOS DISEÑOS DE SU MARCA (Editar tarjeta → Colores)
// ----------------------------------------------------------------------------
// Una tienda con kit de marca (lib/kits.js) elige entre los diseños hechos con
// su manual antes que entre plantillas de otros negocios. Cada uno se enseña
// como una tarjeta pequeña con SU nombre, SUS cartillas y el cliente de
// ejemplo: cabecera, banda y fila, con las funciones del pase de verdad
// (stripDelPase, camposDelPase). Nada de muestras de color sueltas: lo que se
// elige es cómo se verá en el teléfono.
// ============================================================================

/**
 * @param {{ d: object, slug: string, cliente: object, plantilla: (estilo: string) => void }} props
 */
export default function DisenosDeMarca({ d, slug, cliente, plantilla }) {
  const estilos = estilosDelKit(slug);
  if (!estilos.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 8, marginTop: 8 }}>
      {estilos.map((estilo) => {
        const elegido = d.tema.estilo === estilo;
        return (
          <button key={estilo} type="button" onClick={() => plantilla(estilo)} aria-pressed={elegido} style={opcion(elegido)}>
            <MiniTarjeta negocio={{ ...d, tema: temaDeDiseno(estilo, d.tema) }} cliente={cliente} />
            <span style={{ fontSize: 12, lineHeight: 1.25, fontWeight: elegido ? 650 : 500, color: elegido ? C.texto : C.suave }}>
              {ROTULO_PLANTILLA[estilo] || estilo}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** El tema del diseño con lo que no cambia al elegirlo (como `plantilla` en el editor). */
const temaDeDiseno = (estilo, actual) => ({ ...temaPorDefecto({ estilo }), logoImagen: actual.logoImagen ?? null });

/** La tarjeta de Apple en pequeño: logo y nombre, la banda y la fila de debajo. */
function MiniTarjeta({ negocio, cliente }) {
  const t = negocio.tema;
  const { secondaryFields, auxiliaryFields } = camposDelPase(cliente, negocio);
  const fila = [...secondaryFields, ...auxiliaryFields].slice(0, 2);
  return (
    <span style={{ display: "block", width: "100%", borderRadius: 8, overflow: "hidden", background: t.cardBg, color: t.ink, textAlign: "left", boxShadow: "0 1px 3px rgba(16,20,28,.18)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 7px 5px" }}>
        <LogoApple tema={t} tam={16} />
        <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{negocio.nombre}</span>
      </span>
      <img src={comoDataUri(stripDelPase(negocio, cliente).svg)} alt="" style={{ display: "block", width: "100%", height: "auto" }} />
      <span style={{ display: "flex", justifyContent: "space-between", gap: 6, padding: "4px 7px 7px" }}>
        {fila.map((f) => (
          <span key={f.key} style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 7, fontWeight: 600, letterSpacing: 0.3, color: colorDelPase(t), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</span>
            <span style={{ display: "block", fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.value}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

const opcion = (activa) => ({
  display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, padding: 6, borderRadius: 12, cursor: "pointer",
  textAlign: "center", minWidth: 0, border: `2px solid ${activa ? "#2563eb" : "transparent"}`, background: activa ? "#eff4ff" : C.panelSuave,
});
