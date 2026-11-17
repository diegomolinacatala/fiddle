import QRCode from "qrcode";
import { comoDataUri } from "@/lib/apple/dibujo";
import { appUrl } from "@/lib/url";
import { ProveedorTarjeta } from "../experiencia/Tarjeta";
import Experiencia from "../experiencia/Experiencia";
import { css } from "../estilo";
import { cssMovil } from "../estiloMovil";
import { cssPiezas, cssPagina } from "./estilo";
import { cssExperiencia } from "../experiencia/estilo";
import { cssFinal } from "../experiencia/estiloFinal";

// ============================================================================
// «DISEÑA TU TARJETA» (/home/tarjeta)
// ----------------------------------------------------------------------------
// A donde lleva la acción principal de la web (/home). Una pantalla como la de
// una app, sin scroll, con UNA protagonista (la tarjeta de quien entra) y una
// sola pregunta cada vez:
//
//   su cafetería → premios → puntos → color → icono → la prueba → la guarda
//
// y, al guardarla (un email o un teléfono, a /api/interesados), los precios.
// /home cuenta qué hacemos; aquí se prueba. Lo elegido vive en ProveedorTarjeta
// y la experiencia entera es experiencia/Experiencia.js.
// ============================================================================

export const metadata = {
  title: "Diseña tu tarjeta en fiddle",
  description: "Prueba cómo quedaría la tarjeta de fidelización de tu cafetería: el nombre, los colores, el icono y los puntos. Y mira cómo les llega a tus clientes.",
  alternates: { canonical: "/home/tarjeta" },
};

export default async function DisenaTuTarjeta() {
  // El QR de la tarjeta lleva a la web: quien lo escanee desde el ordenador la
  // abre en su móvil, y no apunta a ninguna tarjeta de verdad.
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
