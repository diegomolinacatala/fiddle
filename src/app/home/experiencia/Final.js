"use client";

import { useEffect, useRef } from "react";
import CaraDelPase from "@/app/CaraDelPase";
import Icono from "@/app/Icono";
import LogoFiddle from "@/app/LogoFiddle";
import Aparece from "../Aparece";
import Indicador from "../Indicador";
import { PALETA } from "../paleta";
import { Punto } from "../Trozos";
import { PLANES, enlaceWhatsApp, mensajeDePlan } from "../datos";
import { useTarjeta } from "./Tarjeta";

// ============================================================================
// LA PANTALLA FINAL: SU TARJETA, SU ESTADO Y LOS PRECIOS
// ----------------------------------------------------------------------------
// Se pinta cuando la pantalla fija del recorrido se va (guardada, o pedidos los
// precios sin guardar). Nada más: cabecera mínima, tarjeta con estado, planes y
// una línea de contacto. Estilos en estiloFinal.js (fin-…); los de los planes
// siguen siendo los de siempre (estilo.js y estiloMovil.js).
// ============================================================================

export default function Final({ alVolver }) {
  const { guardada } = useTarjeta();

  // Se viene de una pantalla fija: la página tiene que empezar arriba.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <header className="fin-cabecera">
        <a href="/" className="fin-marca" aria-label="fiddle, inicio">
          <LogoFiddle tam={26} color={PALETA.verde} id="lacre-final" />
        </a>
        <a href="/" className="fin-entrar">Entrar</a>
      </header>

      <main>
        <Estado guardada={guardada} alVolver={alVolver} />
        <Precios />
      </main>

      <footer className="fin-pie">
        <p>
          ¿Prefieres hablarlo?{" "}
          <a href={enlaceWhatsApp()} target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>
        </p>
        <p className="fin-letra">
          © {new Date().getFullYear()} fiddle <a href="/privacidad">Privacidad</a>
        </p>
      </footer>
    </>
  );
}

function Estado({ guardada, alVolver }) {
  const { tarjeta, tema, qr } = useTarjeta();
  const titulo = useRef(null);

  // El formulario que se tocó ya no existe: el foco pasa al título.
  useEffect(() => { if (guardada) titulo.current?.focus({ preventScroll: true }); }, [guardada]);

  const donde = guardada
    ? guardada.email && guardada.telefono ? `a ${guardada.email} o al ${guardada.telefono}`
      : guardada.email ? `a ${guardada.email}` : `al ${guardada.telefono}`
    : "";

  return (
    <section className="fin-estado" aria-labelledby="fin-titulo" style={{ "--fin-tono": tema.cardBg }}>
      <div className="fin-escena">
        <div className="fin-halo" aria-hidden="true" />
        <div className="fin-tarjeta">
          <CaraDelPase cliente={tarjeta.cliente} negocio={tarjeta.negocio} qr={{ src: qr, codigo: tarjeta.cliente.codigo }} />
        </div>
      </div>

      {guardada ? (
        <div className="fin-texto" role="status">
          <span className="fin-sello" aria-hidden="true"><Icono nombre="check" tam={26} grosor={2.6} /></span>
          <h1 id="fin-titulo" ref={titulo} tabIndex={-1} className="titulo-bloque fin-titulo">
            Tarjeta guardada<Punto />
          </h1>
          <p className="entradilla">Te escribimos {donde} para ponerla en marcha.</p>
        </div>
      ) : (
        <div className="fin-texto">
          <h1 id="fin-titulo" className="titulo-bloque fin-titulo">
            Tu tarjeta te espera<Punto />
          </h1>
          <p className="entradilla">Guárdala y te la dejamos funcionando en tu cafetería.</p>
          <button type="button" className="boton" onClick={alVolver}>Guardar mi tarjeta</button>
        </div>
      )}
    </section>
  );
}

function Precios() {
  return (
    <section id="precios" className="fin-precios" aria-labelledby="fin-titulo-precios">
      <div className="encabezado encabezado-centro">
        <h2 id="fin-titulo-precios" className="titulo-bloque fin-titulo-precios">
          Un precio claro<Punto />
        </h2>
        <p className="entradilla">Todas con tu tarjeta en iPhone y Android.</p>
      </div>

      <Indicador objetivo="planes" nombre="Planes" tipo="pestanas" etiquetas={PLANES.map((p) => `${p.nombre} ${p.precio} €`)} />
      <Aparece id="planes" className="planes">
        {PLANES.map((plan, i) => (
          <article key={plan.id} className={`plan${plan.destacado ? " plan-destacado oscuro" : ""}`} style={{ "--i": i }} aria-labelledby={`plan-${plan.id}`}>
            <header className="plan-cabeza">
              <h3 id={`plan-${plan.id}`}>{plan.nombre}</h3>
              {plan.destacado && <span className="plan-etiqueta">Todo incluido</span>}
            </header>
            <p className="plan-lema">{plan.lema}</p>
            <p className="plan-precio">
              <span className="plan-cifra">{plan.precio} €</span>
              <span className="plan-periodo">al mes</span>
            </p>
            <ul className="plan-lista">
              {plan.incluye.map((linea, j) => (
                <li key={linea} style={{ "--j": j }}>
                  <Icono nombre="check" tam={18} grosor={2.2} />
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
            <a href={enlaceWhatsApp(mensajeDePlan(plan))} className={plan.destacado ? "boton boton-claro" : "boton"} target="_blank" rel="noopener noreferrer">
              Empezar con {plan.nombre}
            </a>
          </article>
        ))}
      </Aparece>
      <p className="planes-nota">
        ¿Tienes más de un local? <a href={enlaceWhatsApp("Hola, tengo más de un local y me interesa fiddle.")} target="_blank" rel="noopener noreferrer">Escríbenos</a> y lo vemos.
      </p>
    </section>
  );
}
