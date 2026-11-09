import { DELICANTERIA } from "./datos";

// ============================================================================
// LO QUE HA PASADO EN UNA CAFETERÍA DE VERDAD
// ----------------------------------------------------------------------------
// Dos cifras de La Delicantería, cada una contra una duda del que aún no nos
// conoce: «¿mis clientes se van a molestar en guardarla?» (los segundos) y «¿sirve
// para algo?» (las visitas). Lo de las visitas va con sus semanas al lado: un
// «+29 %» suelto es un eslogan; con las barras, se ve de dónde sale.
// Las cifras, y de dónde salen, en datos.js.
// ============================================================================

const { segundos, mitad, semanas } = DELICANTERIA;
const primera = semanas[0].visitas;
const ultima = semanas[semanas.length - 1].visitas;
const crecimiento = Math.round((ultima / primera - 1) * 100);
const maximo = Math.max(...semanas.map((s) => s.visitas));

export default function Cifras() {
  return (
    <div className="cifras">
      <article className="cifra cifra-rapida revela">
        <p className="cifra-num">
          {segundos}
          <span>segundos</span>
        </p>
        <div className="cifra-pie">
          <h3>de media para tenerla en el móvil</h3>
          <p>Desde que escanean el QR del mostrador hasta que la tarjeta está en su Wallet. La mitad, en {mitad} segundos.</p>
        </div>
      </article>

      <article className="cifra revela">
        <p className="cifra-num">
          +{crecimiento}
          <span>%</span>
        </p>
        <h3>más visitas a la semana en quince días</h3>
        <p>
          De {primera} visitas la semana del {semanas[0].semana} a {ultima} la del {semanas[semanas.length - 1].semana}. Semanas
          enteras, sin festivos.
        </p>
        <ol className="cifra-barras" aria-label="Visitas de cada semana">
          {semanas.map(({ semana, visitas }, i) => (
            <li key={semana} className={i === semanas.length - 1 ? "ultima" : undefined}>
              <strong>{visitas}</strong>
              <span className="cifra-hueco" aria-hidden="true">
                <span className="cifra-barra" style={{ "--h": `${(visitas / maximo) * 100}%` }} />
              </span>
              <span className="cifra-semana">{semana}</span>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
