"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Icono from "@/app/Icono";
import { PALETA } from "@/app/home/paleta";

// maplibre pesa: solo se baja cuando hay un mapa que enseñar.
const MapaLocal = dynamic(() => import("./MapaLocal"), { ssr: false, loading: () => <div className="alta-mapa-caja" /> });

const PHOTON = "https://photon.komoot.io/api/";
// Sin ubicación del dueño, la búsqueda se inclina hacia el centro de España.
const CENTRO_ESPANA = { lat: 40.0, lng: -3.7 };
const ZOOM_ESPANA = 5;
const ZOOM_BUSQUEDA = 13;
const MIN_LETRAS = 3;
const ESPERA_MS = 300;
const MAX_RESULTADOS = 6;
// Lo que Photon etiqueta con estas claves es un sitio con nombre; el resto, calles y barrios.
const CLAVES_DE_LOCAL = new Set(["amenity", "shop", "tourism", "leisure", "craft", "office"]);
const PUNTO_A_MANO = "Punto ajustado a mano";

// Un resultado de Photon, ya como lo enseña la lista.
function opcionDe(f) {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const esLocal = CLAVES_DE_LOCAL.has(p.osm_key);
  const ciudad = p.city || p.locality || p.district || p.county || "";
  // En una calle el nombre ES la calle; en un local, la calle va aparte.
  const calle = esLocal || p.street ? p.street || "" : p.name || "";
  const calleNumero = [calle, p.housenumber].filter(Boolean).join(" ");
  const nombre = esLocal || (p.name && p.street) ? p.name || "" : "";
  const titulo = nombre || calleNumero || ciudad;
  const resto = [nombre ? calleNumero : "", ciudad].filter(Boolean).join(", ");
  return {
    clave: `${p.osm_type || ""}${p.osm_id || ""}-${lat}-${lng}`,
    lat, lng, esLocal, es: p.countrycode === "ES",
    titulo, resto, nombre,
    direccion: [calleNumero, ciudad].filter(Boolean).join(", "),
  };
}

const valida = (o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.titulo;

// «Calle Colón 1 Valencia» no encuentra la de València: allí OSM la llama «Carrer de
// Colón», y Photon prefiere una «Calle Colón» de otro pueblo. Sin el tipo de vía
// («Colón 1 Valencia») sí sale. Se buscan las dos y va primero la de sin tipo.
const TIPO_DE_VIA = /^\s*(calle|c\/|c\.|cl\.?|carrer|plaza|pl\.|plaça)\s+(de(l|\s+la|\s+los|\s+las)?\s+)?/i;
const sinTipoDeVia = (q) => q.replace(TIPO_DE_VIA, "").trim();

async function buscarEnPhoton(q, sesgo, signal) {
  const r = await fetch(`${PHOTON}?q=${encodeURIComponent(q)}&limit=${MAX_RESULTADOS}&lat=${sesgo.lat}&lon=${sesgo.lng}`, { signal });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).features || [];
}

/**
 * El buscador de «Dónde está tu local»: se escribe el nombre y sale el sitio, como
 * en Google Maps. Si no sale, se marca en el mapa o se usa «Estoy en el local».
 * @param {{valor:{lat:number,lng:number,direccion:string|null,nombre?:string|null}|null, onChange:(v:object|null)=>void, sugerencia?:string, cerca?:{lat:number,lng:number}|null}} props
 */
