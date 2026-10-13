import CaraDelPase from "@/app/CaraDelPase";
import { LogoApple } from "@/app/LogoTienda";

// ============================================================================
// EL MÓVIL DE LA PORTADA
// ----------------------------------------------------------------------------
// Un iPhone con la tarjeta abierta en la Cartera y, por encima, el aviso que
// llega tras el sello. La tarjeta es CaraDelPase y el texto del aviso sale de
// camposDelPase (demo.js): lo mismo que recibe el cliente. Solo el marco del
// teléfono está dibujado aquí.
// ============================================================================

export default function Telefono({ ejemplo, qr, aviso }) {
  const { negocio, cliente } = ejemplo;
  return (
    <figure className="movil" aria-label={`Así se ve la tarjeta de ${negocio.nombre} en el móvil de un cliente`}>
      <div className="movil-cuerpo">
        <div className="movil-isla" aria-hidden="true" />
        <div className="movil-pantalla">
          <div className="movil-estado" aria-hidden="true">
            <span>9:41</span>
            <BarrasEstado />
          </div>
          <div className="movil-cartera" aria-hidden="true">
            <span>Hecho</span>
            <span className="movil-mas"><i /><i /><i /></span>
          </div>
          <CaraDelPase cliente={cliente} negocio={negocio}>
            <div className="movil-qr">
              <img src={qr} alt="" width={132} height={132} />
              <span>{cliente.codigo}</span>
            </div>
          </CaraDelPase>
        </div>
      </div>

      <Aviso negocio={negocio} texto={aviso} className="movil-aviso" />
    </figure>
  );
}

/** Un aviso de la pantalla de bloqueo, como los que deja el pase al cambiar. */
export function Aviso({ negocio, texto, cuando = "ahora", className = "" }) {
  return (
    <div className={`aviso ${className}`} role="img" aria-label={`Aviso de ${negocio.nombre}: ${texto}`}>
      <LogoApple tema={negocio.tema} tam={38} style={{ borderRadius: 9, background: negocio.tema.cardBg }} />
      <div className="aviso-texto">
        <div className="aviso-cabeza">
          <strong>{negocio.nombre}</strong>
          <span>{cuando}</span>
        </div>
        <p>{texto}</p>
      </div>
    </div>
  );
}

// Cobertura, wifi y batería: solo para que la pantalla parezca un teléfono.
function BarrasEstado() {
  return (
    <svg width="66" height="12" viewBox="0 0 66 12" fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="9" y="3" width="3" height="9" rx="1" />
      <rect x="13.5" y="0.5" width="3" height="11.5" rx="1" />
      <path d="M28.5 3.2a8.6 8.6 0 0 1 11 0l-1.3 1.4a6.7 6.7 0 0 0-8.4 0zM30.6 5.6a5.4 5.4 0 0 1 6.8 0l-1.3 1.4a3.5 3.5 0 0 0-4.2 0zM32.7 8.1a2.2 2.2 0 0 1 2.6 0L34 9.6z" />
      <rect x="44.5" y="1" width="18" height="10" rx="3" fill="none" stroke="currentColor" strokeOpacity=".4" />
      <rect x="46" y="2.5" width="15" height="7" rx="1.8" />
      <rect x="63.6" y="4" width="1.6" height="4" rx=".8" fillOpacity=".4" />
    </svg>
  );
}
