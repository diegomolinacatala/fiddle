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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {Array.from({ length: 6 }, (_, i) => <Hueso key={i} h={92} r={14} />)}
      </div>
      <PanelHueso alto={120} />
    </EsqueletoGestion>
  );
}
