"use client";

import { EsqueletoGestion, PanelHueso, Hueso } from "@/app/Esqueleto";
import { useGestion } from "../MarcoGestion";
import Solapas from "../Solapas";
import { PESTANAS } from "./pestanas";

// Mientras el servidor lee la plantilla y su historial: las pestañas ya de verdad
// (sin ninguna marcada: cuál se abre depende de si ya hay equipo), cifras y paneles en gris.
export default function Cargando() {
  const g = useGestion();
  return (
    <EsqueletoGestion margen={0}>
      <Solapas pestanas={PESTANAS} activa={null} accent={g?.tema?.accent} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {Array.from({ length: 5 }, (_, i) => <Hueso key={i} h={92} r={14} />)}
      </div>
      <PanelHueso lineas={3} />
      <div style={{ marginTop: 18 }}><PanelHueso alto={160} /></div>
    </EsqueletoGestion>
  );
}
