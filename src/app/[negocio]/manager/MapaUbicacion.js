"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { C, campo, botonSecundario, botonPequeno } from "@/app/ui";

// ============================================================================
// DÓNDE ESTÁ LA TIENDA, EN UN MAPA
// ----------------------------------------------------------------------------
// Antes eran dos cajas de latitud y longitud: nadie sabe si "40.4168, -3.7038"
// es su puerta o la de enfrente. Aquí se ve el punto sobre la calle, se mueve
// arrastrándolo (o tocando el mapa), se busca por dirección y, debajo, sale la
// dirección que corresponde al punto para confirmarlo de un vistazo.
//
// El círculo es la zona en la que el iPhone saca la tarjeta en la pantalla de
// bloqueo. El radio lo decide Apple (no se configura en el pase): para tarjetas
// de fidelización ronda los 100 m, así que se dibuja como aproximación.
//
// OpenStreetMap: teselas y búsqueda gratis y sin clave. A cambio, su política
// pide atribución visible y poco volumen (esto solo lo usa el manager), y la
// búsqueda como mucho una petición por segundo: por eso se busca al pulsar, no
// al teclear, y la dirección del punto se pide al soltarlo. Los dominios están
// permitidos en la CSP (next.config.mjs).
// ============================================================================

const TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const RADIO_AVISO_M = 100;
const CENTRO_ESPANA = [40.4168, -3.7038];
// Se ve la calle y el círculo entero (100 m son ~110 px a este zoom).
const ZOOM_CALLE = 17;

/**
 * @param {{valor:{lat:number,lng:number}|null, onChange:(v:{lat:number,lng:number}|null)=>void, accent:string, flash:(m:string)=>void}} props
 */
