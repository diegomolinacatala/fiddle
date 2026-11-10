import QRCode from "qrcode";
import { comoDataUri } from "@/lib/apple/dibujo";
import { appUrl } from "@/lib/url";
import Probador from "./Probador";

// ============================================================================
// «DISEÑA TU TARJETA» (/home/tarjeta)
// ----------------------------------------------------------------------------
// Desde el botón de la portada de /home: quien aún no es cliente prueba colores,
// icono, cómo se cuentan los puntos y el premio, y nos escribe con lo elegido.
// Estática como /home: lo elegido vive solo en el navegador y no se guarda.
// ============================================================================

export const metadata = {
  title: "Diseña tu tarjeta · fiddle",
  description: "Prueba cómo quedaría la tarjeta de fidelización de tu cafetería: colores, icono, puntos y premio.",
  alternates: { canonical: "/home/tarjeta" },
};

export default async function DisenaTuTarjeta() {
  // Como en /home: el QR de ejemplo lleva a la web, no a ninguna tarjeta de verdad.
  const svg = await QRCode.toString(`${appUrl()}/home`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return <Probador qr={comoDataUri(svg)} />;
}
