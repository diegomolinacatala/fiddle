"use client";

import Guardar from "../tarjeta/Guardar";
import { limpiar } from "../tarjeta/opciones";
import { RUTA_ALTA, TARJETAS_GRATIS } from "../datos";
import { useTarjeta } from "./Tarjeta";
import Cabeza from "./Cabeza";

export const CLAVE_ELECCION = "fiddle:eleccion";

// Lo principal es empezar gratis con esta tarjeta: se lleva lo elegido a /alta y allí
// se recoge. Dejar un contacto queda como salida para quien prefiere que le llamemos.
export default function PasoGuarda({ ir }) {
  const { e, guardar } = useTarjeta();

  const empezar = () => {
    // Sin storage (modo privado, bloqueado) se va igual: solo se pierde el diseño.
    try {
      sessionStorage.setItem(CLAVE_ELECCION, JSON.stringify(limpiar(e)));
    } catch {}
    window.location.assign(RUTA_ALTA);
  };

  return (
    <div className="exp-cuerpo exp-guarda">
      <Cabeza titulo="Guárdala" pista={`Gratis, con todo y hasta ${TARJETAS_GRATIS} tarjetas. La tienes en tu cafetería en unos minutos.`} />
      <button type="button" className="prob-siguiente prob-ancho exp-empezar" onClick={empezar}>
        Empezar gratis con esta tarjeta
      </button>
      <details className="exp-llamar">
        <summary className="exp-enlace">¿Prefieres que te llamemos?</summary>
        <Guardar eleccion={e} alGuardar={(contacto) => { guardar(contacto); ir("precios"); }} />
      </details>
      <div className="exp-precios">
        <button type="button" className="exp-enlace" onClick={() => ir("precios")}>Ver antes los precios</button>
      </div>
    </div>
  );
}
