"use client";

import { EsqueletoGestion, PanelHueso, Hueso } from "@/app/Esqueleto";
import { useGestion } from "../MarcoGestion";
import Solapas from "../Solapas";
import { PESTANAS } from "./pestanas";

// Mientras el servidor calcula el CRM: las pestañas ya de verdad, cifras y paneles en gris.
export default function Cargando() {
  const g = useGestion();
  return (
    <EsqueletoGestion margen={0}>
      <Solapas pestanas={PESTANAS} activa="resumen" accent={g?.tema?.accent} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12, marginBottom: 18 }}>
        {Array.from({ length: 4 }, (_, i) => <Hueso key={i} h={104} r={14} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 18 }}>
        <PanelHueso alto={220} />
        <PanelHueso alto={220} />
      </div>
    </EsqueletoGestion>
  );
}
