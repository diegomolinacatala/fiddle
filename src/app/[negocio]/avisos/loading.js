import { EsqueletoGestion, PanelHueso, Hueso } from "@/app/Esqueleto";

// Mientras el servidor mira qué avisos tocan: pestañas y tarjetas de reglas en gris.
export default function Cargando() {
  return (
    <EsqueletoGestion>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Hueso w={120} h={34} r={10} />
        <Hueso w={120} h={34} r={10} />
        <Hueso w={100} h={34} r={10} />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => <PanelHueso key={i} lineas={2} />)}
      </div>
    </EsqueletoGestion>
  );
}
