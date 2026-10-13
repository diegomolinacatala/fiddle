import QRCode from "qrcode";
import CaraDelPase from "@/app/CaraDelPase";
import Icono from "@/app/Icono";
import { LogoApple } from "@/app/LogoTienda";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { appUrl } from "@/lib/url";
import Telefono, { Aviso } from "./Telefono";
import LogoFiddle from "@/app/LogoFiddle";
import { ejemplo, avisoDeSello, CAFETERIA, MUESTRARIO } from "./demo";
import { PLANES, TELEFONO_VISIBLE, CORREO, enlaceWhatsApp, enlaceCorreo, mensajeDePlan } from "./datos";
import { css } from "./estilo";

// ============================================================================
// LA WEB DE FIDDLE (/home)
// ----------------------------------------------------------------------------
// Lo que se le enseña a una cafetería que aún no nos conoce: qué es, cómo va,
// cuánto cuesta y cómo hablar con nosotros. Para quien ya trabaja con nosotros,
// «Entrar» arriba a la derecha (y al pie).
//
// «Entrar» va a «/», no a /login: la raíz ya sabe a dónde mandar a cada uno
// (con sesión, a su panel o a su caja; sin ella, al login).
// Página estática: nada de lo de aquí depende de quién la mira.
// ============================================================================

const ENTRAR = "/";