export default function BuscarLocal({ valor, onChange, sugerencia = "", cerca = null }) {
  const id = useId();
  const entrada = useRef(null);
  const escribiendo = useRef(false); // solo se busca lo que escribe la persona, no lo que se rellena al elegir
  const sinSugerir = useRef(false);
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [aviso, setAviso] = useState(null);
  const [mapaLibre, setMapaLibre] = useState(false);
  const [usuario, setUsuario] = useState(null);

  // Primero dónde dice el dueño que está; si no, la ciudad desde la que entra (la
  // saca Vercel de la IP, alta/page.js); si no, el centro de España.
  const sesgo = usuario || cerca || CENTRO_ESPANA;
  useEffect(() => {
    const q = texto.trim();
    if (!escribiendo.current || q.length < MIN_LETRAS) {
      setOpciones([]);
      setBuscado(false);
      setBuscando(false);
      return;
    }
    const control = new AbortController();
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const corta = sinTipoDeVia(q);
        const tandas = await Promise.all(
          corta !== q && corta.length >= MIN_LETRAS
            ? [buscarEnPhoton(corta, sesgo, control.signal), buscarEnPhoton(q, sesgo, control.signal)]
            : [buscarEnPhoton(q, sesgo, control.signal)],
        );
        // Photon repite a veces el mismo sitio (un portal por varios tramos de calle).
        const vistos = new Set();
        const lista = tandas.flat().map(opcionDe).filter(valida).filter((o) => {
          const k = `${o.titulo}|${o.resto}`;
          return vistos.has(k) ? false : vistos.add(k);
        }).slice(0, MAX_RESULTADOS);
        // España primero, sin quitar el resto (la ordenación es estable).
        setOpciones([...lista.filter((o) => o.es), ...lista.filter((o) => !o.es)]);
        setAviso(null);
        setBuscado(true);
        setActivo(-1);
        setBuscando(false);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setOpciones([]);
        setBuscado(false);
        setBuscando(false);
        setAviso("No se ha podido buscar ahora. Prueba otra vez o márcalo en el mapa.");
      }
    }, ESPERA_MS);
    return () => { clearTimeout(t); control.abort(); };
  }, [texto, sesgo.lat, sesgo.lng]);

  // La lista lleva, al final, la salida «márcalo en el mapa»: también se alcanza con el teclado.
  const hayLista = abierto && (opciones.length > 0 || buscado || texto.trim().length >= MIN_LETRAS);
  const total = opciones.length + 1;

  function elegir(o) {
    escribiendo.current = false;
    setAbierto(false);
    setMapaLibre(false);
    setOpciones([]);
    setAviso(null);
    onChange({ lat: o.lat, lng: o.lng, nombre: o.nombre || null, direccion: o.direccion || o.titulo });
  }

  function abrirMapa() {
    setAbierto(false);
    setMapaLibre(true);
  }

  function alEscribir(e) {
    escribiendo.current = true;
    setTexto(e.target.value);
    setAbierto(true);
  }

  function alEnfocar() {
    setAbierto(true);
    // Quien ya puso el nombre arriba ve su local sin escribirlo otra vez.
    if (!texto && sugerencia.trim() && !sinSugerir.current) {
      escribiendo.current = true;
      setTexto(sugerencia.trim());
    }
  }

  function alTeclear(e) {
    if (e.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => (e.key === "ArrowDown" ? (a + 1) % total : (a - 1 + total) % total));
      return;
    }
    if (e.key === "Enter") {
      // Enter no envía nada: aquí solo elige.
      e.preventDefault();
      if (!hayLista) return;
      if (activo === opciones.length) return abrirMapa();
      const o = opciones[activo >= 0 ? activo : 0];
      if (o) elegir(o);
    }
  }

  function enElLocal() {
    setAviso(null);
    if (!navigator.geolocation) return setAviso("Este móvil no da su ubicación. Márcalo en el mapa.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lng: coords.longitude };
        setUsuario(p);
        escribiendo.current = false;
        setAbierto(false);
        onChange({ ...p, nombre: null, direccion: "Tu ubicación actual" });
      },
      () => setAviso("No hemos podido ver dónde estás. Búscalo por el nombre o márcalo en el mapa."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function cambiar() {
    sinSugerir.current = true;
    escribiendo.current = false;
    setTexto("");
    setMapaLibre(false);
    onChange(null);
    // El campo vuelve a aparecer en el siguiente pintado.
    setTimeout(() => entrada.current?.focus(), 0);
  }

  function mover({ lat, lng }) {
    setMapaLibre(false);
    onChange({ lat, lng, nombre: null, direccion: PUNTO_A_MANO });
  }

  const centro = usuario || (opciones[0] ? { lat: opciones[0].lat, lng: opciones[0].lng } : CENTRO_ESPANA);
  const zoom = usuario || opciones[0] ? ZOOM_BUSQUEDA : ZOOM_ESPANA;
  const listaId = `${id}-lista`;

  return (
    <div className="alta-buscar">
      {valor ? (
        <div className="alta-lugar">
          <span className="alta-lugar-icono"><Icono nombre={valor.nombre ? "tienda" : "ubicacion"} tam={20} /></span>
          <div className="alta-lugar-texto">
            <strong>{valor.nombre || valor.direccion}</strong>
            {valor.nombre && valor.direccion && <span>{valor.direccion}</span>}
          </div>
          <button type="button" className="alta-chico" onClick={cambiar}>Cambiar</button>
        </div>
      ) : (
        <div className="alta-combo">
          <span className="alta-combo-lupa"><Icono nombre="lupa" tam={18} /></span>
          <input
            ref={entrada}
            type="text"
            role="combobox"
            aria-expanded={hayLista}
            aria-controls={listaId}
            aria-autocomplete="list"
            aria-activedescendant={hayLista && activo >= 0 ? `${id}-o${activo}` : undefined}
            aria-label="Busca tu cafetería o su dirección"
            placeholder="Busca tu cafetería o su dirección"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={texto}
            onChange={alEscribir}
            onFocus={alEnfocar}
            onBlur={() => setAbierto(false)}
            onKeyDown={alTeclear}
          />
          {hayLista && (
            <ul id={listaId} role="listbox" aria-label="Sitios encontrados" className="alta-lista">
              {opciones.map((o, i) => (
                <li key={o.clave} id={`${id}-o${i}`} role="option" aria-selected={activo === i}
                  className={`alta-opcion${activo === i ? " activa" : ""}`}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)} onMouseMove={() => setActivo(i)}>
                  <span className="alta-opcion-icono"><Icono nombre={o.esLocal ? "tienda" : "ubicacion"} tam={18} /></span>
                  <span className="alta-opcion-texto">
                    <strong>{o.titulo}</strong>
                    {o.resto && <span>{o.resto}</span>}
                  </span>
                </li>
              ))}
              {buscado && opciones.length === 0 && <li className="alta-opcion-nada" role="presentation">No sale nada con ese nombre.</li>}
              {buscando && opciones.length === 0 && <li className="alta-opcion-nada" role="presentation">Buscando…</li>}
              <li id={`${id}-o${opciones.length}`} role="option" aria-selected={activo === opciones.length}
                className={`alta-opcion alta-opcion-mapa${activo === opciones.length ? " activa" : ""}`}
                onMouseDown={(e) => e.preventDefault()} onClick={abrirMapa} onMouseMove={() => setActivo(opciones.length)}>
                <span className="alta-opcion-icono"><Icono nombre="ubicacion" tam={18} /></span>
                <span className="alta-opcion-texto"><strong>¿No sale? Márcalo en el mapa</strong></span>
              </li>
            </ul>
          )}
        </div>
      )}

      {!valor && (
        <div className="alta-buscar-pie">
          <button type="button" className="alta-enlace" onClick={enElLocal}>
            <Icono nombre="diana" tam={16} /> Estoy en el local
          </button>
        </div>
      )}
      {aviso && <p className="alta-aviso" role="status">{aviso}</p>}

      {(valor || mapaLibre) && (
        <div className="alta-mapa-marco">
          {!valor && <p className="alta-mapa-pista">Toca en el mapa donde está tu local.</p>}
          <MapaLocal punto={valor ? { lat: valor.lat, lng: valor.lng } : null} centro={centro} zoom={zoom} onMover={mover} color={PALETA.verde} />
          {valor && <p className="alta-mapa-pista">Si no está justo, arrastra el pin o toca en su sitio.</p>}
        </div>
      )}
    </div>
  );
}
