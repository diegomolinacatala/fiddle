import { EsqueletoGestion, PanelHueso } from "@/app/Esqueleto";

// Mientras el servidor lee el negocio: las tres columnas del manager en gris.
export default function Cargando() {
  return (
    <EsqueletoGestion>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
        <PanelHueso lineas={6} />
        <PanelHueso alto={420} />
        <PanelHueso lineas={4} />
      </div>
    </EsqueletoGestion>
  );
}
