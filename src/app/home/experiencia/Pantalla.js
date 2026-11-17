"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LogoFiddle from "@/app/LogoFiddle";
import { PALETA } from "../paleta";
import { useAltoVisible, useReducirMovimiento } from "../tarjeta/movimiento";
import Escena from "../tarjeta/Escena";
import { useTarjeta } from "./Tarjeta";
import { pasoPorId, anteriorDe } from "./logica";
import useTeclado from "./useTeclado";
import Progreso from "./Progreso";
import PasoHola from "./PasoHola";
import PasoElegir from "./PasoElegir";
import PasoPrueba from "./PasoPrueba";
import PasoGuarda from "./PasoGuarda";
import AvisoEnEscena from "./AvisoEnEscena";
import Cliente from "./Cliente";
import useComposicion from "./useComposicion";

const SIN_DESPLAZO = { x: 0, y: 0 };

// Tocar una parte de la tarjeta lleva a su paso (salvo en la prueba y al guardar).
const PASO_DE_PARTE = { cabecera: "hola", banda: "puntos", campos: "icono" };
const PASOS_QUIETOS = ["prueba", "guarda"];

// La pantalla fija: la tarjeta en escena y, debajo o al lado, UN paso cada vez.
export default function Pantalla({ paso, sentido, ir }) {
  const { qr, e, tema, puntos, promo, aviso } = useTarjeta();
  const quieto = useReducirMovimiento();
  const teclado = useTeclado();
  const [enCampo, setEnCampo] = useState(false); // el cursor está en el nombre
  const [pedirFoco, setPedirFoco] = useState(false);
  const raiz = useRef(null);
  const escena = useRef(null);
  const movil = useRef(null); // el móvil del cliente: de ahí saltan los avisos
  const composicion = useComposicion();
  const primera = useRef(true);
  useAltoVisible(raiz);

  const latido = useCallback(() => escena.current?.latido(), []);
  const alEnfocar = useCallback(() => setPedirFoco(false), []);

  // Al cambiar de paso, el foco va al título: lector de pantalla y teclado siguen el hilo.
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (pedirFoco) return;
    raiz.current?.querySelector("[data-titulo]")?.focus({ preventScroll: true });
    // Solo al cambiar de paso, no cuando se apaga `pedirFoco`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  const alTocarParte = (parte) => {
    const destino = PASO_DE_PARTE[parte];
    if (!destino || PASOS_QUIETOS.includes(paso)) return;
    if (destino === "hola") setPedirFoco(true);
    ir(destino);
  };

  const actual = pasoPorId(paso);
  const parte = paso === "hola" && enCampo ? "cabecera" : actual.parte;
  const enPrueba = paso === "prueba";

  return (
    <div
      ref={raiz}
      className={`prob prob-pagina exp exp-en-${paso}${quieto ? " prob-quieto" : ""}${teclado ? " exp-teclado" : ""}`}
      style={{ "--tono": tema.accent, "--tono-2": tema.cardBg }}
    >
      <header className="prob-arriba">
        {/* La experiencia vive aparte de la web: el logo vuelve a ella, no al primer paso. */}
        <a href="/home" className="prob-volver" aria-label="Volver a la web de fiddle">
          <LogoFiddle tam={24} color={PALETA.verde} id="efe-experiencia" />
        </a>
        <a href="/login" className="exp-entrar">Entrar</a>
      </header>

      <div className="prob-halo" aria-hidden="true" />
      <Escena ref={escena} role="group" aria-label="Vista previa de tu tarjeta" eleccion={e} puntos={puntos} promo={promo} parte={parte} qr={qr} alTocarParte={alTocarParte}
        escala={enPrueba ? composicion.escala : 1} desplaza={enPrueba ? composicion.desplaza : SIN_DESPLAZO}>
        <Cliente presente={enPrueba} suena={aviso.n} movilRef={movil} />
        <AvisoEnEscena visible={enPrueba} movilRef={movil} />
      </Escena>

      <aside className="prob-panel exp-panel" aria-label="La demo de tu tarjeta">
        <Progreso paso={paso} alAtras={() => ir(anteriorDe(paso))} />
        <section key={paso} className={`exp-paso ${sentido > 0 ? "desde-dcha" : "desde-izda"}`}>
          {cuerpoDe({ paso: actual, ir, latido, quieto, pedirFoco, alEnfocar, setEnCampo })}
        </section>
      </aside>
    </div>
  );
}

function cuerpoDe({ paso, ir, latido, quieto, pedirFoco, alEnfocar, setEnCampo }) {
  if (paso.id === "hola") return <PasoHola seguir={() => ir("premios")} pedirFoco={pedirFoco} alEnfocar={alEnfocar} alFoco={setEnCampo} />;
  if (paso.id === "prueba") return <PasoPrueba ir={ir} latido={latido} />;
  if (paso.id === "guarda") return <PasoGuarda ir={ir} />;
  return <PasoElegir key={paso.id} paso={paso} ir={ir} latido={latido} quieto={quieto} />;
}
