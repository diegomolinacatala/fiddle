import { headers } from "next/headers";
import Formulario from "./Formulario";
import { estilo } from "./estilo";
import { TARJETAS_GRATIS } from "@/app/home/datos";

export const metadata = { title: "Crea tu tarjeta gratis", robots: { index: true, follow: true } };

// ============================================================================
// ALTA SOLA (/alta)
// ----------------------------------------------------------------------------
// Una cafetería se crea su tienda sin hablar con nosotros: cinco datos y el local
// en el mapa. Empieza en el plan Gratis (lib/planes.js) y, al terminar, va a
// verificar su correo y elegir sus accesos (/invitacion). No lee la base ni la
// sesión; solo la ciudad aproximada que Vercel saca de la IP, para que el buscador
// del local ponga primero lo cercano (no se guarda ni sale de aquí).
// ============================================================================

// Vercel la manda en cabeceras; en local no hay.
async function ciudadAproximada() {
  const h = await headers();
  const lat = Number.parseFloat(h.get("x-vercel-ip-latitude"));
  const lng = Number.parseFloat(h.get("x-vercel-ip-longitude"));
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 } : null;
}

export default async function Alta() {
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
        <Formulario cerca={await ciudadAproximada()} />
      </div>
    </main>
  );
}
