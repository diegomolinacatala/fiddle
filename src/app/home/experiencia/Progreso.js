import { Flecha } from "../tarjeta/controles";
import { PASOS_DEL_PANEL, indiceDe, avanceDe } from "./logica";

// Atrás siempre a mano y una barra fina que se llena con transform (no con el ancho).
export default function Progreso({ paso, alAtras }) {
  const n = indiceDe(paso) + 1;
  const total = PASOS_DEL_PANEL.length;
  return (
    <div className="exp-progreso">
      <button type="button" className="exp-atras" onClick={alAtras} disabled={n <= 1} aria-label="Paso anterior">
        <Flecha atras />
      </button>
      <div className="exp-barra" role="progressbar" aria-label="Tu avance" aria-valuemin={1} aria-valuemax={total} aria-valuenow={n} aria-valuetext={`Paso ${n} de ${total}`}>
        <i style={{ transform: `scaleX(${avanceDe(paso)})` }} />
      </div>
      <span className="exp-pasos" aria-hidden="true">{n} de {total}</span>
    </div>
  );
}
