import { EsqueletoGestion, PanelHueso } from "@/app/Esqueleto";

// Mientras el servidor lee el negocio: el panel de ajustes en gris.
export default function Cargando() {
  return (
    <EsqueletoGestion>
      <div style={{ maxWidth: 640 }}>
        <PanelHueso lineas={3} />
      </div>
    </EsqueletoGestion>
  );
}