export default function MapaUbicacion({ valor, onChange, accent, flash }) {
  const caja = useRef(null);
  const mapa = useRef(null); // { L, map, marcador, circulo }
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [direccion, setDireccion] = useState(null);
  // onChange cambia en cada render del padre: el mapa (creado una vez) lee el último.
  const alCambiar = useRef(onChange);
  alCambiar.current = onChange;

  // Leaflet toca `window` al importarse: solo en el navegador y una vez.
  useEffect(() => {
    let vivo = true;
    import("leaflet").then(({ default: L }) => {
      if (!vivo || !caja.current || mapa.current) return;
      const map = L.map(caja.current, {
        center: valor ? [valor.lat, valor.lng] : CENTRO_ESPANA,
        zoom: valor ? ZOOM_CALLE : 5,
        // La rueda del ratón sigue bajando la página: el zoom va con los botones.
        scrollWheelZoom: false,
      });
      L.tileLayer(TESELAS, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => alCambiar.current(redondear(e.latlng)));
      mapa.current = { L, map, marcador: null, circulo: null };
      pintar(valor);
    });
    return () => {
      vivo = false;
      mapa.current?.map.remove();
      mapa.current = null;
    };
    // Solo al montar: después, `pintar` mueve el punto sin rehacer el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pintar(valor);
    setDireccion(null);
    if (!valor) return;
    // La dirección del punto, para confirmar que está donde toca. Con retraso:
    // arrastrar dispara muchos cambios y Nominatim admite uno por segundo.
    const t = setTimeout(() => {
      fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&accept-language=es&lat=${valor.lat}&lon=${valor.lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setDireccion(d?.display_name ? corta(d.display_name) : null))
        .catch(() => {});
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor?.lat, valor?.lng, accent]);

  function pintar(v) {
    const m = mapa.current;
    if (!m) return;
    const { L, map } = m;
    if (!v) {
      m.marcador?.remove();
      m.circulo?.remove();
      m.marcador = m.circulo = null;
      return;
    }
    const punto = [v.lat, v.lng];
    if (!m.marcador) {
      m.marcador = L.marker(punto, { draggable: true, icon: pin(L, accent), keyboard: true, title: "Tu tienda" }).addTo(map);
      m.marcador.on("dragend", () => alCambiar.current(redondear(m.marcador.getLatLng())));
      m.circulo = L.circle(punto, {
        radius: RADIO_AVISO_M, color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.12, interactive: false,
      }).addTo(map);
    } else {
      m.marcador.setLatLng(punto).setIcon(pin(L, accent));
      m.circulo.setLatLng(punto).setStyle({ color: accent, fillColor: accent });
    }
    if (!map.getBounds().pad(-0.2).contains(punto)) map.setView(punto, Math.max(map.getZoom(), 16));
  }

  async function buscar(e) {
    e.preventDefault();
    const q = busca.trim();
    if (!q) return;
    setBuscando(true);
    try {
      const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&accept-language=es&q=${encodeURIComponent(q)}`);
      const d = r.ok ? await r.json() : [];
      setResultados(d.map((x) => ({ id: x.place_id, texto: corta(x.display_name), lat: Number(x.lat), lng: Number(x.lon) })));
    } catch {
      flash("No se pudo buscar la dirección. Prueba a mover el punto a mano.");
    } finally {
      setBuscando(false);
    }
  }

  function elegir(r) {
    setResultados(null);
    setBusca("");
    mapa.current?.map.setView([r.lat, r.lng], ZOOM_CALLE);
    onChange(redondear(r));
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) return flash("Este navegador no da la ubicación");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const v = redondear({ lat: p.coords.latitude, lng: p.coords.longitude });
        mapa.current?.map.setView([v.lat, v.lng], ZOOM_CALLE);
        onChange(v);
      },
      () => flash("No se pudo obtener la ubicación (da permiso)"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <form onSubmit={buscar} style={{ display: "flex", gap: 8 }}>
        <input
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setResultados(null); }}
          placeholder="Busca la dirección: calle, número, ciudad"
          enterKeyHint="search"
          style={{ ...campo, minWidth: 0 }}
        />
        <button type="submit" disabled={buscando} style={{ ...botonSecundario, flexShrink: 0, display: "inline-flex", alignItems: "center" }} aria-label="Buscar">
          <Icono nombre="lupa" tam={18} />
        </button>
      </form>

      {resultados && (
        <div style={lista}>
          {resultados.length === 0 && <div style={{ padding: 10, fontSize: 13, color: C.suave }}>No aparece. Prueba con menos palabras o mueve el punto a mano.</div>}
          {resultados.map((r) => (
            <button key={r.id} type="button" onClick={() => elegir(r)} style={opcion}>{r.texto}</button>
          ))}
        </div>
      )}

      <div style={{ position: "relative", marginTop: 8 }}>
        <div ref={caja} style={lienzo} aria-label="Mapa con la ubicación de la tienda" />
        {!valor && (
          <div style={vacio}>Toca el mapa donde está la puerta, o busca la dirección.</div>
        )}
      </div>

      <div style={{ fontSize: 13, color: C.suave, marginTop: 8, minHeight: 18 }}>
        {valor
          ? <>
              <strong style={{ color: C.texto, fontWeight: 600 }}>{direccion || "Buscando la dirección…"}</strong>
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>
                Arrastra el punto para afinar. El círculo es, más o menos, dónde el iPhone saca la tarjeta en la pantalla de bloqueo.
              </div>
            </>
          : "Sin ubicación: la tarjeta no aparecerá sola al acercarse a la tienda."}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={usarMiUbicacion} style={{ ...botonPequeno, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icono nombre="ubicacion" tam={16} /> Estoy en la tienda
        </button>
        {valor && (
          <button type="button" onClick={() => onChange(null)} style={botonPequeno}>Quitar ubicación</button>
        )}
      </div>
    </div>
  );
}

// Seis decimales son ~10 cm: más es ruido del GPS, menos puede caer en la acera de enfrente.
const redondear = ({ lat, lng }) => ({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

// "Calle Mayor, 12, Centro, Madrid, Comunidad de Madrid, 28013, España" -> lo que se lee.
const corta = (s) => String(s).split(", ").slice(0, 4).join(", ");

// Chincheta dibujada (la de Leaflet son PNG que el empaquetador no encuentra).
const pin = (L, color) => L.divIcon({
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">
    <path d="M17 42S3 27.5 3 16a14 14 0 0 1 28 0c0 11.5-14 26-14 26z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
    <circle cx="17" cy="16" r="5" fill="#fff"/></svg>`,
});

const lienzo = { height: 260, borderRadius: 10, border: `1px solid ${C.borde}`, overflow: "hidden", background: C.panelSuave, zIndex: 0 };
const vacio = {
  position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 500, pointerEvents: "none",
  background: "rgba(255,255,255,.94)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.texto, textAlign: "center",
};
const lista = { marginTop: 6, border: `1px solid ${C.borde}`, borderRadius: 10, overflow: "hidden", background: "#fff" };
const opcion = {
  display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: 0, borderBottom: `1px solid ${C.borde}`,
  background: "#fff", fontSize: 13, color: C.texto, cursor: "pointer",
};
