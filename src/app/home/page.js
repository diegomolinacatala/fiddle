import QRCode from "qrcode";
import { comoDataUri } from "@/lib/apple/dibujo";
import { appUrl } from "@/lib/url";
import { ProveedorTarjeta } from "./experiencia/Tarjeta";
import Experiencia from "./experiencia/Experiencia";
import { css } from "./estilo";
import { cssMovil } from "./estiloMovil";
import { cssPiezas, cssPagina } from "./tarjeta/estilo";
import { cssExperiencia } from "./experiencia/estilo";
import { cssFinal } from "./experiencia/estiloFinal";

// ============================================================================
// LA WEB DE FIDDLE (/home)
// ----------------------------------------------------------------------------
// No cuenta qué es fiddle: lo deja probar. Una pantalla como la de una app, sin
// scroll, con UNA protagonista (la tarjeta de quien entra) y una sola pregunta
// cada vez:
//
//   su cafetería → premios → puntos → color → icono → la prueba → la guarda
//
// y, al guardarla (un email o un teléfono, a /api/interesados), los precios.
// Todo lo demás (el panel, las cifras, las preguntas, el contacto) se quitó a
// propósito el 16-11-2026: si hace falta contar algo más, se añade después de ver
// dónde se para la gente, no antes.
//
// Aquí solo se prepara el QR de ejemplo; la experiencia entera es
// experiencia/Experiencia.js, y lo elegido vive en ProveedorTarjeta.
// ============================================================================

export default async function Home() {
  // El QR de la tarjeta lleva a esta misma web: quien lo escanee desde el
  // ordenador la abre en su móvil, y no apunta a ninguna tarjeta de verdad.
  const svg = await QRCode.toString(`${appUrl()}/home`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });

  return (
    <div className="home">
      <style>{css + cssMovil + cssPiezas + cssPagina + cssExperiencia + cssFinal}</style>
      <main id="contenido">
        <ProveedorTarjeta qr={comoDataUri(svg)}>
          <Experiencia />
        </ProveedorTarjeta>
      </main>
    </div>
  );
}
