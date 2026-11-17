import QRCode from "qrcode";
import Icono from "@/app/Icono";
import LogoFiddle from "@/app/LogoFiddle";
import { comoDataUri } from "@/lib/apple/dibujo";
import { appUrl } from "@/lib/url";
import Telefono from "./Telefono";
import ComoFunciona from "./ComoFunciona";
import Cifras from "./Cifras";
import Correo from "./Correo";
import Cinta from "./Cinta";
import Menu from "./Menu";
import BarraMovil from "./BarraMovil";
import Indicador from "./Indicador";
import Aparece from "./Aparece";
import { Punto, Encabezado, Flecha, IconoMensaje } from "./Trozos";
import { CINTAS } from "./demo";
import { PALETA } from "./paleta";
import { PLANES, TELEFONO_VISIBLE, CORREO, enlaceWhatsApp, mensajeDePlan } from "./datos";
import { css } from "./estilo";
import { cssMovil } from "./estiloMovil";
import { cssComo } from "./estiloComo";
import { cssVenta } from "./estiloVenta";
import { cssScroll } from "./estiloScroll";

// ============================================================================
// LA WEB DE FIDDLE (/home)
// ----------------------------------------------------------------------------
// Lo que se le enseña a una cafetería que aún no nos conoce, de menos a más: qué
// es (portada), cómo funciona (de que la guardan a que sabes quién vuelve), que
// ya funciona en una cafetería de verdad, cuánto cuesta y quiénes somos.
//
// La acción principal NO es escribirnos: es «Diseña tu tarjeta» (/home/tarjeta),
// donde la diseña, la prueba y nos deja su contacto. Es lo único que destaca en
// la portada y en la cabecera; según se baja vuelve a ofrecerse, pero callado
// (un enlace, la barra del móvil), para que la página cuente y no empuje.
// WhatsApp queda de segunda opción para quien prefiere hablar.
//
// Página estática: nada de lo de aquí depende de quién la mira.
// ============================================================================

const ENTRAR = "/";
const DISENA = "/home/tarjeta";

// Las secciones, en la cabecera (pantalla ancha), en el menú del móvil y al pie.
const SECCIONES = [
  ["#como-funciona", "Cómo funciona"],
  ["#precios", "Precios"],
  ["#contacto", "Contacto"],
];

export default async function Home() {
  // El QR de las tarjetas de ejemplo lleva a esta misma web: quien lo escanee
  // desde el ordenador la abre en su móvil, y no apunta a ninguna tarjeta de verdad.
  const qr = await qrDeTexto(`${appUrl()}/home`);

  return (
    <div className="home">
      <style>{css + cssMovil + cssComo + cssVenta + cssScroll}</style>
      <a href="#contenido" className="saltar">Saltar al contenido</a>

      <header className="cabecera">
        <div className="cabecera-dentro">
          <a href="#inicio" className="cabecera-marca" aria-label="fiddle, inicio">
            <LogoFiddle tam={30} color={PALETA.verde} id="efe-cabecera" />
          </a>
          <nav className="cabecera-nav" aria-label="Secciones">
            {SECCIONES.map(([href, texto]) => (
              <a key={href} href={href}>{texto}</a>
            ))}
          </nav>
          <a href={ENTRAR} className="cabecera-entrar">Entrar</a>
          {/* En pantalla ancha, la acción de la portada se queda a mano al bajar. */}
          <a href={DISENA} className="entrar">Diseña tu tarjeta</a>
          <Menu
            enlaces={[...SECCIONES, [ENTRAR, "Entrar"]]}
            contacto={
              <a href={DISENA} className="boton">
                Diseña tu tarjeta <Flecha />
              </a>
            }
          />
        </div>
        {/* Cuánto llevas leído: se llena con el scroll (estiloScroll.js). */}
        <span className="sc-progreso" aria-hidden="true" />
      </header>

      <main id="contenido">
        <section id="inicio" className="portada">
          <div className="portada-texto">
            <p className="antetitulo">Tarjetas de fidelización para cafeterías</p>
            <h1 className="titular">
              Clientes que no se pierden<Punto />
            </h1>
            <p className="entradilla">
              Tu tarjeta, en el Apple Wallet o el Android de tus clientes. La guardan con un
              escaneo y tú sumas puntos desde el móvil de la tienda.
            </p>
            <div className="acciones">
              <a href={DISENA} className="boton venta-principal">
                Diseña tu tarjeta <Flecha />
              </a>
              <a href={enlaceWhatsApp()} className="boton-suave venta-hablar" target="_blank" rel="noopener noreferrer">
                <IconoMensaje /> Hablemos por WhatsApp
              </a>
            </div>
            <p className="venta-nota">Un minuto, sin registrarte. Y la ves como la verán tus clientes.</p>
          </div>
          <div className="portada-visual">
            <Telefono qr={qr} />
          </div>
        </section>

        <Cinta disenos={CINTAS[0]} />

        <ComoFunciona qr={qr} />

        {/* Justo antes del precio: lo que ya ha pasado en una cafetería, con su nombre. */}
        <section id="cifras" className="bloque" aria-labelledby="titulo-cifras">
          <Encabezado id="titulo-cifras" titulo="Ya funciona en cafeterías">
            La Delicantería, en Valencia, fue la primera en usar fiddle. Así le fue en sus primeras semanas.
          </Encabezado>
          <Cifras />
        </section>

        <section id="precios" className="bloque">
          <Encabezado titulo="Un precio claro" centrado>
            Tres opciones, todas con tu tarjeta en iPhone y Android.
          </Encabezado>

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

        {/* El último empujón, antes de quiénes somos: las tarjetas pasan y la suya falta. */}
        <Cinta disenos={CINTAS[1]} />
        <section className="invita" aria-labelledby="titulo-invita">
          <h2 id="titulo-invita" className="invita-titulo">
            ¿Cómo sería la tuya<Punto />
          </h2>
          <a href={DISENA} className="boton-suave probar">
            Diséñala en un minuto <Flecha />
          </a>
        </section>

        <section id="contacto" className="bloque oscuro fondo-espresso">
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
              <Correo>
                <span className="contacto-icono"><Icono nombre="correo" tam={22} /></span>
                <span>
                  <strong>Correo</strong>
                  {/* Si no cabe, que parta tras la @ y no deje una letra suelta. */}
                  <span>{CORREO.split("@")[0]}@<wbr />{CORREO.split("@")[1]}</span>
                </span>
              </Correo>
            </div>
          </div>
        </section>
      </main>

      <footer className="pie oscuro">
        <div className="pie-dentro">
          <LogoFiddle tam={28} color={PALETA.avena} id="efe-pie" />
          <nav className="pie-nav" aria-label="Pie">
            {SECCIONES.map(([href, texto]) => (
              <a key={href} href={href}>{texto}</a>
            ))}
            <a href={DISENA}>Diseña tu tarjeta</a>
            <a href={ENTRAR}>Entrar</a>
          </nav>
          <p className="pie-firma">© {new Date().getFullYear()} fiddle, Valencia</p>
        </div>
      </footer>

      {/* En el móvil, en cuanto la portada se queda atrás, la acción vuelve al pulgar. */}
      <BarraMovil>
        <a href={DISENA} className="boton">
          Diseña tu tarjeta <Flecha />
        </a>
      </BarraMovil>
    </div>
  );
}

async function qrDeTexto(texto) {
  const svg = await QRCode.toString(texto, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return comoDataUri(svg);
}
