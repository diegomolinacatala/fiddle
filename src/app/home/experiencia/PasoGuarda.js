"use client";

import Guardar from "../tarjeta/Guardar";
import { PLANES } from "../datos";
import { useTarjeta } from "./Tarjeta";
import Cabeza from "./Cabeza";

const DESDE = Math.min(...PLANES.map((p) => p.precio));

// Dejar el contacto abre los precios. Quien quiera verlos antes, tiene su enlace.
export default function PasoGuarda({ ir }) {
  const { e, guardar } = useTarjeta();
  return (
    <div className="exp-cuerpo exp-guarda">
      <Cabeza titulo="Guárdala" pista="Déjanos un email o un teléfono y la ponemos en marcha en tu cafetería. Con uno basta." />
      <Guardar eleccion={e} alGuardar={(contacto) => { guardar(contacto); ir("precios"); }} />
      <div className="exp-precios">
        <p>Tres planes, desde {DESDE} € al mes</p>
        <button type="button" className="exp-enlace" onClick={() => ir("precios")}>Ver antes los precios</button>
      </div>
    </div>
  );
}
