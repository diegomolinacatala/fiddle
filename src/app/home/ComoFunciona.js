import Icono from "@/app/Icono";
import { LogoApple } from "@/app/LogoTienda";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { Aviso } from "./Telefono";
import { Encabezado, Flecha } from "./Trozos";
import { ejemplo, avisoDe, avisoDePromo, CAFETERIA } from "./demo";

// ============================================================================
// CÓMO FUNCIONA, EN UNA SOLA SECCIÓN (/home)
// ----------------------------------------------------------------------------
// Cuatro cosas en el orden en que le pasan a un cliente: la guarda, suma, le llega
// un aviso y el dueño sabe quién vuelve. Las tres primeras son un camino: cada
// visual flota sobre el papel, todos sobre el mismo suelo, y un hilo de puntos une
// los números de un paso al siguiente (en el móvil, vertical). Sin cajas de fondo:
// lo que se enseña ya es una tarjeta, una caja y unos avisos. La cuarta, lo que ve
// el dueño, y por eso va aparte, en una banda verde.
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

      <ol className="cf-pasos">
        <li className="cf-paso revela" style={{ "--k": 0 }}>
          <div className="cf-escena" aria-hidden="true">
            <div className="cartel">
              <LogoApple tema={ahora.negocio.tema} tam={34} />
              <img src={qr} alt="" width={104} height={104} />
              <span>Escanea y guarda tu tarjeta</span>
            </div>
          </div>
          <span className="cf-marca" aria-hidden="true"><b>1</b></span>
          <div className="cf-texto">
            <span className="cf-dato">0 apps</span>
            <h3>Lo guardan sin nada</h3>
            <p>Escanean el QR del mostrador y la tarjeta ya está en su móvil.</p>
          </div>
        </li>

        <li className="cf-paso revela" style={{ "--k": 1 }}>
          <div className="cf-escena" aria-hidden="true">
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
          <span className="cf-marca" aria-hidden="true"><b>2</b></span>
          <div className="cf-texto">
            <span className="cf-dato">1 toque</span>
            <h3>Sumas el punto</h3>
            <p>Desde el móvil de la tienda. La cola no se para.</p>
          </div>
        </li>

        <li className="cf-paso revela" style={{ "--k": 2 }}>
          <div className="cf-escena cf-avisos" aria-hidden="true">
            {/* Como en la pantalla de bloqueo: el último, arriba. */}
            <Aviso negocio={conPromo.negocio} texto={avisoDePromo(conPromo)} />
            <Aviso negocio={ahora.negocio} texto={avisoDe(ahora)} cuando="ayer" className="aviso-viejo" />
          </div>
          <span className="cf-marca" aria-hidden="true"><b>3</b></span>
          <div className="cf-texto">
            <span className="cf-dato">Aunque no estén</span>
            <h3>Les escribes</h3>
            <p>Cada punto les avisa, y una promo a todos cuando quieras.</p>
          </div>
        </li>
      </ol>

      <div className="cf-banda oscuro revela" style={{ "--k": 3 }}>
        <div className="cf-banda-texto">
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
      </div>

      <div className="cf-pie revela">
        <a href="/home/tarjeta" className="cf-prueba">
          Pruébalo con tu cafetería <Flecha />
        </a>
      </div>
    </section>
  );
}
