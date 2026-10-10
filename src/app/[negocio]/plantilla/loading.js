import { EsqueletoGestion, PanelHueso, Hueso } from "@/app/Esqueleto";

// Mientras el servidor lee la plantilla y su historial: pestañas, cifras y paneles en gris.
export default function Cargando() {
  return (
    <EsqueletoGestion>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Hueso w={90} h={34} r={10} />
        <Hueso w={130} h={34} r={10} />
        <Hueso w={100} h={34} r={10} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {Array.from({ length: 5 }, (_, i) => <Hueso key={i} h={92} r={14} />)}
      </div>
      <PanelHueso lineas={3} />
      <div style={{ marginTop: 18 }}><PanelHueso alto={160} /></div>
    </EsqueletoGestion>
  );
}
