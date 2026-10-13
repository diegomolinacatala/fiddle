import CaraDelPase from "@/app/CaraDelPase";
import { LogoApple } from "@/app/LogoTienda";
import Carrusel from "./Carrusel";
import { CARRUSEL, ejemploDe, avisoDe } from "./demo";

// ============================================================================
// EL MÓVIL DE LA PORTADA
// ----------------------------------------------------------------------------
// Un iPhone con la tarjeta abierta en la Cartera; va pasando tarjetas, una por
// cosa que sabe hacer (CARRUSEL en demo.js), y por encima llega el aviso de cada
// una. Las tarjetas son CaraDelPase y el aviso sale de camposDelPase: lo mismo
// que recibe el cliente. Aquí se pintan; cuál se ve lo decide Carrusel.js.
// ============================================================================

export default function Telefono({ qr }) {
  const diapositivas = CARRUSEL.map((d) => ({ ...d, ejemplo: ejemploDe(d) }));
  return (
    <Carrusel
      titulos={diapositivas.map((d) => d.titulo)}
      tarjetas={diapositivas.map(({ id, ejemplo: { negocio, cliente, estado } }) => (
        <CaraDelPase key={id} cliente={cliente} negocio={negocio} estado={estado}>
          <div className="movil-qr">
            <img src={qr} alt="" width={128} height={128} />
            <span>{cliente.codigo}</span>
          </div>
        </CaraDelPase>
      ))}
      avisos={diapositivas.map(({ id, ejemplo }) => (
        <Aviso key={id} negocio={ejemplo.negocio} texto={avisoDe(ejemplo)} />
      ))}
    >
      <div className="movil-estado" aria-hidden="true">
        <span>9:41</span>
        <BarrasEstado />
      </div>
      <div className="movil-cartera" aria-hidden="true">
        <span>Hecho</span>
        <span className="movil-mas"><i /><i /><i /></span>
      </div>
    </Carrusel>
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
