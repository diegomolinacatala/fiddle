import Icono from "@/app/Icono";
import Aparece from "./Aparece";
import Indicador from "./Indicador";
import { PLANES, enlaceWhatsApp, mensajeDePlan, mensualDelAnual } from "./datos";

// Las tarjetas de los planes, una sola vez para la web y para el final del recorrido:
// si se separan, un precio se cambia en un sitio y se queda viejo en el otro.
// Gratis va a /alta (se da de alta solo); Pro, a WhatsApp con el plan ya escrito.
export default function Planes() {
  return (
    <>
      <Indicador objetivo="planes" nombre="Planes" tipo="pestanas" etiquetas={PLANES.map((p) => `${p.nombre} ${p.precio} €`)} />
      <Aparece id="planes" className="planes">
        {PLANES.map((plan, i) => (
          <article key={plan.id} className={`plan${plan.destacado ? " plan-destacado oscuro" : ""}`} style={{ "--i": i }} aria-labelledby={`plan-${plan.id}`}>
            <header className="plan-cabeza">
              <h3 id={`plan-${plan.id}`}>{plan.nombre}</h3>
              {plan.etiqueta && <span className="plan-etiqueta">{plan.etiqueta}</span>}
            </header>
            <p className="plan-lema">{plan.lema}</p>
            <p className="plan-precio">
              <span className="plan-cifra">{plan.precio} €</span>
              <span className="plan-periodo">{plan.periodo}</span>
            </p>
            {plan.anual && (
              <p className="plan-anual">
                o <b>{plan.anual} € al año</b>, {mensualDelAnual(plan)} €/mes
              </p>
            )}
            {plan.nota && <p className="plan-nota">{plan.nota}</p>}
            <ul className="plan-lista">
              {plan.incluye.map((linea, j) => (
                <li key={linea} style={{ "--j": j }}>
                  <Icono nombre="check" tam={18} grosor={2.2} />
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
            {plan.enlace ? (
              <a href={plan.enlace} className="boton">{plan.boton}</a>
            ) : (
              <a href={enlaceWhatsApp(mensajeDePlan(plan))} className="boton boton-claro" target="_blank" rel="noopener noreferrer">
                Empezar con {plan.nombre}
              </a>
            )}
          </article>
        ))}
      </Aparece>
    </>
  );
}
