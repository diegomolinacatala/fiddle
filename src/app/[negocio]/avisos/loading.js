"use client";

import { EsqueletoGestion, PanelHueso } from "@/app/Esqueleto";
import { useGestion } from "../MarcoGestion";
import Solapas from "../Solapas";
import { pestanasDe, primeraDe } from "./pestanas";

// Mientras el servidor mira qué avisos tocan: las pestañas ya de verdad y las tarjetas en gris.
export default function Cargando() {
  const g = useGestion();
  const avanzados = g?.avisosAvanzados === true;
  return (
    <EsqueletoGestion margen={0}>
      <Solapas pestanas={pestanasDe(avanzados)} activa={primeraDe(avanzados)} accent={g?.tema?.accent} />
      <div style={{ display: "grid", gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => <PanelHueso key={i} lineas={2} />)}
      </div>
    </EsqueletoGestion>
  );
}
