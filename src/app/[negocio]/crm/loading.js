"use client";

import { useParams } from "next/navigation";
import { EsqueletoGestion, PanelHueso, Hueso } from "@/app/Esqueleto";
import { useGestion } from "../MarcoGestion";
import Solapas from "../Solapas";
import { pestanasDe } from "./pestanas";
import PanelCrm from "./PanelCrm";

// Mientras el servidor calcula el CRM. Si en esta visita ya se vio Clientes, se
// pinta lo de entonces (MarcoGestion, `memoria`) y en cuanto llega lo nuevo rueda
// hasta ello; si no, las pestañas ya de verdad y cifras y paneles en gris.
export default function Cargando() {
  const g = useGestion();
  const { negocio: slug } = useParams();
  const recuerdo = g?.memoria?.get(`crm:${slug}`);
  if (recuerdo?.d) return <PanelCrm slug={slug} inicial={recuerdo.d} deMemoria />;
  return (
    <EsqueletoGestion margen={0}>
      <Solapas pestanas={pestanasDe(g?.funciones)} activa={pestanasDe(g?.funciones)[0][0]} accent={g?.tema?.accent} />
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
