import Formulario from "./Formulario";
import { estilo } from "./estilo";
import { TARJETAS_GRATIS } from "@/app/home/datos";

export const metadata = { title: "Crea tu tarjeta gratis", robots: { index: true, follow: true } };

// ============================================================================
// ALTA SOLA (/alta)
// ----------------------------------------------------------------------------
// Una cafetería se crea su tienda sin hablar con nosotros: cinco datos y el local
// en el mapa. Empieza en el plan Gratis (lib/planes.js) y, al terminar, va a
// elegir sus contraseñas (/invitacion). Estática: no lee la base ni la sesión.
// ============================================================================

export default function Alta() {
  return (
    <main className="alta claro">
      <style>{estilo}</style>
      <div className="alta-dentro">
        <a href="/home" className="alta-marca">fiddle</a>
        <h1>Crea la tarjeta de tu cafetería</h1>
        <p className="alta-sub">
          Gratis para siempre hasta {TARJETAS_GRATIS} tarjetas, con todo incluido. Si un día
          se te queda corto, pasas a un plan de pago; hasta entonces no pagas nada.
        </p>
        <Formulario />
      </div>
    </main>
  );
}
