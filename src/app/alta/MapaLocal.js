"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

// Teselas vectoriales de OpenFreeMap: gratis, sin clave y con uso comercial. «positron»
// es claro y deja el pin como lo único con color, que es lo que hay que mirar.
const ESTILO = "https://tiles.openfreemap.org/styles/positron";
// Un pin se ve en la calle, no en el barrio: al elegir un local se acerca hasta aquí.
const ZOOM_LOCAL = 16;

// El worker de MapLibre va copiado de node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs:
// empaquetado por webpack no carga. Al subir de versión de maplibre-gl, volver a copiarlo.
const WORKER = "/mapa/maplibre-gl-worker.mjs";

// Los textos de MapLibre vienen en inglés; son pocos y salen al tocar el mapa.
const TEXTOS = {
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + rueda para hacer zoom",
  "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + rueda para hacer zoom",
  "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
};

// Constante: nada del usuario entra en este HTML.
const PIN = (color) =>
  `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 3 28.5 3 17a14 14 0 0 1 28 0c0 11.500-14 26-14 26z" fill="${color}" stroke="#fff" stroke-width="2.500"/><circle cx="17" cy="17" r="5.500" fill="#fff"/></svg>`;

/**
 * El mapa de /alta: un pin que se arrastra o se mueve tocando. Sin `punto` solo
 * enseña el mapa y el primer toque lo pone.
 * @param {{punto:{lat:number,lng:number}|null, centro:{lat:number,lng:number}, zoom:number, onMover:(p:{lat:number,lng:number})=>void, color:string}} props
 */
export default function MapaLocal({ punto, centro, zoom, onMover, color }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const pin = useRef(null);
  const lib = useRef(null);
  const alMover = useRef(onMover);
  const ultimo = useRef({ punto, centro, zoom });
  alMover.current = onMover;
  ultimo.current = { punto, centro, zoom };

  // Poner o mover el pin, y llevar el mapa hasta él si no estaba a la vista.
  function colocar(p, acercar) {
    const m = mapa.current;
    const ml = lib.current;
    if (!m || !ml) return;
    if (!p) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      const el = document.createElement("div");
      el.className = "alta-pin";
      el.innerHTML = PIN(color);
      pin.current = new ml.Marker({ element: el, anchor: "bottom", draggable: true }).setLngLat([p.lng, p.lat]).addTo(m);
      pin.current.on("dragend", () => {
        const { lat, lng } = pin.current.getLngLat();
        alMover.current({ lat, lng });
      });
    } else {
      const ya = pin.current.getLngLat();
      if (Math.abs(ya.lat - p.lat) < 1e-7 && Math.abs(ya.lng - p.lng) < 1e-7) return;
      pin.current.setLngLat([p.lng, p.lat]);
    }
    if (acercar) m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), ZOOM_LOCAL), duration: 700 });
  }

  useEffect(() => {
    let vivo = true;
    import("maplibre-gl").then((modulo) => {
      if (!vivo || !caja.current) return;
      const ml = modulo.default || modulo;
      lib.current = ml;
      ml.setWorkerUrl(WORKER);
      const { punto: p0, centro: c0, zoom: z0 } = ultimo.current;
      const inicio = p0 || c0;
      const m = new ml.Map({
        container: caja.current,
        style: ESTILO,
        center: [inicio.lng, inicio.lat],
        zoom: p0 ? ZOOM_LOCAL : z0,
        // Con la rueda se baja la página; el mapa solo hace zoom con Ctrl.
        cooperativeGestures: true,
        attributionControl: { compact: true },
        locale: TEXTOS,
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("click", (e) => alMover.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      // La atribución compacta sale abierta y tapa medio mapa en un móvil: se cierra
      // y queda la (i), que la abre (sigue visible, como piden OpenStreetMap y OpenFreeMap).
      m.once("load", () => caja.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
      mapa.current = m;
      colocar(p0, false);
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      pin.current = null;
    };
    // El mapa se crea una vez; lo que cambia entra por los efectos de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { colocar(punto, true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [punto?.lat, punto?.lng]);

  // Sin pin, el mapa sigue a donde apunta la búsqueda o la ubicación.
  useEffect(() => {
    if (!punto) mapa.current?.flyTo({ center: [centro.lng, centro.lat], zoom, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro.lat, centro.lng, zoom]);

  return <div ref={caja} className="alta-mapa-caja" role="application" aria-label="Mapa para marcar tu local" />;
}
