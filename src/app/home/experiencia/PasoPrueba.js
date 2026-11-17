"use client";

import Icono from "@/app/Icono";
import { META_WEB } from "../tarjeta/opciones";
import { useTarjeta } from "./Tarjeta";
import { cartillaLlena } from "./logica";
import Cabeza from "./Cabeza";

// El momento clave: dos teclas, como en el mostrador. Una suma un punto y la otra
// manda una promoción; las dos hacen llegar un aviso al móvil del cliente, que no está aquí.
export default function PasoPrueba({ ir, latido }) {
  const { puntos, premios, aviso, sumar, enviarPromo } = useTarjeta();
  const llena = cartillaLlena(puntos);
  const probada = aviso.n > 0;

  const tocar = (accion) => () => {
    accion();
    latido();
    navigator.vibrate?.(12);
  };

  return (
    <>
      <div className="exp-cuerpo exp-prueba">
        <Cabeza titulo="Pruébala" pista="No está en tu cafetería. Aun así, le llegas." />
        <div className="exp-centro">
          <div className="exp-teclas">
            <button type="button" className={`exp-tecla exp-tecla-tono${probada ? "" : " exp-pulso"}`} onClick={tocar(sumar)}>
              <span className="exp-tecla-icono"><Icono nombre={llena ? "check" : "mas"} tam={22} grosor={2.4} /></span>
              <span className="exp-tecla-nombre">{llena ? "Dar el premio" : "Sumar punto"}</span>
              <span className="exp-tecla-nota">Le llega el aviso</span>
            </button>
            <button type="button" className="exp-tecla exp-tecla-marca" onClick={tocar(enviarPromo)}>
              <span className="exp-tecla-icono"><Icono nombre="megafono" tam={22} grosor={2.2} /></span>
              <span className="exp-tecla-nombre">Enviar promoción</span>
              <span className="exp-tecla-nota">A todos, estén donde estén</span>
            </button>
          </div>
          {/* Pegada a las teclas: se toca y se lee lo que ha pasado sin levantar la vista. */}
          <p key={aviso.n} className="exp-estado" aria-live="polite">{estadoDe({ aviso, puntos, premios })}</p>
        </div>
      </div>
      <div className="exp-accion">
        <button type="button" className={`exp-sigue${probada ? " exp-listo" : ""}`} onClick={() => ir("guarda")}>
          Me la quedo
        </button>
      </div>
    </>
  );
}

function estadoDe({ aviso, puntos, premios }) {
  if (aviso.tipo === "promo" && aviso.n > 0) return "Promoción enviada";
  if (aviso.n > 0 && premios > 0 && puntos === 0) return "Premio dado. Vuelta a empezar.";
  return `${puntos} de ${META_WEB} puntos`;
}
