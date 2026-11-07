import CaraDelPase from "@/app/CaraDelPase";
import Desfile from "./Desfile";
import { ejemplo } from "./demo";

// ============================================================================
// LA CINTA DE TARJETITAS (entre secciones de /home)
// ----------------------------------------------------------------------------
// Separa la portada de «Cero fricción» y los precios de las preguntas: una fila
// de tarjetas pequeñas que pasa de derecha a izquierda. Son CaraDelPase de
// verdad (los diseños de demo.js), encogidas con CSS: nada de una maqueta
// aparte. Cada una como la del móvil de la portada (Telefono.js): con su QR y su
// código debajo, que es como se ve en el Wallet (07-11-2026: sin ellos parecían
// otra cosa). Sin la línea de «Abierto…»: en pequeño no se lee y pesa (son letras
// dibujadas). Lo que se mueve lo decide Desfile.js.
// ============================================================================

export default function Cinta({ disenos, qr }) {
  return (
    <Desfile cuantas={disenos.length}>
      {disenos.map((d) => {
        const { negocio, cliente } = ejemplo(d.tienda, d.sellos, { sellos2: d.sellos2 });
        return (
          <div key={d.id} className="cinta-tarjeta">
            <CaraDelPase cliente={cliente} negocio={negocio}>
              <div className="movil-qr">
                <img src={qr} alt="" width={128} height={128} />
                <span>{cliente.codigo}</span>
              </div>
            </CaraDelPase>
          </div>
        );
      })}
    </Desfile>
  );
}
