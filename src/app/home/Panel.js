import Icono from "@/app/Icono";
import { GRUPOS } from "@/lib/crm";
import { ubicacionesApple } from "@/lib/apple/pase";
import { Aviso } from "./Telefono";
import { ejemplo, CAFETERIA } from "./demo";

// ============================================================================
// EL PANEL DEL DUEÑO, EN LA WEB (/home)
// ----------------------------------------------------------------------------
// Lo que hace fiddle más que una tarjeta: Clientes (cifras, horas), Avisos a un
// grupo y el aviso al pasar cerca. Los NOMBRES y las FRASES son los de la app:
// las cifras del Resumen (crm/PanelCrm.js), los grupos con su mensaje sugerido
// (GRUPOS en lib/crm.js), la frase de «Lo que dicen los números»
// (lib/observaciones.js) y el aviso de ubicación del pase (ubicacionesApple).
// Los NÚMEROS son de ejemplo: una cafetería cualquiera, siempre los mismos.
// Las maquetas van con aria-hidden: lo que cuentan ya lo dice el texto de al lado.
// ============================================================================

const CIFRAS = [
  { label: "Clientes", valor: "248", pie: "212 con la tarjeta en el teléfono" },
  { label: "Activos", valor: "131", pie: "104 a su ritmo, 27 nuevos" },
  { label: "Vuelven en 14 días", valor: "58%", pie: "71 de 122 que la estrenaron" },
];

// 30 días de visitas: más el fin de semana, cerrado el domingo, algo de subida.
const VISITAS = Array.from({ length: 30 }, (_, i) => {
  const dia = (i + 1) % 7; // 0 = lunes
  if (dia === 6) return 0;
  return [34, 26, 31, 33, 40, 47][dia] + ((i * 7) % 5) - 2 + Math.round(i * 0.25);
});
const MAXIMO = Math.max(...VISITAS);

// A qué horas viene la gente, de 8 a 19, de lunes a sábado (0 a 1). Punta por la
// mañana y a la salida del trabajo; el martes, flojo.
const HORAS = Array.from({ length: 12 }, (_, h) => h + 8);
const DIAS = ["L", "M", "X", "J", "V", "S"];
const intensidad = (d, h) => {
  const punta = Math.exp(-((h - 9) ** 2) / 2) + 0.8 * Math.exp(-((h - 18) ** 2) / 3) + 0.25;
  const dia = [0.85, 0.45, 0.8, 0.85, 1, 0.95][d];
  return Math.min(1, punta * dia);
};

// Los grupos que se enseñan, el primero elegido. Los de verdad, con su frase.
const GRUPOS_VISTOS = ["a_punto", "fieles_frios", "nuevos", "dormidos"];

export default function Panel() {
  const tienda = ejemplo(CAFETERIA, 7);
  const mensaje = GRUPOS.a_punto.idea.replace("{premio}", CAFETERIA.premio);
  // El aviso de ubicación sale de la misma función que lo mete en el pase.
  const [cerca] = ubicacionesApple({ ...tienda.negocio, ubicaciones: [{ lat: 39.4699, lng: -0.3763 }] });

  return (
    <div id="panel-piezas" className="panel">
      <article className="panel-pieza panel-ancha revela">
        <div className="panel-texto">
          <h3>Tus clientes, en números</h3>
          <p>Quién viene, cada cuánto y quién lleva tiempo sin aparecer.</p>
        </div>
        <div className="panel-ui" aria-hidden="true">
          <div className="panel-cifras">
            {CIFRAS.map((c) => (
              <div key={c.label}>
                <span className="panel-etiqueta">{c.label}</span>
                <strong>{c.valor}</strong>
                <span className="panel-pie">{c.pie}</span>
              </div>
            ))}
          </div>
          <span className="panel-etiqueta">Visitas de los últimos 30 días</span>
          <div className="panel-barras">
            {VISITAS.map((v, i) => (
              <i key={i} style={{ height: `${Math.max(4, (v / MAXIMO) * 100)}%` }} className={i === VISITAS.length - 1 ? "hoy" : v ? "" : "cerrado"} />
            ))}
          </div>
          <p className="panel-linea">Ritmo habitual: <strong>cada 6 días</strong></p>
        </div>
      </article>

      <article className="panel-pieza panel-estrecha revela">
        <div className="panel-texto">
          <h3>Al pasar cerca</h3>
          <p>Si pasan por delante de tu tienda, su móvil les recuerda que tienen tu tarjeta.</p>
        </div>
        <div className="panel-mapa" aria-hidden="true">
          <span className="panel-chincheta" />
          {/* Sin «ahora»: en el iPhone es una sugerencia que aparece al estar cerca, no un aviso que llega. */}
          <Aviso negocio={tienda.negocio} texto={cerca.relevantText} cuando="" />
        </div>
      </article>

      <article className="panel-pieza panel-media revela">
        <div className="panel-texto">
          <h3>Avisos a un grupo</h3>
          <p>A los que están a un sello del premio, a los que hace semanas que no ves… Con el texto ya sugerido.</p>
        </div>
        <div className="panel-ui" aria-hidden="true">
          <span className="panel-etiqueta">A quién</span>
          <div className="panel-grupos">
            {GRUPOS_VISTOS.map((id, i) => (
              <span key={id} className={i === 0 ? "elegido" : ""}>
                <Icono nombre={GRUPOS[id].icon} tam={15} />
                {GRUPOS[id].label}
              </span>
            ))}
          </div>
          <span className="panel-etiqueta">Qué les dices</span>
          <p className="panel-mensaje">{mensaje}</p>
          <span className="panel-enviar">Enviar a 18 clientes</span>
        </div>
      </article>

      <article className="panel-pieza panel-media revela">
        <div className="panel-texto">
          <h3>Lo que dicen los números</h3>
          <p>Tus horas flojas y tus días fuertes, y el aviso preparado para llenarlos.</p>
        </div>
        <div className="panel-ui" aria-hidden="true">
          <span className="panel-etiqueta">A qué horas viene la gente</span>
          <div className="panel-rejilla" style={{ gridTemplateColumns: `14px repeat(${HORAS.length}, minmax(0, 1fr))` }}>
            {DIAS.map((d, i) => (
              <div key={d} className="panel-fila">
                <span>{d}</span>
                {HORAS.map((h) => <i key={h} style={{ opacity: 0.12 + intensidad(i, h) * 0.88 }} />)}
              </div>
            ))}
          </div>
          <div className="panel-idea">
            <Icono nombre="diana" tam={18} />
            <span>Los martes vienen bastante menos que el resto de la semana.</span>
          </div>
          <span className="panel-enviar">Avisar los martes</span>
        </div>
      </article>
    </div>
  );
}