export default async function Home() {
  const portada = ejemplo(CAFETERIA, 7);
  const antes = ejemplo(CAFETERIA, 6);
  // El QR de la tarjeta de ejemplo lleva a esta misma web: quien lo escanee desde
  // el ordenador la abre en su móvil, y no apunta a ninguna tarjeta de verdad.
  const qr = await qrDeTexto(`${appUrl()}/home`);

  return (
    <div className="home">
      <style>{css}</style>
      <a href="#contenido" className="saltar">Saltar al contenido</a>

      <header className="cabecera">
        <div className="cabecera-dentro">
          <a href="#inicio" className="cabecera-marca" aria-label="fiddle, inicio">
            <LogoFiddle tam={30} />
          </a>
          <nav className="cabecera-nav" aria-label="Secciones">
            <a href="#como-funciona" className="solo-ancho">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#contacto" className="solo-ancho">Contacto</a>
          </nav>
          <a href={ENTRAR} className="entrar">Entrar</a>
        </div>
      </header>

      <main id="contenido">
        <section id="inicio" className="portada">
          <div className="portada-texto">
            <p className="antetitulo">Tarjetas de fidelización para cafeterías</p>
            <h1 className="titular">
              Sellos que no se pierden<Punto />
            </h1>
            <p className="entradilla">
              Tu tarjeta de sellos, en el Apple Wallet o el Android de tus clientes. La guardan con un
              escaneo y tú sumas sellos desde el móvil de la tienda.
            </p>
            <div className="acciones">
              <a href={enlaceWhatsApp()} className="boton" target="_blank" rel="noopener noreferrer">
                Hablemos por WhatsApp
              </a>
              <a href="#precios" className="boton-suave">
                Ver precios
              </a>
            </div>
          </div>
          <div className="portada-visual">
            <Telefono ejemplo={portada} qr={qr} aviso={avisoDeSello(portada)} />
          </div>
        </section>

        <section id="como-funciona" className="bloque">
          <Encabezado titulo="Así de sencillo">
            Tus clientes no instalan nada. La tarjeta se guarda en la cartera del móvil, junto a sus
            entradas y sus billetes de avión.
          </Encabezado>

          <ol className="pasos">
            <li className="paso revela">
              <div className="paso-visual paso-cartel" aria-hidden="true">
                <div className="cartel">
                  <LogoApple tema={portada.negocio.tema} tam={34} />
                  <img src={qr} alt="" width={104} height={104} />
                  <span>Escanea y guarda tu tarjeta</span>
                </div>
              </div>
              <span className="paso-numero">1</span>
              <h3>Escanean tu QR</h3>
              <p>Está en tu mostrador. Con la cámara del móvil, sin descargar nada, y la tarjeta queda guardada.</p>
            </li>

            <li className="paso revela">
              <div className="paso-visual paso-caja" aria-hidden="true">
                <div className="caja">
                  <div className="caja-fila">
                    <strong>{portada.negocio.nombre}</strong>
                    <span>{antes.cliente.codigo}</span>
                  </div>
                  <img src={banda(antes)} alt="" className="caja-banda" />
                  <span className="caja-boton">
                    <Icono nombre="mas" tam={18} grosor={2.4} /> Sumar sello
                  </span>
                </div>
              </div>
              <span className="paso-numero">2</span>
              <h3>Sumas el sello</h3>
              <p>Desde la caja, que es el móvil de la tienda: escaneas su tarjeta y un toque.</p>
            </li>

            <li className="paso revela">
              <div className="paso-visual paso-avisos" aria-hidden="true">
                <div className="avisos">
                  {/* Como en la pantalla de bloqueo: el último arriba. */}
                  <Aviso negocio={portada.negocio} texto={avisoDeSello(portada)} />
                  <Aviso negocio={antes.negocio} texto={avisoDeSello(antes)} cuando="ayer" className="aviso-viejo" />
                </div>
              </div>
              <span className="paso-numero">3</span>
              <h3>Les llega al móvil</h3>
              <p>Al momento ven en su móvil cuánto les falta para el premio. Y vuelven.</p>
            </li>
          </ol>
        </section>

        <section className="bloque bloque-noche" aria-labelledby="titulo-marca">
          <div className="marca-dentro">
            <Encabezado id="titulo-marca" titulo="Con tu marca">
              Tu logo, tus colores y tu premio. Lo cambias cuando quieras desde tu panel y la tarjeta se pone
              al día sola en el móvil de cada cliente.
            </Encabezado>
            <div className="mazo">
              {MUESTRARIO.map((m) => {
                const e = ejemplo(m, m.sellos);
                return (
                  <div key={m.slug} className="mazo-carta revela">
                    <CaraDelPase cliente={e.cliente} negocio={e.negocio} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="precios" className="bloque">
          <Encabezado titulo="Un precio claro" centrado>
            Dos opciones, las dos con la tarjeta completa en iPhone y Android.
          </Encabezado>

          <div className="planes">
            {PLANES.map((plan) => (
              <article key={plan.id} className={`plan revela${plan.destacado ? " plan-destacado" : ""}`} aria-labelledby={`plan-${plan.id}`}>
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
                  {plan.incluye.map((linea) => (
                    <li key={linea}>
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
          </div>
          <p className="planes-nota">
            ¿Tienes más de un local? <a href={enlaceWhatsApp("Hola, tengo más de un local y me interesa fiddle.")} target="_blank" rel="noopener noreferrer">Escríbenos</a> y lo vemos.
          </p>
        </section>

        <section id="preguntas" className="bloque bloque-estrecho">
          <Encabezado titulo="Preguntas" />
          <div className="preguntas">
            {PREGUNTAS.map(([pregunta, respuesta]) => (
              <details key={pregunta} className="pregunta">
                <summary>
                  <span>{pregunta}</span>
                  <Icono nombre="mas" tam={20} grosor={2} />
                </summary>
                <p>{respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contacto" className="bloque bloque-noche contacto">
          <div className="contacto-dentro">
            <div className="contacto-texto revela">
              <div className="iniciales" aria-hidden="true">
                <span>V</span>
                <span>D</span>
              </div>
              <h2 className="titulo-bloque">
                Somos Victor y Diego<Punto />
              </h2>
              <p className="entradilla">
                De Valencia. Vamos a tu cafetería, dejamos la tarjeta montada y nos tienes a un mensaje
                para lo que necesites.
              </p>
            </div>
            <div className="contacto-acciones revela">
              <a href={enlaceWhatsApp()} className="contacto-via" target="_blank" rel="noopener noreferrer">
                <span className="contacto-icono"><Icono nombre="movil" tam={22} /></span>
                <span>
                  <strong>WhatsApp</strong>
                  <span>{TELEFONO_VISIBLE}</span>
                </span>
                <Flecha />
              </a>
              <a href={enlaceCorreo()} className="contacto-via">
                <span className="contacto-icono"><Icono nombre="correo" tam={22} /></span>
                <span>
                  <strong>Correo</strong>
                  {/* Si no cabe, que parta tras la @ y no deje una letra suelta. */}
                  <span>{CORREO.split("@")[0]}@<wbr />{CORREO.split("@")[1]}</span>
                </span>
                <Flecha />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="pie">
        <div className="pie-dentro">
          <LogoFiddle tam={26} claro />
          <nav className="pie-nav" aria-label="Pie">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#preguntas">Preguntas</a>
            <a href="#contacto">Contacto</a>
            <a href={ENTRAR}>Entrar</a>
          </nav>
          <p className="pie-firma">© {new Date().getFullYear()} fiddle, Valencia</p>
        </div>
      </footer>
    </div>
  );
}

// Las preguntas que hacen en el mostrador. La última es para quien ya es cliente.
const PREGUNTAS = [
  [
    "¿Tus clientes tienen que descargar una app?",
    "No. En iPhone la tarjeta va al Apple Wallet, que ya viene en el teléfono. En Android se guarda en el móvil como una tarjeta más y, si activan los avisos, les llegan igual.",
  ],
  [
    "¿Qué necesitas en la tienda?",
    "Un móvil con cámara para la caja y tu QR en el mostrador. Nosotros te lo dejamos montado.",
  ],
  [
    "¿Puedes cambiar el diseño o el premio más adelante?",
    "Sí, desde tu panel y cuando quieras. La tarjeta se actualiza sola en el móvil de tus clientes.",
  ],
  [
    "¿Qué pasa con los datos de tus clientes?",
    "Son de tu tienda. Pedimos lo mínimo (el nombre, y solo si tú quieres), lo guardamos cifrado y cumplimos el RGPD: cada cliente puede descargar o borrar sus datos desde su tarjeta.",
  ],
  [
    "Ya trabajo con vosotros, ¿cómo entro?",
    "Con «Entrar», arriba a la derecha. Con el usuario de tu tienda llegas a tu panel; con el de la caja, a la caja.",
  ],
];

// El punto rosa del final de cada título: el sello del logo.
function Punto() {
  return <span className="punto" aria-hidden="true" />;
}

function Encabezado({ id, titulo, centrado = false, children }) {
  return (
    <div className={`encabezado revela${centrado ? " encabezado-centro" : ""}`}>
      <h2 id={id} className="titulo-bloque">
        {titulo}
        <Punto />
      </h2>
      {children && <p className="entradilla">{children}</p>}
    </div>
  );
}

function Flecha() {
  return (
    <svg className="flecha" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const banda = ({ negocio, cliente }) => comoDataUri(stripDelPase(negocio, cliente).svg);

async function qrDeTexto(texto) {
  const svg = await QRCode.toString(texto, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#1d1b2e", light: "#ffffff" } });
  return comoDataUri(svg);
}
