"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapaUbicacion from "@/app/[negocio]/manager/MapaUbicacion";
import CaraDelPase from "@/app/CaraDelPase";
import { tarjetaDe } from "@/app/home/tarjeta/opciones";
import { PALETA } from "@/app/home/paleta";
import { leerAlta, MAX_NOMBRE_TIENDA, MAX_NOMBRE_PERSONA } from "@/lib/alta";

// La clave que deja «Diseña tu tarjeta» (/home/tarjeta) con lo elegido.
const CLAVE_ELECCION = "fiddle:eleccion";
const NOMINATIM = "https://nominatim.openstreetmap.org";
// Cuánto se espera a la dirección del punto antes de enviar sin ella.
const ESPERA_DIRECCION_MS = 4000;
const ORDEN_CAMPOS = ["tienda", "nombre", "email", "telefono", "lugar", "acepto"];

// sessionStorage puede no estar (datos bloqueados): sin él, sin tarjeta, y ya.
function leerEleccion() {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_ELECCION);
    const e = crudo ? JSON.parse(crudo) : null;
    return e && typeof e === "object" ? e : null;
  } catch {
    return null;
  }
}

// La dirección del punto, para que el admin sepa dónde está sin abrir el mapa. Si
// Nominatim no contesta a tiempo se envía sin ella: las coordenadas bastan.
async function direccionDe({ lat, lng }) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ESPERA_DIRECCION_MS);
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`, { signal: control.signal });
    const d = r.ok ? await r.json() : null;
    return d?.display_name ? String(d.display_name).split(", ").slice(0, 4).join(", ") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function Campo({ id, etiqueta, error, ayuda, children }) {
  return (
    <div className="alta-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda && !error && <span className="alta-ayuda" id={`${id}-ayuda`}>{ayuda}</span>}
      {error && <span className="alta-error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}

export default function Formulario() {
  const [datos, setDatos] = useState({ tienda: "", nombre: "", email: "", telefono: "", web: "" });
  const [lugar, setLugar] = useState(null);
  const [acepto, setAcepto] = useState(false);
  const [errores, setErrores] = useState({});
  const [fallo, setFallo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [eleccion, setEleccion] = useState(null);
  const raiz = useRef(null);

  useEffect(() => { setEleccion(leerEleccion()); }, []);

  const poner = (k) => (e) => {
    setDatos((d) => ({ ...d, [k]: e.target.value }));
    setErrores((x) => ({ ...x, [k]: undefined }));
  };

  // La tarjeta con el nombre que va escribiendo: así se ve suya antes de crearla.
  const tarjeta = useMemo(
    () => (eleccion ? tarjetaDe({ ...eleccion, nombre: datos.tienda }) : null),
    [eleccion, datos.tienda],
  );

  function enfocar(errs) {
    const primero = ORDEN_CAMPOS.find((k) => errs[k]);
    if (!primero) return;
    const el = primero === "lugar" ? raiz.current?.querySelector(".alta-mapa input") : raiz.current?.querySelector(`#${primero}`);
    el?.focus();
  }

  async function enviar(ev) {
    ev.preventDefault();
    setFallo(null);
    const { errores: errs } = leerAlta({ ...datos, lugar, acepto });
    if (errs) {
      setErrores(errs);
      return enfocar(errs);
    }
    setEnviando(true);
    try {
      const direccion = lugar.direccion || (await direccionDe(lugar));
      const r = await fetch("/api/alta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, lugar: { ...lugar, direccion }, acepto, ...(eleccion ? { eleccion } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ir) {
        // Ya está creada: se va a elegir contraseñas. El diseño ya no hace falta guardarlo.
        try { window.sessionStorage.removeItem(CLAVE_ELECCION); } catch { /* da igual */ }
        window.location.href = d.ir;
        return;
      }
      if (d.errores) {
        setErrores(d.errores);
        enfocar(d.errores);
      } else {
        setFallo(r.status === 429 ? "Demasiados intentos desde esta conexión. Prueba en un rato." : d.error || "No se pudo crear la tarjeta. Prueba otra vez.");
      }
    } catch {
      setFallo("Sin conexión: no se ha creado nada. Prueba otra vez.");
    }
    setEnviando(false);
  }

  return (
    <div className="alta-cols" ref={raiz}>
      {tarjeta && (
        <div className="alta-tarjeta" aria-hidden="true">
          <div><CaraDelPase cliente={tarjeta.cliente} negocio={tarjeta.negocio} /></div>
        </div>
      )}

      {/* No es un <form>: el buscador del mapa (MapaUbicacion) lleva el suyo y un
          formulario no puede ir dentro de otro. Se envía con el botón. */}
      <div className="alta-form">
        <Campo id="tienda" etiqueta="Nombre de la cafetería" error={errores.tienda}>
          <input id="tienda" type="text" value={datos.tienda} onChange={poner("tienda")} maxLength={MAX_NOMBRE_TIENDA}
            autoComplete="organization" aria-invalid={Boolean(errores.tienda)} aria-describedby={errores.tienda ? "tienda-error" : undefined} />
        </Campo>
        <Campo id="nombre" etiqueta="Tu nombre" error={errores.nombre}>
          <input id="nombre" type="text" value={datos.nombre} onChange={poner("nombre")} maxLength={MAX_NOMBRE_PERSONA}
            autoComplete="name" aria-invalid={Boolean(errores.nombre)} aria-describedby={errores.nombre ? "nombre-error" : undefined} />
        </Campo>
        <Campo id="email" etiqueta="Email" error={errores.email}>
          <input id="email" type="email" inputMode="email" value={datos.email} onChange={poner("email")} autoComplete="email"
            autoCapitalize="none" aria-invalid={Boolean(errores.email)} aria-describedby={errores.email ? "email-error" : undefined} />
        </Campo>
        <Campo id="telefono" etiqueta="Teléfono" error={errores.telefono} ayuda="Solo para llamarte si algo no cuadra.">
          <input id="telefono" type="tel" inputMode="tel" value={datos.telefono} onChange={poner("telefono")} autoComplete="tel"
            aria-invalid={Boolean(errores.telefono)} aria-describedby={errores.telefono ? "telefono-error" : "telefono-ayuda"} />
        </Campo>

        <div className="alta-campo">
          <span className="alta-etiqueta">Dónde está tu local</span>
          <div className="alta-mapa">
            <MapaUbicacion
              valor={lugar ? { lat: lugar.lat, lng: lugar.lng } : null}
              onChange={(v) => { setLugar(v ? { ...v, direccion: null } : null); setErrores((x) => ({ ...x, lugar: undefined })); }}
              accent={PALETA.verde}
              flash={(m) => setFallo(m)}
            />
          </div>
          {errores.lugar && <span className="alta-error" role="alert">{errores.lugar}</span>}
        </div>

        {/* Campo trampa: una persona no lo ve ni lo alcanza con el tabulador. */}
        <div className="alta-trampa" aria-hidden="true">
          <label>Web<input type="text" tabIndex={-1} autoComplete="off" value={datos.web} onChange={poner("web")} /></label>
        </div>

        <div className="alta-campo">
          <label className="alta-acepto" htmlFor="acepto">
            <input id="acepto" type="checkbox" checked={acepto} aria-invalid={Boolean(errores.acepto)}
              onChange={(e) => { setAcepto(e.target.checked); setErrores((x) => ({ ...x, acepto: undefined })); }} />
            <span>
              Acepto el <a href="/privacidad" target="_blank" rel="noopener">aviso de privacidad</a>. fiddle trata los datos
              de tus clientes por cuenta de tu tienda, como encargado del tratamiento.
            </span>
          </label>
          {errores.acepto && <span className="alta-error" role="alert">{errores.acepto}</span>}
        </div>

        {fallo && <div className="alta-fallo" role="alert">{fallo}</div>}

        <button type="button" onClick={enviar} className="alta-boton" disabled={enviando} aria-busy={enviando || undefined}>
          {enviando ? "Creando tu tarjeta…" : "Crear mi tarjeta gratis"}
        </button>
        <p className="alta-pie">Después eliges tu contraseña y la del móvil de la caja.</p>
      </div>
    </div>
  );
}
