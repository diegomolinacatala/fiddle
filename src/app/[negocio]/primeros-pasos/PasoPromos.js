"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso } from "@/app/home/Telefono";
import { PROMOS } from "@/app/home/experiencia/logica";
import { tiene } from "@/lib/planes";
import { Escenario, Panel, usePasos } from "./Marco";

// ============================================================================
// PASO 5: PROMOCIONES
// ----------------------------------------------------------------------------
// Hablar con sus clientes. La escena es la pantalla de bloqueo de un cliente a la
// que le llega el aviso de la tienda cada vez que cambia el texto (el aviso es el
// mismo de la web: lo que sale en el pase al cambiar el campo PROMO), sola y grande:
// con la tarjeta al lado, el móvil la tapaba a medias. Ponerla va por /api/promo,
// el camino de siempre: la escribe en todos los pases y avisa. Sin promociones en
// su plan, no hay campo: se cuenta dónde se activan.
// ============================================================================

const MAX_PROMO = 60;
const ESPERA_VISTA_MS = 450; // lo que se escribe tarda un poco en llegar a la escena: un aviso por letra cansa
// Tres ideas, no más: con cinco, el panel del móvil se llenaba de chips.
const SUGERENCIAS = [PROMOS[0], PROMOS[1], "Segundo café a mitad de precio"];

export default function PasoPromos() {
  const { n, setN, slug, seguir } = usePasos();
  const conPromos = tiene(n, "promos");
  const [texto, setTexto] = useState(conPromos ? n.promo || "" : "");
  const [vista, setVista] = useState(texto.trim());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setVista(texto.trim()), ESPERA_VISTA_MS);
    return () => clearTimeout(t);
  }, [texto]);

  const poner = async (sugerencia) => {
    if (typeof sugerencia === "string") { setTexto(sugerencia); setVista(sugerencia); return; }
    const limpio = texto.trim();
    if (!limpio || ocupado) return;
    // La misma que ya tiene: no se vuelve a avisar a nadie por lo mismo.
    if (limpio === n.promo) { seguir(); return; }
    setOcupado(true);
    setError(null);
    try {
      const promo = await mandarPromo(slug, limpio);
      setN((a) => ({ ...a, promo }));
      seguir();
    } catch (e) {
      setError(e.message);
      setOcupado(false);
    }
  };

  return (
    <>
      <Escenario etiqueta="La pantalla de un cliente: le llega tu promoción" className="pp-pro-escena">
        <div className="pp-pro-lienzo" aria-hidden="true">
          <PantallaBloqueo negocio={n} promo={vista} />
        </div>
      </Escenario>
      {conPromos ? (
        <Panel
          titulo="Tu primera promo"
          pista="Les llega a todos al momento."
          principal={{ texto: "Ponerla ya", onClick: poner, ocupado, deshabilitado: !texto.trim() }}
          error={error}
          className="pp-pro-cuerpo"
        >
          <Campo texto={texto} alCambiar={setTexto} alEnviar={poner} />
          <div className="pp-pro-chips" role="group" aria-label="Ideas de promoción">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" className={`pp-pro-chip${s === texto ? " igual" : ""}`} onClick={() => poner(s)}>{s}</button>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel
          titulo="Tu primera promoción"
          pista="Van en los planes de pago, en Ajustes."
          principal={{ texto: "Seguir", onClick: seguir }}
        />
      )}
    </>
  );
}

// POST /api/promo. Devuelve la promo guardada o lanza con un mensaje para enseñar.
async function mandarPromo(slug, texto) {
  let r;
  try {
    r = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ b: slug, texto }) });
  } catch {
    throw new Error("Sin conexión: no se ha puesto. Prueba otra vez.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "No se ha podido poner la promoción. Prueba otra vez.");
  return data.promo ?? texto;
}

function Campo({ texto, alCambiar, alEnviar }) {
  return (
    <div className="pp-pro-campo">
      <label htmlFor="pp-promo" className="exp-etiqueta">La promoción</label>
      <div className="pp-pro-entrada">
        <input
          id="pp-promo" type="text" value={texto} maxLength={MAX_PROMO} autoComplete="off" enterKeyHint="done"
          placeholder="Hoy, 2x1 hasta las 12" aria-describedby="pp-promo-cuenta"
          onChange={(ev) => alCambiar(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter") alEnviar(); }}
        />
        <span id="pp-promo-cuenta" className={`pp-pro-cuenta${texto.length >= MAX_PROMO ? " tope" : ""}`}>{texto.length} de {MAX_PROMO}</span>
      </div>
    </div>
  );
}

// Un móvil plano con la pantalla de bloqueo. Sin texto, un aviso de ejemplo
// (apagado y con «Ejemplo» donde iría la hora) para que la escena no nazca vacía.
function PantallaBloqueo({ negocio, promo }) {
  const fecha = useMemo(() => {
    const f = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return f.charAt(0).toUpperCase() + f.slice(1);
  }, []);
  const ejemplo = !promo;
  return (
    <div className="pp-pro-movil">
      <div className="pp-pro-pantalla">
        <span className="pp-pro-isla" />
        <div className="pp-pro-hora">
          <small>{fecha}</small>
          <strong>9:41</strong>
        </div>
        <div key={promo || "ejemplo"} className={`pp-pro-aviso${ejemplo ? " ejemplo" : ""}`}>
          <Aviso negocio={negocio} texto={promo || PROMOS[0]} cuando={ejemplo ? "Ejemplo" : "ahora"} />
        </div>
        <span className="pp-pro-barra" />
      </div>
    </div>
  );
}
