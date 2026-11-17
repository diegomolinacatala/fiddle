import Icono from "@/app/Icono";
import { LogoApple } from "@/app/LogoTienda";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { Aviso } from "./Telefono";
import Indicador from "./Indicador";
import { Encabezado, Flecha } from "./Trozos";
import { ejemplo, avisoDe, avisoDePromo, CAFETERIA } from "./demo";

// ============================================================================
// CÓMO FUNCIONA, EN UNA SOLA SECCIÓN (/home)
// ----------------------------------------------------------------------------
// Antes eran dos («Cero fricción» y «Sabes quién vuelve»). Ahora, cuatro cosas en
// el orden en que le pasan a un cliente: la guarda, suma, le llega un aviso y el
// dueño sabe quién vuelve. Las tres primeras son lo que tiene ESE cliente; la
// cuarta, lo que ve el dueño, y por eso va en verde.
//
// En ancho es un bento de 6 columnas (4+2 y 2+4) para que no parezcan cuatro
// tarjetas iguales; en el móvil, una fila que se desliza (estiloComo.js).
// Los visuales salen de las mismas funciones que el pase de verdad (stripDelPase,
// avisoDe, avisoDePromo); las cifras son las de ejemplo de Panel.js.
// ============================================================================

const PROMO = "Hoy, 2x1 hasta las 12";

// Las tres cifras del panel (Panel.js, CIFRAS): de ejemplo, siempre las mismas.
const CIFRAS = [
  ["Clientes", "248"],
  ["Siguen viniendo", "131"],
  ["Premios por dar", "18"],
];

const banda = ({ negocio, cliente }) => comoDataUri(stripDelPase(negocio, cliente).svg);

export default function ComoFunciona({ qr }) {
  const ahora = ejemplo(CAFETERIA, 7);
  const antes = ejemplo(CAFETERIA, 6);
  const conPromo = ejemplo({ ...CAFETERIA, promo: PROMO }, 7);

  return (
    <section id="como-funciona" className="bloque" aria-labelledby="titulo-como">
      <Encabezado id="titulo-como" titulo="Así de simple">
        Sin apps, sin registros y sin colas en caja.
      </Encabezado>

      <div id="cf-rejilla" className="cf-rejilla">
        <article className="cf-pieza cf-ancha cf-verde-claro revela">
          <div className="cf-texto">
            <span className="cf-dato">0 apps</span>
            <h3>Lo guardan sin nada</h3>
            <p>Escanean el QR del mostrador y la tarjeta ya está en su móvil.</p>
          </div>
          <div className="cf-visual" aria-hidden="true">
            <div className="cartel">
              <LogoApple tema={ahora.negocio.tema} tam={34} />
              <img src={qr} alt="" width={104} height={104} />
              <span>Escanea y guarda tu tarjeta</span>
            </div>
          </div>
        </article>

        <article className="cf-pieza cf-estrecha cf-camel revela">
          <div className="cf-texto">
            <span className="cf-dato">1 toque</span>
            <h3>Sumas el punto</h3>
            <p>Desde el móvil de la tienda. La cola no se para.</p>
          </div>
          <div className="cf-visual" aria-hidden="true">
            <div className="caja">
              <div className="caja-fila">
                <strong>{ahora.negocio.nombre}</strong>
                <span>{antes.cliente.codigo}</span>
              </div>
              <img src={banda(antes)} alt="" className="caja-banda" />
              <span className="caja-boton">
                <Icono nombre="mas" tam={18} grosor={2.4} /> Sumar punto
              </span>
            </div>
          </div>
        </article>

        <article className="cf-pieza cf-estrecha cf-avena revela">
          <div className="cf-texto">
            <span className="cf-dato">Aunque no estén</span>
            <h3>Les escribes</h3>
            <p>Cada punto les avisa, y una promo a todos cuando quieras.</p>
          </div>
          <div className="cf-visual cf-avisos" aria-hidden="true">
            {/* Como en la pantalla de bloqueo: el último, arriba. */}
            <Aviso negocio={conPromo.negocio} texto={avisoDePromo(conPromo)} />
            <Aviso negocio={ahora.negocio} texto={avisoDe(ahora)} cuando="ayer" className="aviso-viejo" />
          </div>
        </article>

        <article className="cf-pieza cf-ancha cf-verde oscuro revela">
          <div className="cf-texto">
            <span className="cf-dato">Tu panel</span>
            <h3>Y sabes quién vuelve</h3>
            <p>Quién viene, cada cuánto y a quién se le olvida.</p>
          </div>
          <dl className="cf-cifras" aria-label="Ejemplo de cifras del panel">
            {CIFRAS.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
      <Indicador objetivo="cf-rejilla" nombre="Los cuatro pasos" etiquetas={["el paso 1", "el paso 2", "el paso 3", "el paso 4"]} />

      <div className="cf-pie revela">
        <div className="montaje">
          <span className="montaje-icono" aria-hidden="true"><Icono nombre="check" tam={22} grosor={2.4} /></span>
          <p>
            <strong>El montaje corre de nuestra cuenta.</strong> Vamos, preparamos tu tarjeta y dejamos
            el QR en el mostrador.
          </p>
        </div>
        <a href="/home/tarjeta" className="cf-prueba">
          Mira cómo quedaría la tuya <Flecha />
        </a>
      </div>
    </section>
  );
}
